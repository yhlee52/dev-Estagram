from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ImportBatch(SQLModel, table=True):
    """Server-side record of an external-post import event (v0.3.1).

    This is ingestion operational metadata, not part of the frozen external
    package format and not a core domain concept. One row per
    `batch.external_id`; re-importing the same batch updates the row in place
    (see `record_batch` in `app.services.import_external_posts`).

    `status` is "success" or "failed". The count columns are a snapshot of the
    most recent import event's `ImportSummary` ("what happened in that run"),
    which is distinct from the live count of posts currently attributed to the
    batch (derived at query time from `Post.import_batch_external_id`).
    """

    __tablename__: ClassVar[str] = "import_batch"

    id: str = Field(primary_key=True)
    external_id: str = Field(index=True, unique=True)
    source: str | None = None
    # The batch creation time declared by the payload (naive datetime allowed by
    # the frozen format spec).
    batch_created_at: datetime | None = None

    status: str = "success"
    error_message: str | None = None

    first_imported_at: datetime = Field(default_factory=utc_now)
    last_imported_at: datetime = Field(default_factory=utc_now)
    import_count: int = 0

    # Snapshot of the most recent import event's ImportSummary counts.
    accounts_created: int = 0
    accounts_updated: int = 0
    users_created: int = 0
    users_updated: int = 0
    posts_created: int = 0
    posts_updated: int = 0
    posts_skipped: int = 0
    asset_replace_target_posts: int = 0
    assets_deleted: int = 0
    assets_created: int = 0
    errors: int = 0

    # --- S3 / object-storage ingestion tracking (v1.2.1) ---------------------
    # All nullable and unused by the filesystem/HTTP import paths, which leave
    # them None. Only the S3 watch worker populates them. `status` above stays
    # the success/failed event snapshot for the existing /api/imports history;
    # `ingest_state` is a SEPARATE lifecycle used only by S3 ingestion, so the
    # two never collide.
    #
    # ingest_state ∈ {pending, processing, completed, failed, ignored} for S3
    # rows; None for legacy filesystem/HTTP rows.
    ingest_state: str | None = Field(default=None, index=True)
    storage_backend: str | None = None  # "s3" for object-storage batches
    bucket: str | None = None
    object_prefix: str | None = None  # {root}/batches/{batch_external_id}
    manifest_key: str | None = None  # full object key of feed_posts.json
    ready_key: str | None = None  # full object key of _READY.json
    discovered_at: datetime | None = None
    processing_started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    attempt_count: int | None = None
    error_code: str | None = None
    # The S3 path reuses the `error_message` column declared above (v0.3.1); it
    # is deliberately not re-declared here. Re-declaring it silently shadowed
    # the original field and led 0013 to try to ADD an already-existing column.
    manifest_etag: str | None = None
    manifest_last_modified: datetime | None = None
    created_post_count: int | None = None
    created_asset_count: int | None = None
