from datetime import datetime, timezone
from typing import ClassVar

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Follow(SQLModel, table=True):
    __tablename__: ClassVar[str] = "follows"
    __table_args__ = (
        UniqueConstraint(
            "follower_user_id",
            "following_account_id",
            name="uq_follows_follower_user_following_account",
        ),
    )

    id: str = Field(primary_key=True)
    follower_user_id: str = Field(foreign_key="users.id")
    following_account_id: str = Field(foreign_key="accounts.id")
    created_at: datetime = Field(default_factory=utc_now)
