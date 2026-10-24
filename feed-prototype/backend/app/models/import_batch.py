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
