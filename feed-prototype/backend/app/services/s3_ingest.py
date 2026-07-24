"""S3 batch ingestion: PostgreSQL tracking, claim, and import wiring (v1.2.1).

Turns a `DiscoveredBatch` (from `s3_discovery`) into DB rows by:

1. finding-or-creating a `pending` tracking record (keyed on the unique
   `import_batch.external_id`);
2. deciding whether to process it from PostgreSQL state alone (`decide_action`);
3. claiming it atomically under a row lock (`SELECT ... FOR UPDATE`), moving it to
   `processing` and bumping `attempt_count`;
4. validating the batch and importing it via the shared `import_payload`, then
   marking `completed` — all in one transaction so a partial (post-without-asset)
   state can never persist;
5. on any failure, rolling back the import and recording `failed` with a code.

State of truth is PostgreSQL, never the S3 object: the `_READY.json` marker and
every object are left exactly as-is. The same batch reappearing every poll is
normal — `decide_action` skips anything already `completed`.

`decide_action` is a pure function (no DB, no S3) so the retry/timeout policy is
unit-tested without any external service.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings
from app.models.import_batch import ImportBatch
from app.schemas.external_import import ExternalImportAsset
from app.schemas.s3_ready import BatchValidationError
from app.services.import_external_posts import (
    ImportSummary,
    ResolvedAssetIdentity,
    import_payload,
)
from app.services.s3_discovery import (
    DiscoveredBatch,
    ValidatedBatch,
    resolve_asset_object_key,
    validate_batch,
)
from app.services.s3_storage import ObjectStore, S3IngestConfig

logger = logging.getLogger(__name__)


STATE_PENDING = "pending"
STATE_PROCESSING = "processing"
STATE_COMPLETED = "completed"
STATE_FAILED = "failed"
STATE_IGNORED = "ignored"

STORAGE_BACKEND_S3 = "s3"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Action(str, Enum):
    PROCESS = "process"
    SKIP = "skip"


@dataclass(frozen=True)
class RetryPolicy:
    processing_timeout_seconds: int
    failed_retry_enabled: bool
    failed_max_attempts: int

    @classmethod
    def from_settings(cls, settings: Settings) -> "RetryPolicy":
        return cls(
            processing_timeout_seconds=settings.s3_processing_timeout_seconds,
            failed_retry_enabled=settings.s3_failed_retry_enabled,
            failed_max_attempts=settings.s3_failed_max_attempts,
        )


@dataclass(frozen=True)
class BatchOutcome:
    batch_external_id: str
    status: str  # "completed" | "failed" | "skipped"
    ingest_state: str | None = None
    error_code: str | None = None
    created_post_count: int | None = None
    created_asset_count: int | None = None
    reason: str | None = None


def _is_timed_out(
    processing_started_at: datetime | None, now: datetime, timeout_seconds: int
) -> bool:
    if processing_started_at is None:
        # In `processing` with no start time is inconsistent — allow reclaim.
        return True
    started = processing_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    return (now - started).total_seconds() > timeout_seconds


def decide_action(
    *,
    ingest_state: str | None,
    processing_started_at: datetime | None,
    attempt_count: int | None,
    now: datetime,
    policy: RetryPolicy,
) -> Action:
    """Decide whether to process a batch from its tracking state alone.

    Pure: no DB, no S3. `ingest_state is None` means the row is NOT an S3-managed
    batch (e.g. a legacy filesystem/HTTP row that happens to share the id) and is
    left alone. `completed`/`ignored` skip. `pending` processes. `processing`
    skips unless the claim has timed out. `failed` processes only if retry is
    enabled and attempts remain.
    """
    if ingest_state is None:
        return Action.SKIP
    if ingest_state == STATE_PENDING:
        return Action.PROCESS
    if ingest_state == STATE_COMPLETED:
        return Action.SKIP
    if ingest_state == STATE_IGNORED:
        return Action.SKIP
    if ingest_state == STATE_PROCESSING:
        if _is_timed_out(processing_started_at, now, policy.processing_timeout_seconds):
            return Action.PROCESS
        return Action.SKIP
    if ingest_state == STATE_FAILED:
        if not policy.failed_retry_enabled:
            return Action.SKIP
        if (attempt_count or 0) >= policy.failed_max_attempts:
            return Action.SKIP
        return Action.PROCESS
    # Unknown state → conservative skip.
    return Action.SKIP


def find_or_create_pending(
    session: Session,
    config: S3IngestConfig,
    discovered: DiscoveredBatch,
    *,
    now: datetime,
) -> ImportBatch:
    """Return the tracking row for this batch, creating a `pending` one if none
    exists. Concurrency-safe: a duplicate insert (another worker won the race)
    is caught via the unique `external_id` constraint and the existing row is
    re-read."""
    existing = session.exec(
        select(ImportBatch).where(ImportBatch.external_id == discovered.batch_external_id)
    ).first()
    if existing is not None:
        return existing

    record = ImportBatch(
        id=f"import-batch-{uuid4()}",
        external_id=discovered.batch_external_id,
        status=STATE_PENDING,
        ingest_state=STATE_PENDING,
        storage_backend=STORAGE_BACKEND_S3,
        bucket=config.bucket,
        object_prefix=discovered.object_prefix,
        ready_key=discovered.ready_key,
        manifest_etag=discovered.ready_etag,
        discovered_at=now,
        attempt_count=0,
        first_imported_at=now,
        last_imported_at=now,
        import_count=0,
    )
    session.add(record)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.exec(
            select(ImportBatch).where(
                ImportBatch.external_id == discovered.batch_external_id
            )
        ).first()
        if existing is None:  # pragma: no cover - only if the row vanished
            raise
        return existing
    session.refresh(record)
    return record


def claim_batch(
    session: Session,
    batch_external_id: str,
    *,
    now: datetime,
    policy: RetryPolicy,
) -> ImportBatch | None:
    """Atomically move an eligible batch to `processing` under a row lock.

    Re-checks `decide_action` while holding `SELECT ... FOR UPDATE`, so if two
    workers both saw `pending`, exactly one flips it to `processing`; the other
    re-reads `processing` and backs off. Returns the claimed row, or None if it
    was not eligible once locked.
    """
    record = session.exec(
        select(ImportBatch)
        .where(ImportBatch.external_id == batch_external_id)
        .with_for_update()
    ).first()
    if record is None:  # pragma: no cover - created just before claim
        return None

    action = decide_action(
        ingest_state=record.ingest_state,
        processing_started_at=record.processing_started_at,
        attempt_count=record.attempt_count,
        now=now,
        policy=policy,
    )
    if action is not Action.PROCESS:
        session.commit()  # release the lock, nothing claimed
        return None

    record.ingest_state = STATE_PROCESSING
    record.status = STATE_PROCESSING
    record.processing_started_at = now
    record.attempt_count = (record.attempt_count or 0) + 1
    record.error_code = None
    record.error_message = None
    record.last_imported_at = now
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def _make_asset_resolver(
    store: ObjectStore, config: S3IngestConfig, batch_external_id: str
):
    """Build the per-asset identity resolver passed to `import_payload`.

    A batch-relative asset becomes an S3 object identity (backend/bucket/key +
    best-effort size/etag). A remote/absolute asset (e.g. a link) returns None so
    the importer keeps its original url unchanged. The stored `src` is the object
    key placeholder; the browser-facing URL is built from the object identity at
    serialize time in v1.2.4 (no expiring URL is persisted).
    """

    def resolver(asset: ExternalImportAsset) -> ResolvedAssetIdentity | None:
        object_key = resolve_asset_object_key(config, batch_external_id, asset.url)
        if object_key is None:
            return None
        size_bytes: int | None = None
        etag: str | None = None
        try:
            info = store.head_object(object_key)
            if info is not None:
                size_bytes = info.size
                etag = info.etag
        except Exception:  # noqa: BLE001 - metadata is best-effort, never fatal
            pass
        return ResolvedAssetIdentity(
            url=None,
            src=object_key,
            storage_backend=STORAGE_BACKEND_S3,
            bucket=config.bucket,
            object_key=object_key,
            size_bytes=size_bytes,
            etag=etag,
        )

    return resolver


def _mark_completed(
    record: ImportBatch,
    validated: ValidatedBatch,
    summary: ImportSummary,
    *,
    now: datetime,
) -> None:
    record.ingest_state = STATE_COMPLETED
    record.completed_at = now
    record.failed_at = None
    record.error_code = None
    record.error_message = None
    record.manifest_key = validated.manifest_key
    record.manifest_etag = validated.manifest_etag
    record.created_post_count = summary.posts_created + summary.posts_updated
    record.created_asset_count = summary.assets_created


def _mark_failed(
    session: Session, batch_external_id: str, *, code: str, message: str, now: datetime
) -> None:
    """Record a failure on its own clean transaction (import already rolled back)."""
    record = session.exec(
        select(ImportBatch).where(ImportBatch.external_id == batch_external_id)
    ).first()
    if record is None:  # pragma: no cover
        return
    record.ingest_state = STATE_FAILED
    record.status = STATE_FAILED
    record.failed_at = now
    record.error_code = code
    record.error_message = message[:2000]
    session.add(record)
    session.commit()


def process_batch(
    session: Session,
    store: ObjectStore,
    config: S3IngestConfig,
    discovered: DiscoveredBatch,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> BatchOutcome:
    """Process one discovered batch end-to-end. Never mutates S3 objects."""
    now = now or _utc_now()
    policy = RetryPolicy.from_settings(settings)
    batch_id = discovered.batch_external_id

    record = find_or_create_pending(session, config, discovered, now=now)
    early = decide_action(
        ingest_state=record.ingest_state,
        processing_started_at=record.processing_started_at,
        attempt_count=record.attempt_count,
        now=now,
        policy=policy,
    )
    if early is not Action.PROCESS:
        return BatchOutcome(
            batch_external_id=batch_id,
            status="skipped",
            ingest_state=record.ingest_state,
            reason=f"state={record.ingest_state}",
        )

    claimed = claim_batch(session, batch_id, now=now, policy=policy)
    if claimed is None:
        return BatchOutcome(
            batch_external_id=batch_id,
            status="skipped",
            ingest_state=record.ingest_state,
            reason="not_claimed",
        )

    try:
        validated = validate_batch(store, config, discovered)
        resolver = _make_asset_resolver(store, config, batch_id)
        summary = import_payload(
            session,
            validated.payload,
            dry_run=False,
            asset_identity_resolver=resolver,
        )
        _mark_completed(claimed, validated, summary, now=_utc_now())
        session.add(claimed)
        session.commit()
        logger.info(
            "s3 ingest completed batch=%s posts=%s assets=%s attempt=%s",
            batch_id,
            claimed.created_post_count,
            claimed.created_asset_count,
            claimed.attempt_count,
        )
        return BatchOutcome(
            batch_external_id=batch_id,
            status="completed",
            ingest_state=STATE_COMPLETED,
            created_post_count=claimed.created_post_count,
            created_asset_count=claimed.created_asset_count,
        )
    except BatchValidationError as exc:
        session.rollback()
        _mark_failed(session, batch_id, code=exc.code, message=exc.message, now=_utc_now())
        logger.warning("s3 ingest failed batch=%s code=%s", batch_id, exc.code)
        return BatchOutcome(
            batch_external_id=batch_id,
            status="failed",
            ingest_state=STATE_FAILED,
            error_code=exc.code,
        )
    except Exception as exc:  # noqa: BLE001 - any import error → failed, no partial rows
        session.rollback()
        _mark_failed(
            session,
            batch_id,
            code="import_error",
            message=f"{type(exc).__name__}: {exc}",
            now=_utc_now(),
        )
        logger.warning("s3 ingest failed batch=%s code=import_error", batch_id)
        return BatchOutcome(
            batch_external_id=batch_id,
            status="failed",
            ingest_state=STATE_FAILED,
            error_code="import_error",
        )
