from datetime import datetime, timezone
from typing import ClassVar

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class PostLike(SQLModel, table=True):
    __tablename__: ClassVar[str] = "post_likes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_post_likes_user_post"),)

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    post_id: str = Field(foreign_key="posts.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
