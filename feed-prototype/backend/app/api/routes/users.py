from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.user import User
from app.schemas.feed import UserRead


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(session: Session = Depends(get_session)) -> list[User]:
    return list(session.exec(select(User).order_by(User.handle)).all())


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: str, session: Session = Depends(get_session)) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user
