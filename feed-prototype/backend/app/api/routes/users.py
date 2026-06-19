from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.models.user import User
from app.schemas.feed import UserCreate, UserRead, UserRegistrationResponse
from app.services.users import create_user_with_account


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[User]:
    return list(session.exec(select(User).order_by(User.handle)).all())


@router.post("", response_model=UserRegistrationResponse, status_code=201)
def create_user(
    user_create: UserCreate,
    session: Session = Depends(get_session),
) -> UserRegistrationResponse:
    return create_user_with_account(session, user_create)


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user
