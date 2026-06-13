from datetime import datetime, timezone
from typing import Any, ClassVar

from sqlalchemy import Column, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Post(SQLModel, table=True):
    __tablename__: ClassVar[str] = "posts"

    id: str = Field(primary_key=True)
    external_id: str | None = Field(default=None, index=True, unique=True)
    account_id: str = Field(foreign_key="accounts.id", index=True)
    title: str
    text: str
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    metadata_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    imported_at: datetime | None = None
    import_batch_external_id: str | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
