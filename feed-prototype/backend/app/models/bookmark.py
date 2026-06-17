from datetime import datetime, timezone
from typing import ClassVar

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Bookmark(SQLModel, table=True):
    """A user's private bookmark on a post, with an optional note (v0.5.0~).

    Generic collaboration/annotation data: a user marks a post to revisit and may
    attach a private `note` visible only to the owner. Ownership uses the
    prototype active-user selection (like `Follow`); only the owner reads/edits/
    deletes. Not part of the frozen external package format.
    """

    __tablename__: ClassVar[str] = "bookmarks"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "post_id",
            name="uq_bookmarks_user_post",
        ),
    )

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    post_id: str = Field(foreign_key="posts.id", index=True)
    note: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
