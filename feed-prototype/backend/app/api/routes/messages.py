from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import or_
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.models.account import Account
from app.models.message import DirectMessage
from app.models.user import User
from app.schemas.feed import AccountRead


router = APIRouter(prefix="/api/messages", tags=["messages"])


class MessageBody(BaseModel):
    text: str = Field(max_length=2000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message text is required")
        return value


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_user_id: str
    recipient_user_id: str
    text: str
    created_at: datetime


class ConversationRead(BaseModel):
    account: AccountRead
    last_message: MessageRead


def _peer_account(session: Session, account_id: str, current_user: User) -> Account:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    return account


@router.get("/conversations", response_model=list[ConversationRead])
def list_conversations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ConversationRead]:
    # One latest message per peer. This prototype uses local test data; the
    # conversation is derived from the messages rather than a second table.
    messages = session.exec(
        select(DirectMessage)
        .where(or_(DirectMessage.sender_user_id == current_user.id,
                   DirectMessage.recipient_user_id == current_user.id))
        .order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc())
    ).all()
    latest: dict[str, DirectMessage] = {}
    for message in messages:
        peer_id = (message.recipient_user_id if message.sender_user_id == current_user.id
                   else message.sender_user_id)
        latest.setdefault(peer_id, message)
    accounts = session.exec(select(Account).where(Account.user_id.in_(list(latest)))).all() if latest else []
    account_by_user = {account.user_id: account for account in accounts}
    return [
        ConversationRead(account=AccountRead.model_validate(account_by_user[peer_id]),
                         last_message=MessageRead.model_validate(message))
        for peer_id, message in latest.items() if peer_id in account_by_user
    ]


@router.get("/with/{account_id}", response_model=list[MessageRead])
def get_thread(
    account_id: str,
    limit: int = Query(default=100, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[DirectMessage]:
    peer = _peer_account(session, account_id, current_user)
    messages = session.exec(
        select(DirectMessage)
        .where(or_(
            (DirectMessage.sender_user_id == current_user.id) &
            (DirectMessage.recipient_user_id == peer.user_id),
            (DirectMessage.sender_user_id == peer.user_id) &
            (DirectMessage.recipient_user_id == current_user.id),
        ))
        .order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc())
        .limit(limit)
    ).all()
    return list(reversed(messages))


@router.post("/with/{account_id}", response_model=MessageRead, status_code=201)
def send_message(
    account_id: str,
    body: MessageBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> DirectMessage:
    peer = _peer_account(session, account_id, current_user)
    if peer.deactivated_at is not None:
        raise HTTPException(status_code=409, detail="Cannot message a deactivated account")
    message = DirectMessage(
        id=f"message-{uuid4()}",
        sender_user_id=current_user.id,
        recipient_user_id=peer.user_id,
        text=body.text,
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return message
