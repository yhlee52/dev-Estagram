from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.models.like import PostLike
from app.models.post import Post
from app.models.user import User


router = APIRouter(prefix="/api/posts", tags=["likes"])


class LikeSummary(BaseModel):
    post_id: str
    count: int
    liked_by_me: bool


def _summary(session: Session, post_id: str, user_id: str) -> LikeSummary:
    count = session.exec(
        select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)
    ).one()
    liked = session.exec(
        select(PostLike.id).where(PostLike.post_id == post_id, PostLike.user_id == user_id)
    ).first()
    return LikeSummary(post_id=post_id, count=count, liked_by_me=liked is not None)


def _require_post(session: Session, post_id: str) -> None:
    if session.get(Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")


@router.get("/{post_id}/likes", response_model=LikeSummary)
def get_likes(
    post_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LikeSummary:
    _require_post(session, post_id)
    return _summary(session, post_id, current_user.id)


@router.post("/{post_id}/likes", response_model=LikeSummary)
def add_like(
    post_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LikeSummary:
    _require_post(session, post_id)
    existing = session.exec(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    ).first()
    if existing is None:
        session.add(PostLike(id=f"like-{uuid4()}", post_id=post_id, user_id=current_user.id))
        session.commit()
    return _summary(session, post_id, current_user.id)


@router.delete("/{post_id}/likes", response_model=LikeSummary)
def remove_like(
    post_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LikeSummary:
    _require_post(session, post_id)
    existing = session.exec(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    ).first()
    if existing is not None:
        session.delete(existing)
        session.commit()
    return _summary(session, post_id, current_user.id)
