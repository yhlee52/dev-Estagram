"""S3 ingestion tracking / claim / lifecycle regression check (v1.2.1).

Four layers, most runnable with no external services:

1. `decide_action` / timeout / retry — pure functions, no DB, no S3.
2. `_make_asset_resolver` — against the in-memory fake object store, no DB.
3. tracking + claim state machine — a real SQLite DB with ONLY the `import_batch`
   table created (it has no JSONB columns), so find-or-create, claim, idempotency,
   timeout recovery, and retry policy run without Postgres or MinIO.
4. full `process_batch` import (posts/assets) — needs Postgres (JSONB tables);
   runs only when `DATABASE_URL` points at a Postgres dev DB, else skips cleanly.

Usage (from feed-prototype/backend):

    python -m scripts.check_s3_ingest_tracking
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlmodel import Session, create_engine, select
from sqlalchemy.pool import StaticPool

from app.models.import_batch import ImportBatch
from app.schemas.external_import import ExternalImportAsset
from app.services.s3_discovery import DiscoveredBatch
from app.services.s3_ingest import (
    STATE_COMPLETED,
    STATE_FAILED,
    STATE_PENDING,
    STATE_PROCESSING,
    Action,
    RetryPolicy,
    claim_batch,
    decide_action,
    find_or_create_pending,
    _is_timed_out,
    _make_asset_resolver,
)
from app.services.s3_storage import S3IngestConfig

from scripts.check_s3_ingest import CONFIG, FakeObjectStore


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_POLICY = RetryPolicy(
    processing_timeout_seconds=1800,
    failed_retry_enabled=False,
    failed_max_attempts=3,
)


def discovered(batch_id: str) -> DiscoveredBatch:
    return DiscoveredBatch(
        batch_external_id=batch_id,
        ready_key=CONFIG.ready_key(batch_id),
        object_prefix=CONFIG.batch_prefix(batch_id),
        ready_etag="etag-ready",
    )


# --- 1. pure decision logic ---------------------------------------------------


def check_decide_action() -> None:
    now = now_utc()
    p = DEFAULT_POLICY

    def action(state, **kw):
        return decide_action(
            ingest_state=state,
            processing_started_at=kw.get("started"),
            attempt_count=kw.get("attempts"),
            now=now,
            policy=kw.get("policy", p),
        )

    assert action(None) is Action.SKIP  # legacy/non-S3 row untouched
    assert action(STATE_PENDING) is Action.PROCESS
    assert action(STATE_COMPLETED) is Action.SKIP
    assert action("ignored") is Action.SKIP
    assert action("weird-unknown") is Action.SKIP

    # processing: not timed out -> skip; timed out -> process
    assert action(STATE_PROCESSING, started=now - timedelta(seconds=10)) is Action.SKIP
    assert action(STATE_PROCESSING, started=now - timedelta(seconds=5000)) is Action.PROCESS
    assert action(STATE_PROCESSING, started=None) is Action.PROCESS  # inconsistent -> reclaim

    # failed: retry disabled -> skip; enabled with attempts left -> process; exhausted -> skip
    retry = RetryPolicy(1800, True, 3)
    assert action(STATE_FAILED, attempts=1, policy=DEFAULT_POLICY) is Action.SKIP
    assert action(STATE_FAILED, attempts=1, policy=retry) is Action.PROCESS
    assert action(STATE_FAILED, attempts=3, policy=retry) is Action.SKIP


def check_is_timed_out() -> None:
    now = now_utc()
    assert _is_timed_out(now - timedelta(seconds=10), now, 5) is True
    assert _is_timed_out(now - timedelta(seconds=10), now, 3600) is False
    assert _is_timed_out(None, now, 3600) is True
    # naive datetime is treated as UTC (SQLite may return naive timestamps)
    naive = (now - timedelta(seconds=10)).replace(tzinfo=None)
    assert _is_timed_out(naive, now, 5) is True


# --- 2. asset identity resolver ----------------------------------------------


def check_asset_resolver() -> None:
    store = FakeObjectStore()
    key = CONFIG.key_in_batch("b1", "assets/x.png")
    store.put(key, b"PNGDATA")
    resolver = _make_asset_resolver(store, CONFIG, "b1")

    identity = resolver(ExternalImportAsset(type="image", url="assets/x.png"))
    assert identity is not None
    assert identity.url is None
    assert identity.src == key
    assert identity.storage_backend == "s3"
    assert identity.bucket == CONFIG.bucket
    assert identity.object_key == key
    assert identity.size_bytes == len(b"PNGDATA")
    assert identity.etag is not None

    # remote/link asset -> no identity (importer keeps original url)
    assert resolver(ExternalImportAsset(type="link", url="https://x/y")) is None


# --- 3. tracking + claim on a SQLite import_batch-only DB ---------------------


def _sqlite_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ImportBatch.__table__.create(engine)
    return engine


def check_find_or_create_pending() -> None:
    engine = _sqlite_engine()
    d = discovered(f"batch-{uuid4().hex[:8]}")
    with Session(engine) as s:
        rec = find_or_create_pending(s, CONFIG, d, now=now_utc())
        assert rec.ingest_state == STATE_PENDING
        assert rec.storage_backend == "s3"
        assert rec.bucket == CONFIG.bucket
        assert rec.object_prefix == d.object_prefix
        assert rec.ready_key == d.ready_key
        assert rec.attempt_count == 0
        assert rec.discovered_at is not None
        first_id = rec.id
    with Session(engine) as s:
        rec2 = find_or_create_pending(s, CONFIG, d, now=now_utc())
        assert rec2.id == first_id  # idempotent, no duplicate row
        rows = s.exec(select(ImportBatch).where(ImportBatch.external_id == d.batch_external_id)).all()
        assert len(rows) == 1


def check_claim_and_skip() -> None:
    engine = _sqlite_engine()
    d = discovered(f"batch-{uuid4().hex[:8]}")
    with Session(engine) as s:
        find_or_create_pending(s, CONFIG, d, now=now_utc())

    with Session(engine) as s:
        claimed = claim_batch(s, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY)
        assert claimed is not None
        assert claimed.ingest_state == STATE_PROCESSING
        assert claimed.attempt_count == 1
        assert claimed.processing_started_at is not None

    # already processing, not timed out -> not claimable again
    with Session(engine) as s:
        again = claim_batch(s, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY)
        assert again is None


def check_two_worker_claim() -> None:
    engine = _sqlite_engine()
    d = discovered(f"batch-{uuid4().hex[:8]}")
    with Session(engine) as s:
        find_or_create_pending(s, CONFIG, d, now=now_utc())
    # Two workers on separate sessions; exactly one claims.
    s1, s2 = Session(engine), Session(engine)
    try:
        c1 = claim_batch(s1, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY)
        c2 = claim_batch(s2, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY)
        assert (c1 is not None) ^ (c2 is not None), (c1, c2)
    finally:
        s1.close()
        s2.close()


def check_timeout_recovery() -> None:
    engine = _sqlite_engine()
    d = discovered(f"batch-{uuid4().hex[:8]}")
    with Session(engine) as s:
        rec = find_or_create_pending(s, CONFIG, d, now=now_utc())
        rec.ingest_state = STATE_PROCESSING
        rec.processing_started_at = now_utc() - timedelta(seconds=10_000)
        rec.attempt_count = 1
        s.add(rec)
        s.commit()
    with Session(engine) as s:
        claimed = claim_batch(s, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY)
        assert claimed is not None  # timed out -> reclaimed
        assert claimed.attempt_count == 2


def check_completed_skip() -> None:
    engine = _sqlite_engine()
    d = discovered(f"batch-{uuid4().hex[:8]}")
    with Session(engine) as s:
        rec = find_or_create_pending(s, CONFIG, d, now=now_utc())
        rec.ingest_state = STATE_COMPLETED
        s.add(rec)
        s.commit()
    with Session(engine) as s:
        assert claim_batch(s, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY) is None


def check_failed_retry_policy() -> None:
    engine = _sqlite_engine()
    d = discovered(f"batch-{uuid4().hex[:8]}")
    with Session(engine) as s:
        rec = find_or_create_pending(s, CONFIG, d, now=now_utc())
        rec.ingest_state = STATE_FAILED
        rec.attempt_count = 1
        s.add(rec)
        s.commit()

    # retry disabled -> no claim
    with Session(engine) as s:
        assert claim_batch(s, d.batch_external_id, now=now_utc(), policy=DEFAULT_POLICY) is None

    # retry enabled, attempts remain -> claim
    retry = RetryPolicy(1800, True, 3)
    with Session(engine) as s:
        claimed = claim_batch(s, d.batch_external_id, now=now_utc(), policy=retry)
        assert claimed is not None
        assert claimed.attempt_count == 2

    # exhaust attempts -> no claim
    with Session(engine) as s:
        rec = s.exec(select(ImportBatch).where(ImportBatch.external_id == d.batch_external_id)).first()
        rec.ingest_state = STATE_FAILED
        rec.attempt_count = 3
        s.add(rec)
        s.commit()
    with Session(engine) as s:
        assert claim_batch(s, d.batch_external_id, now=now_utc(), policy=retry) is None


# --- 4. full process_batch import (Postgres only) -----------------------------


def check_full_process_batch_postgres() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url or not database_url.startswith("postgresql"):
        print("  [skip] DATABASE_URL not a Postgres dev DB; full import check skipped")
        return

    import json

    from app.core.config import get_settings
    from app.db.session import create_session
    from app.models.account import Account
    from app.models.asset import PostAsset
    from app.models.post import Post
    from app.services.s3_ingest import process_batch
    from scripts.cleanup_utils import delete_test_users

    suffix = uuid4().hex[:8]
    batch_id = f"check-s3-batch-{suffix}"
    acct_ext = f"check-s3-acct-{suffix}"
    post_ext = f"check-s3-post-{suffix}"

    store = FakeObjectStore()
    store.put(CONFIG.key_in_batch(batch_id, "assets/img.png"), b"PNGDATA")
    manifest = {
        "batch": {"external_id": batch_id, "source": "check"},
        "accounts": [
            {"external_id": acct_ext, "handle": f"h_{suffix}", "display_name": "S3 Check"}
        ],
        "posts": [
            {
                "external_id": post_ext,
                "account_external_id": acct_ext,
                "title": "S3 post",
                "assets": [{"type": "image", "url": "assets/img.png", "sort_order": 1}],
            }
        ],
    }
    store.put(CONFIG.key_in_batch(batch_id, "feed_posts.json"), json.dumps(manifest).encode())
    store.put(
        CONFIG.ready_key(batch_id),
        json.dumps(
            {"schema_version": "1.0", "batch_external_id": batch_id, "manifest_key": "feed_posts.json"}
        ).encode(),
    )

    settings = get_settings()
    d = discovered(batch_id)
    try:
        out1 = process_batch(create_session(), store, CONFIG, d, settings)
        assert out1.status == "completed", out1
        assert out1.created_post_count == 1

        # idempotent re-poll: completed -> skipped, no duplicate posts
        out2 = process_batch(create_session(), store, CONFIG, d, settings)
        assert out2.status == "skipped", out2

        with create_session() as s:
            posts = s.exec(select(Post).where(Post.external_id == post_ext)).all()
            assert len(posts) == 1
            assets = s.exec(select(PostAsset).where(PostAsset.post_id == posts[0].id)).all()
            assert len(assets) == 1
            assert assets[0].storage_backend == "s3"
            assert assets[0].object_key == CONFIG.key_in_batch(batch_id, "assets/img.png")
            rec = s.exec(select(ImportBatch).where(ImportBatch.external_id == batch_id)).first()
            assert rec.ingest_state == STATE_COMPLETED
    finally:
        with create_session() as s:
            for post in s.exec(select(Post).where(Post.external_id == post_ext)).all():
                for asset in s.exec(select(PostAsset).where(PostAsset.post_id == post.id)).all():
                    s.delete(asset)
                s.delete(post)
            rec = s.exec(select(ImportBatch).where(ImportBatch.external_id == batch_id)).first()
            if rec is not None:
                s.delete(rec)
            for acct in s.exec(select(Account).where(Account.external_id == acct_ext)).all():
                s.delete(acct)
            s.commit()
        delete_test_users([acct_ext])


CHECKS = [
    ("decide_action policy", check_decide_action),
    ("timeout helper", check_is_timed_out),
    ("asset identity resolver", check_asset_resolver),
    ("find_or_create_pending idempotent", check_find_or_create_pending),
    ("claim then skip while processing", check_claim_and_skip),
    ("two-worker single claim", check_two_worker_claim),
    ("processing timeout recovery", check_timeout_recovery),
    ("completed batch skip", check_completed_skip),
    ("failed retry policy", check_failed_retry_policy),
    ("full process_batch import (postgres)", check_full_process_batch_postgres),
]


def main() -> int:
    passed = 0
    failed = 0
    for name, fn in CHECKS:
        try:
            fn()
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[FAIL] {name}: {type(exc).__name__}: {exc}")
        else:
            passed += 1
            print(f"[ok]   {name}")
    print(f"\ncheck_s3_ingest_tracking: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
