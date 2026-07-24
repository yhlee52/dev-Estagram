from datetime import datetime, timezone
from typing import Any, ClassVar

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PostAsset(SQLModel, table=True):
    __tablename__: ClassVar[str] = "post_assets"

    id: str = Field(primary_key=True)
    external_id: str | None = Field(default=None, index=True, unique=True)
    post_id: str = Field(foreign_key="posts.id", index=True)
    type: str
    title: str | None = None
    description: str | None = None
    url: str | None = None
    src: str
    mime_type: str | None = None
    sort_order: int | None = Field(default=None)
    metadata_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    # --- object-storage asset identity (v1.2.1) ------------------------------
    # Populated only for assets imported from an S3 batch; None for existing
    # local/remote-url assets. The binary stays in S3 — these columns are the
    # permanent, non-expiring identity of the object so the serializer can build
    # a proxy/presigned URL at response time (v1.2.4) without storing an
    # expiring URL in the DB.
    storage_backend: str | None = None  # "s3" for object-storage assets
    bucket: str | None = None
    object_key: str | None = None
    size_bytes: int | None = None
    etag: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
