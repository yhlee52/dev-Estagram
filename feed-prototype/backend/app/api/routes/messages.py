"""Session-scoped direct and group message rooms."""

import base64
import binascii
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.core.config import get_settings
from app.models.account import Account
from app.models.follow import Follow
from app.models.message import DirectMessage, MessageRoom, MessageRoomMember
from app.models.user import User
from app.schemas.feed import AccountRead


router = APIRouter(prefix="/api/messages", tags=["messages"])
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class MessageBody(BaseModel):
    text: str = Field(max_length=2000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message text is required")
        return value


class RoomBody(BaseModel):
    account_ids: list[str] = Field(min_length=2, max_length=50)
    name: str | None = Field(default=None, max_length=100)


class InviteBody(BaseModel):
    account_ids: list[str] = Field(min_length=1, max_length=50)


class ImageBody(BaseModel):
    data_base64: str = Field(max_length=7 * 1024 * 1024)
    text: str = Field(default="", max_length=2000)


class MessageRead(BaseModel):
    id: str
    room_id: str | None
    sender_user_id: str
    recipient_user_id: str | None
    text: str
    image_url: str | None
    created_at: datetime


class RoomRead(BaseModel):
    id: str
    kind: str
    name: str | None
    members: list[AccountRead]
    last_message: MessageRead | None
    created_at: datetime


class RoomDetail(BaseModel):
    room: RoomRead
    messages: list[MessageRead]


class ConversationRead(BaseModel):
    account: AccountRead
    last_message: MessageRead


def _message_read(message: DirectMessage) -> MessageRead:
    image_url = (f"/api/messages/rooms/{message.room_id}/images/{message.id}"
                 if message.image_path else None)
    return MessageRead(id=message.id, room_id=message.room_id,
                       sender_user_id=message.sender_user_id,
                       recipient_user_id=message.recipient_user_id,
                       text=message.text, image_url=image_url,
                       created_at=message.created_at)


def _peer_account(session: Session, account_id: str, current_user: User) -> Account:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    return account


def _require_following(session: Session, sender_id: str, accounts: list[Account]) -> None:
    for account in accounts:
        if account.deactivated_at is not None:
            raise HTTPException(status_code=409, detail="Cannot message a deactivated account")
        following = session.exec(select(Follow).where(
            Follow.follower_user_id == sender_id,
            Follow.following_account_id == account.id,
        )).first()
        if following is None:
            raise HTTPException(status_code=403, detail=f"Follow @{account.handle} to send or invite")


def _accounts_for_ids(session: Session, ids: list[str], current_user: User) -> list[Account]:
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Duplicate accounts are not allowed")
    accounts = [_peer_account(session, account_id, current_user) for account_id in ids]
    _require_following(session, current_user.id, accounts)
    return accounts


def _members(session: Session, room_id: str) -> list[MessageRoomMember]:
    return list(session.exec(select(MessageRoomMember).where(
        MessageRoomMember.room_id == room_id,
    )).all())


def _lock_room(session: Session, room_id: str) -> None:
    # Serialize membership changes and sends so participant checks see a
    # stable set of recipients.
    session.exec(select(MessageRoom).where(MessageRoom.id == room_id).with_for_update()).first()


def _require_member(session: Session, room_id: str, user_id: str) -> tuple[MessageRoom, MessageRoomMember]:
    room = session.get(MessageRoom, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    member = session.exec(select(MessageRoomMember).where(
        MessageRoomMember.room_id == room_id,
        MessageRoomMember.user_id == user_id,
    )).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return room, member


def _member_accounts(session: Session, room_id: str) -> list[Account]:
    user_ids = [member.user_id for member in _members(session, room_id)]
    if not user_ids:
        return []
    return list(session.exec(select(Account).where(Account.user_id.in_(user_ids))
                             .order_by(Account.display_name)).all())


def _require_send_allowed(session: Session, room_id: str, sender_id: str) -> None:
    _require_member(session, room_id, sender_id)
    recipients = [account for account in _member_accounts(session, room_id)
                  if account.user_id != sender_id and account.deactivated_at is None]
    if not recipients:
        raise HTTPException(status_code=409, detail="No other participants in this room")


def _recent_messages(session: Session, room_id: str, joined_at: datetime, limit: int) -> list[DirectMessage]:
    items = session.exec(select(DirectMessage).where(
        DirectMessage.room_id == room_id,
        DirectMessage.created_at >= joined_at,
    ).order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc()).limit(limit)).all()
    return list(reversed(items))


def _room_read(session: Session, room: MessageRoom, member: MessageRoomMember) -> RoomRead:
    latest = _recent_messages(session, room.id, member.joined_at, 1)
    return RoomRead(id=room.id, kind=room.kind, name=room.name,
                    members=[AccountRead.model_validate(account)
                             for account in _member_accounts(session, room.id)],
                    last_message=_message_read(latest[-1]) if latest else None,
                    created_at=room.created_at)


def _create_room(session: Session, user_ids: list[str], name: str | None = None) -> MessageRoom:
    room = MessageRoom(id=f"room-{uuid4()}", kind="group" if len(user_ids) > 2 else "direct",
                       name=name.strip() or None if name else None)
    session.add(room)
    session.flush()
    for user_id in user_ids:
        session.add(MessageRoomMember(id=f"member-{uuid4()}", room_id=room.id, user_id=user_id))
    session.flush()
    return room


def _direct_room(session: Session, user_id: str, peer_id: str) -> MessageRoom | None:
    memberships = session.exec(select(MessageRoomMember).where(
        MessageRoomMember.user_id == user_id,
    )).all()
    for membership in memberships:
        room = session.get(MessageRoom, membership.room_id)
        if room and room.kind == "direct" and {m.user_id for m in _members(session, room.id)} == {user_id, peer_id}:
            return room
    return None


@router.get("/rooms", response_model=list[RoomRead])
def list_rooms(session: Session = Depends(get_session),
               current_user: User = Depends(get_current_user)) -> list[RoomRead]:
    memberships = session.exec(select(MessageRoomMember).where(
        MessageRoomMember.user_id == current_user.id,
    )).all()
    rooms = [_room_read(session, session.get(MessageRoom, member.room_id), member)
             for member in memberships]
    return sorted(rooms, key=lambda room: (
        room.last_message.created_at if room.last_message else room.created_at, room.id,
    ), reverse=True)


@router.post("/direct/{account_id}", response_model=RoomRead, status_code=201)
def open_direct_room(account_id: str, session: Session = Depends(get_session),
                     current_user: User = Depends(get_current_user)) -> RoomRead:
    peer = _peer_account(session, account_id, current_user)
    room = _direct_room(session, current_user.id, peer.user_id)
    if room is None:
        _require_following(session, current_user.id, [peer])
        room = _create_room(session, [current_user.id, peer.user_id])
        session.commit()
    return _room_read(session, room, _require_member(session, room.id, current_user.id)[1])


@router.post("/rooms", response_model=RoomRead, status_code=201)
def create_room(body: RoomBody, session: Session = Depends(get_session),
                current_user: User = Depends(get_current_user)) -> RoomRead:
    accounts = _accounts_for_ids(session, body.account_ids, current_user)
    room = _create_room(session, [current_user.id, *[account.user_id for account in accounts]], body.name)
    session.commit()
    return _room_read(session, room, _require_member(session, room.id, current_user.id)[1])


@router.get("/rooms/{room_id}", response_model=RoomDetail)
def get_room(room_id: str, limit: int = Query(default=100, ge=1, le=200),
             session: Session = Depends(get_session),
             current_user: User = Depends(get_current_user)) -> RoomDetail:
    room, member = _require_member(session, room_id, current_user.id)
    return RoomDetail(room=_room_read(session, room, member),
                      messages=[_message_read(message) for message in
                                _recent_messages(session, room_id, member.joined_at, limit)])


@router.post("/rooms/{room_id}/members", response_model=RoomRead)
def invite_members(room_id: str, body: InviteBody,
                   session: Session = Depends(get_session),
                   current_user: User = Depends(get_current_user)) -> RoomRead:
    _lock_room(session, room_id)
    room, member = _require_member(session, room_id, current_user.id)
    accounts = _accounts_for_ids(session, body.account_ids, current_user)
    existing = {item.user_id for item in _members(session, room_id)}
    if any(account.user_id in existing for account in accounts):
        raise HTTPException(status_code=409, detail="Account is already in this room")
    for account in accounts:
        session.add(MessageRoomMember(id=f"member-{uuid4()}", room_id=room_id,
                                      user_id=account.user_id))
    room.kind = "group"
    session.add(room)
    session.commit()
    return _room_read(session, room, member)


@router.delete("/rooms/{room_id}/members/me", status_code=204)
def leave_room(room_id: str, session: Session = Depends(get_session),
               current_user: User = Depends(get_current_user)) -> None:
    _lock_room(session, room_id)
    _, member = _require_member(session, room_id, current_user.id)
    session.delete(member)
    session.commit()


def _add_message(session: Session, room_id: str, user_id: str, text: str,
                 image_path: str | None = None, image_mime_type: str | None = None) -> DirectMessage:
    members = _members(session, room_id)
    peer_id = next((member.user_id for member in members if member.user_id != user_id), None)
    message = DirectMessage(id=f"message-{uuid4()}", room_id=room_id,
                            sender_user_id=user_id,
                            recipient_user_id=peer_id if len(members) == 2 else None,
                            text=text, image_path=image_path, image_mime_type=image_mime_type)
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


@router.post("/rooms/{room_id}/messages", response_model=MessageRead, status_code=201)
def send_room_message(room_id: str, body: MessageBody,
                      session: Session = Depends(get_session),
                      current_user: User = Depends(get_current_user)) -> MessageRead:
    _lock_room(session, room_id)
    _require_send_allowed(session, room_id, current_user.id)
    return _message_read(_add_message(session, room_id, current_user.id, body.text))


def _image_type(data: bytes) -> tuple[str, str] | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif", ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None


@router.post("/rooms/{room_id}/images", response_model=MessageRead, status_code=201)
def send_room_image(room_id: str, body: ImageBody,
                    session: Session = Depends(get_session),
                    current_user: User = Depends(get_current_user)) -> MessageRead:
    _lock_room(session, room_id)
    _require_send_allowed(session, room_id, current_user.id)
    caption = body.text.strip()
    try:
        data = base64.b64decode(body.data_base64, validate=True)
    except binascii.Error:
        raise HTTPException(status_code=422, detail="Invalid image data") from None
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
    detected = _image_type(data)
    if detected is None:
        raise HTTPException(status_code=415, detail="Use JPEG, PNG, GIF, or WebP")
    mime_type, suffix = detected
    storage_dir = get_settings().message_images_dir
    storage_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{suffix}"
    path = storage_dir / filename
    path.write_bytes(data)
    try:
        message = _add_message(session, room_id, current_user.id, caption,
                               filename, mime_type)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return _message_read(message)


@router.get("/rooms/{room_id}/images/{message_id}")
def get_room_image(room_id: str, message_id: str,
                   session: Session = Depends(get_session),
                   current_user: User = Depends(get_current_user)) -> FileResponse:
    _, member = _require_member(session, room_id, current_user.id)
    message = session.get(DirectMessage, message_id)
    if (message is None or message.room_id != room_id or not message.image_path
            or message.created_at < member.joined_at):
        raise HTTPException(status_code=404, detail="Image not found")
    path = get_settings().message_images_dir / Path(message.image_path).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type=message.image_mime_type,
                        headers={"Cache-Control": "private, no-store"})


# Keep the original direct-message API usable by existing local clients.
@router.get("/conversations", response_model=list[ConversationRead])
def list_conversations(session: Session = Depends(get_session),
                       current_user: User = Depends(get_current_user)) -> list[ConversationRead]:
    result = []
    for room in list_rooms(session, current_user):
        peers = [account for account in room.members if account.user_id != current_user.id]
        if room.kind == "direct" and len(peers) == 1 and room.last_message:
            result.append(ConversationRead(account=peers[0], last_message=room.last_message))
    return result


@router.get("/with/{account_id}", response_model=list[MessageRead])
def get_thread(account_id: str, limit: int = Query(default=100, ge=1, le=200),
               session: Session = Depends(get_session),
               current_user: User = Depends(get_current_user)) -> list[MessageRead]:
    peer = _peer_account(session, account_id, current_user)
    room = _direct_room(session, current_user.id, peer.user_id)
    if room is None:
        return []
    member = _require_member(session, room.id, current_user.id)[1]
    return [_message_read(message) for message in
            _recent_messages(session, room.id, member.joined_at, limit)]


@router.post("/with/{account_id}", response_model=MessageRead, status_code=201)
def send_message(account_id: str, body: MessageBody,
                 session: Session = Depends(get_session),
                 current_user: User = Depends(get_current_user)) -> MessageRead:
    peer = _peer_account(session, account_id, current_user)
    if peer.deactivated_at is not None:
        raise HTTPException(status_code=409, detail="Cannot message a deactivated account")
    room = _direct_room(session, current_user.id, peer.user_id)
    if room is None:
        _require_following(session, current_user.id, [peer])
        room = _create_room(session, [current_user.id, peer.user_id])
    else:
        _lock_room(session, room.id)
        _require_send_allowed(session, room.id, current_user.id)
    return _message_read(_add_message(session, room.id, current_user.id, body.text))
