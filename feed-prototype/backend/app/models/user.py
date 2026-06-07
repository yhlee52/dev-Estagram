from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__: ClassVar[str] = "users"

    id: str = Field(primary_key=True)
    handle: str = Field(index=True, unique=True)
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
