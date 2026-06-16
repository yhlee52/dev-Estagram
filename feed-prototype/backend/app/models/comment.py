from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Comment(SQLModel, table=True):
    """A person's comment on a post (v0.5.0, collaboration).

    A flat (non-threaded) annotation authored by a user. ``author_user_id`` uses
    the prototype active-user selection for ownership; only the author may edit
    or delete (see `app.api.routes.comments`). This is generic collaboration
    data, not part of the frozen external package format.
    """

    __tablename__: ClassVar[str] = "comments"

    id: str = Field(primary_key=True)
    post_id: str = Field(foreign_key="posts.id", index=True)
    author_user_id: str = Field(foreign_key="users.id", index=True)
    text: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
