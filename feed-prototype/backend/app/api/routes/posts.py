from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.asset import PostAsset
from app.models.post import Post
from app.schemas.feed import PostAssetRead, PostRead, PostWithAssets


router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=list[PostRead])
def list_posts(session: Session = Depends(get_session)) -> list[Post]:
    posts = session.exec(select(Post).order_by(Post.created_at.desc())).all()
    return list(posts)


@router.get("/{post_id}", response_model=PostWithAssets)
def get_post(post_id: str, session: Session = Depends(get_session)) -> PostWithAssets:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    assets = session.exec(
        select(PostAsset)
        .where(PostAsset.post_id == post_id)
        .order_by(PostAsset.sort_order, PostAsset.created_at)
    ).all()

    return PostWithAssets(
        **PostRead.model_validate(post).model_dump(),
        assets=[PostAssetRead.model_validate(asset) for asset in assets],
    )
