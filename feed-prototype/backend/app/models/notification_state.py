from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class NotificationState(SQLModel, table=True):
    """Per-user read watermark for derived in-app notifications (v0.5.2).

    Notification items are derived from posts/comments/follows at read time.
    This table stores only the user's "mark all read" watermark, keeping the
    feature lightweight and independent from the frozen external package format.
    """

    __tablename__: ClassVar[str] = "notification_state"

    user_id: str = Field(foreign_key="users.id", primary_key=True)
    last_read_at: datetime | None = None
    updated_at: datetime = Field(default_factory=utc_now)
