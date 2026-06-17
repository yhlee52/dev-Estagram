from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserCredential(SQLModel, table=True):
    __tablename__: ClassVar[str] = "user_credentials"

    user_id: str = Field(foreign_key="users.id", primary_key=True)
    password_hash: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class UserSession(SQLModel, table=True):
    __tablename__: ClassVar[str] = "user_sessions"

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)
