from datetime import datetime, timezone
from typing import ClassVar

from sqlmodel import Field, SQLModel


class DirectMessage(SQLModel, table=True):
    __tablename__: ClassVar[str] = "direct_messages"

    id: str = Field(primary_key=True)
    sender_user_id: str = Field(foreign_key="users.id", index=True)
    recipient_user_id: str = Field(foreign_key="users.id", index=True)
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
