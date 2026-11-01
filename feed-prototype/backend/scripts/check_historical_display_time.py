"""Check historical display time authorization without a live database."""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from sqlmodel import SQLModel, Session, create_engine

from app.api.routes.messages import ReadBody, _recent_messages, _unread_count, mark_room_read
from app.core.config import get_settings
from app.models.message import DirectMessage, MessageRoom, MessageRoomMember
from app.models.user import User
from app.services.historical_time import validated_display_at


def denied(value: datetime, user_id: str, status: int) -> None:
    try:
        validated_display_at(value, user_id)
    except HTTPException as error:
        assert error.status_code == status, error.status_code
    else:
        raise AssertionError("Historical display time was accepted")


def main() -> None:
    historical = datetime(2026, 1, 1, 7, 0, tzinfo=timezone(timedelta(hours=9)))
    assert validated_display_at(None, "ordinary-user") is None
    with patch.dict(os.environ, {"DATABASE_URL": "postgresql+psycopg://local:local@localhost/local",
                                 "ENABLE_HISTORICAL_DISPLAY_AT": "0"}, clear=True):
        get_settings.cache_clear()
        denied(historical, "import-user-actor", 403)
    with patch.dict(os.environ, {"DATABASE_URL": "postgresql+psycopg://local:local@localhost/local",
                                 "ENABLE_HISTORICAL_DISPLAY_AT": "1"}, clear=True):
        get_settings.cache_clear()
        denied(historical, "ordinary-user", 403)
        denied(datetime(2026, 1, 1, 7, 0), "import-user-actor", 422)
        denied(datetime.now(timezone.utc) + timedelta(days=1), "import-user-actor", 422)
        assert validated_display_at(historical, "import-user-actor") == historical.astimezone(timezone.utc)
    get_settings.cache_clear()
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(
        engine, tables=[User.__table__, MessageRoom.__table__,
                        MessageRoomMember.__table__, DirectMessage.__table__])
    joined_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    with Session(engine) as session:
        sender = User(id="import-user-sender", handle="sender", display_name="Sender")
        receiver = User(id="import-user-receiver", handle="receiver", display_name="Receiver")
        room = MessageRoom(id="room-1")
        member = MessageRoomMember(id="member-1", room_id=room.id, user_id=receiver.id,
                                   joined_at=joined_at)
        session.add_all([sender, receiver, room, member,
                         DirectMessage(id="message-1", room_id=room.id,
                                       sender_user_id=sender.id, recipient_user_id=receiver.id,
                                       text="January memory", created_at=joined_at + timedelta(seconds=1),
                                       display_at=historical)])
        session.commit()
        assert [item.id for item in _recent_messages(session, room.id, joined_at, 100)] == ["message-1"]
        assert _unread_count(session, member) == 1
        result = mark_room_read(room.id, ReadBody(message_id="message-1"),
                                session=session, current_user=receiver)
        assert result.unread_count == 0
    engine.dispose()
    print("Historical display time checks passed")


if __name__ == "__main__":
    main()
