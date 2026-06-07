from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.follow import Follow
from app.schemas.feed import FollowRead


router = APIRouter(prefix="/api/follows", tags=["follows"])


@router.get("", response_model=list[FollowRead])
def list_follows(session: Session = Depends(get_session)) -> list[Follow]:
    follows = session.exec(
        select(Follow).order_by(Follow.follower_user_id, Follow.following_account_id)
    ).all()
    return list(follows)
