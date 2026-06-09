from datetime import datetime, timezone
from typing import Any, ClassVar

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PostAsset(SQLModel, table=True):
    __tablename__: ClassVar[str] = "post_assets"

    id: str = Field(primary_key=True)
    post_id: str = Field(foreign_key="posts.id", index=True)
    type: str
    title: str | None = None
    description: str | None = None
    url: str | None = None
    src: str
    mime_type: str | None = None
    sort_order: int = 0
    metadata_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
