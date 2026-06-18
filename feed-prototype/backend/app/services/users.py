import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.account import Account
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    UserCreate,
    UserRead,
    UserRegistrationResponse,
)
from app.services.auth import set_user_password


HANDLE_PATTERN = re.compile(r"^[a-z0-9_-]{3,32}$")


def validate_registration_handle(handle: str) -> None:
    if not handle:
        raise HTTPException(status_code=400, detail="Handle is required.")

    if not HANDLE_PATTERN.fullmatch(handle):
        raise HTTPException(
            status_code=400,
            detail=(
                "Handle must be 3-32 characters and use only lowercase letters, "
                "numbers, underscores, or hyphens."
            ),
        )


def ensure_registration_handle_available(session: Session, handle: str) -> None:
    existing_user = session.exec(select(User).where(User.handle == handle)).first()
    if existing_user is not None:
        raise HTTPException(
            status_code=409,
            detail=f"User handle '{handle}' is already in use.",
        )

    existing_account = session.exec(
        select(Account).where(Account.handle == handle)
    ).first()
    if existing_account is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Account handle '{handle}' is already in use.",
        )


def create_user_with_account(
    session: Session,
    user_create: UserCreate,
) -> UserRegistrationResponse:
    handle = user_create.handle
    validate_registration_handle(handle)
    ensure_registration_handle_available(session, handle)

    display_name = user_create.display_name or handle

    user = User(
        id=f"user-{uuid4()}",
        handle=handle,
        display_name=display_name,
        bio=user_create.bio,
    )
    session.add(user)

    try:
        # Flush the user first so PostgreSQL can satisfy accounts.user_id FK.
        session.flush()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"User handle '{handle}' is already in use.",
        ) from error

    account = Account(
        id=f"account-{uuid4()}",
        user_id=user.id,
        handle=handle,
        display_name=display_name,
        bio=user_create.bio,
        kind="person",
        profile_source="user",
    )
    session.add(account)
    set_user_password(session, user.id, user_create.password)

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Handle '{handle}' is already in use.",
        ) from error

    session.refresh(user)
    session.refresh(account)

    return UserRegistrationResponse(
        user=UserRead.model_validate(user),
        account=AccountRead.model_validate(account),
    )
