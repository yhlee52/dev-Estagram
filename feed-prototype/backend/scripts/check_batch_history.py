"""Import batch history regression check (v0.3.1).

Exercises the batch history feature end-to-end via FastAPI TestClient against a
real DB (writes + reads), then cleans up everything it created. Complements the
dry-run-only `check_http_import.py`.

Covers:
1. dry_run invariant: a dry-run POST does NOT create an import_batch row.
2. real import records a success batch (counts snapshot), visible in
   `GET /api/imports` and `GET /api/imports/{id}`.
3. re-import of the same batch updates in place (import_count increments, no
   duplicate post; posts_updated instead of posts_created).
4. a real failing import (duplicate external_id) records a failed batch.
5. `GET /api/imports/{id}` returns 404 for an unknown batch.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_batch_history

This WRITES to the DB and then deletes the rows it created (unique ids). Exit
code is non-zero if any check fails.
"""

from __future__ import annotations

import sys
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import select

from app.db.session import create_session
from app.main import app
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import generated_user_id


SUFFIX = uuid4().hex[:8]
ACCT_EXT = f"check-batch-acct-{SUFFIX}"
POST_EXT = f"check-batch-post-{SUFFIX}"
BATCH_OK = f"check-batch-ok-{SUFFIX}"
BATCH_FAIL = f"check-batch-fail-{SUFFIX}"


def ok_payload(batch_external_id: str) -> dict:
    return {
        "batch": {"external_id": batch_external_id, "source": "check_batch_history"},
        "accounts": [
            {
                "external_id": ACCT_EXT,
                "handle": f"checkbatch{SUFFIX}",
                "display_name": "Check Batch Account",
            }
        ],
        "posts": [
            {
                "external_id": POST_EXT,
                "account_external_id": ACCT_EXT,
                "title": "Check batch post",
                "text": "regression",
            }
        ],
    }


def fail_payload(batch_external_id: str) -> dict:
    # Duplicate post.external_id -> ImportErrorWithMessage -> 400.
    payload = ok_payload(batch_external_id)
    payload["posts"].append(
        {
            "external_id": POST_EXT,
            "account_external_id": ACCT_EXT,
            "title": "Duplicate",
            "text": "dup",
        }
    )
    return payload


def find_batch(items: list[dict], external_id: str) -> dict | None:
    return next((item for item in items if item["external_id"] == external_id), None)


def run_checks(client: TestClient) -> list[str]:
    failures: list[str] = []

    def check(condition: bool, message: str) -> None:
        if condition:
            print(f"OK: {message}")
        else:
            failures.append(message)
            print(f"FAILED: {message}", file=sys.stderr)

    # 1) dry_run invariant: no batch row created.
    before = client.get("/api/imports").json()["items"]
    dry = client.post("/api/imports?dry_run=true", json=ok_payload(BATCH_OK))
    check(dry.status_code == 200, f"dry-run POST returns 200 (got {dry.status_code})")
    after_dry = client.get("/api/imports").json()["items"]
    check(
        find_batch(after_dry, BATCH_OK) is None and len(after_dry) == len(before),
        "dry-run does not create an import_batch row",
    )

    # 2) real import records a success batch.
    created = client.post("/api/imports", json=ok_payload(BATCH_OK))
    check(created.status_code == 200, f"real import returns 200 (got {created.status_code})")
    summary = created.json()
    check(summary.get("posts_created") == 1, "import summary reports posts_created=1")

    listed = client.get("/api/imports").json()["items"]
    batch = find_batch(listed, BATCH_OK)
    check(batch is not None, "success batch appears in GET /api/imports")
    if batch is not None:
        check(batch["status"] == "success", "batch status is success")
        check(batch["posts_created"] == 1, "batch snapshot posts_created=1")
        check(batch["post_count"] == 1, "batch live post_count=1")
        check(batch["import_count"] == 1, "batch import_count=1")

    detail = client.get(f"/api/imports/{BATCH_OK}")
    check(detail.status_code == 200, "batch detail returns 200")
    if detail.status_code == 200:
        posts = detail.json()["posts"]
        check(
            len(posts) == 1 and posts[0]["external_id"] == POST_EXT,
            "batch detail lists the imported post",
        )

    # 3) re-import same batch updates in place.
    again = client.post("/api/imports", json=ok_payload(BATCH_OK))
    check(again.status_code == 200, "re-import returns 200")
    check(again.json().get("posts_updated") == 1, "re-import reports posts_updated=1")
    relisted = client.get("/api/imports").json()["items"]
    rebatch = find_batch(relisted, BATCH_OK)
    if rebatch is not None:
        check(rebatch["import_count"] == 2, "re-import increments import_count to 2")
        check(rebatch["post_count"] == 1, "re-import does not duplicate the post")

    # 4) failing real import records a failed batch.
    failed = client.post("/api/imports", json=fail_payload(BATCH_FAIL))
    check(failed.status_code == 400, f"failing import returns 400 (got {failed.status_code})")
    fdetail = client.get(f"/api/imports/{BATCH_FAIL}")
    check(fdetail.status_code == 200, "failed batch was recorded and is fetchable")
    if fdetail.status_code == 200:
        fbatch = fdetail.json()["batch"]
        check(fbatch["status"] == "failed", "failed batch status is failed")
        check(bool(fbatch["error_message"]), "failed batch has an error_message")
        check(fbatch["post_count"] == 0, "failed batch has no attributed posts")

    # 5) unknown batch -> 404.
    missing = client.get(f"/api/imports/does-not-exist-{SUFFIX}")
    check(missing.status_code == 404, "unknown batch returns 404")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for post in session.exec(
            select(Post).where(Post.external_id == POST_EXT)
        ).all():
            for asset in session.exec(
                select(PostAsset).where(PostAsset.post_id == post.id)
            ).all():
                session.delete(asset)
            session.delete(post)

        account = session.exec(
            select(Account).where(Account.external_id == ACCT_EXT)
        ).first()
        if account is not None:
            session.delete(account)

        user = session.get(User, generated_user_id(ACCT_EXT))
        if user is not None:
            session.delete(user)

        for external_id in (BATCH_OK, BATCH_FAIL):
            batch = session.exec(
                select(ImportBatch).where(ImportBatch.external_id == external_id)
            ).first()
            if batch is not None:
                session.delete(batch)

        session.commit()


def main() -> int:
    try:
        with TestClient(app) as client:
            failures = run_checks(client)
    finally:
        cleanup()

    if failures:
        print("\nBatch history check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nBatch history check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
