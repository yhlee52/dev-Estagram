from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Account(SQLModel, table=True):
    __tablename__: ClassVar[str] = "accounts"

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True)
    handle: str = Field(index=True, unique=True)
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None
    kind: str = "person"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
