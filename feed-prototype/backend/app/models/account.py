from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Account(SQLModel, table=True):
    __tablename__: ClassVar[str] = "accounts"

    id: str = Field(primary_key=True)
    external_id: str | None = Field(default=None, index=True, unique=True)
    user_id: str = Field(foreign_key="users.id", unique=True)
    handle: str = Field(index=True, unique=True)
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None
    kind: str = "person"
    profile_source: str = "user"
    # v0.6.4 account lifecycle: null = active. When set, the paired user cannot
    # log in and the account is hidden from discovery, but its posts are kept.
    deactivated_at: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
