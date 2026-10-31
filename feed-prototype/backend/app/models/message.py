from datetime import datetime, timezone
from typing import ClassVar

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class MessageRoom(SQLModel, table=True):
    __tablename__: ClassVar[str] = "message_rooms"

    id: str = Field(primary_key=True)
    kind: str = "direct"
    name: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MessageRoomMember(SQLModel, table=True):
    __tablename__: ClassVar[str] = "message_room_members"
    __table_args__ = (UniqueConstraint("room_id", "user_id", name="uq_message_room_member"),)

    id: str = Field(primary_key=True)
    room_id: str = Field(foreign_key="message_rooms.id", ondelete="CASCADE", index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DirectMessage(SQLModel, table=True):
    __tablename__: ClassVar[str] = "direct_messages"

    id: str = Field(primary_key=True)
    sender_user_id: str = Field(foreign_key="users.id", index=True)
    recipient_user_id: str | None = Field(default=None, foreign_key="users.id", index=True)
    room_id: str | None = Field(default=None, foreign_key="message_rooms.id", index=True)
    text: str
    image_path: str | None = None
    image_mime_type: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
