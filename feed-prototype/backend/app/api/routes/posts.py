from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.post import Post
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    FeedItem,
    PostAssetRead,
    PostCreate,
    PostRead,
    PostWithAssets,
)


router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=list[PostRead])
def list_posts(session: Session = Depends(get_session)) -> list[Post]:
    posts = session.exec(select(Post).order_by(Post.created_at.desc())).all()
    return list(posts)


def get_user_account(session: Session, user_id: str) -> Account:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    account = session.exec(select(Account).where(Account.user_id == user_id)).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found for user")

    return account


def get_post_assets(session: Session, post_id: str) -> list[PostAsset]:
    assets = session.exec(
        select(PostAsset)
        .where(PostAsset.post_id == post_id)
        .order_by(PostAsset.sort_order, PostAsset.created_at)
    ).all()
    return list(assets)


@router.post("", response_model=FeedItem, status_code=201)
def create_post(
    post_create: PostCreate,
    session: Session = Depends(get_session),
) -> FeedItem:
    account = get_user_account(session, post_create.user_id)

    post = Post(
        id=f"post-{uuid4()}",
        account_id=account.id,
        title=post_create.title,
        text=post_create.text,
        metadata_json=post_create.metadata_json,
    )
    session.add(post)
    session.commit()
    session.refresh(post)

    return FeedItem(
        post=PostRead.model_validate(post),
        account=AccountRead.model_validate(account),
        assets=[],
    )


@router.get("/{post_id}", response_model=PostWithAssets)
def get_post(post_id: str, session: Session = Depends(get_session)) -> PostWithAssets:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    assets = get_post_assets(session, post_id)

    return PostWithAssets(
        **PostRead.model_validate(post).model_dump(),
        assets=[PostAssetRead.model_validate(asset) for asset in assets],
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: str,
    user_id: str = Query(...),
    session: Session = Depends(get_session),
) -> None:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    account = get_user_account(session, user_id)
    if post.account_id != account.id:
        raise HTTPException(status_code=403, detail="Post is not owned by user")

    for asset in get_post_assets(session, post_id):
        session.delete(asset)

    session.delete(post)
    session.commit()
