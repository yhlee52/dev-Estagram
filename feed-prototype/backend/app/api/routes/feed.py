from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.follow import Follow
from app.models.post import Post
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    FeedItem,
    FeedResponse,
    PostAssetRead,
    PostRead,
    UserRead,
)


router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
def get_feed(
    user_id: str = Query(...),
    session: Session = Depends(get_session),
) -> FeedResponse:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    followed_account_ids = list(
        session.exec(
            select(Follow.following_account_id).where(Follow.follower_user_id == user_id)
        ).all()
    )

    if not followed_account_ids:
        return FeedResponse(user=UserRead.model_validate(user), items=[])

    accounts = session.exec(
        select(Account).where(Account.id.in_(followed_account_ids))
    ).all()
    accounts_by_id = {account.id: account for account in accounts}

    posts = session.exec(
        select(Post)
        .where(Post.account_id.in_(followed_account_ids))
        .order_by(Post.created_at.desc())
    ).all()

    post_ids = [post.id for post in posts]
    assets_by_post_id: dict[str, list[PostAsset]] = {post_id: [] for post_id in post_ids}
    if post_ids:
        assets = session.exec(
            select(PostAsset)
            .where(PostAsset.post_id.in_(post_ids))
            .order_by(PostAsset.sort_order, PostAsset.created_at)
        ).all()
        for asset in assets:
            assets_by_post_id.setdefault(asset.post_id, []).append(asset)

    items = [
        FeedItem(
            post=PostRead.model_validate(post),
            account=AccountRead.model_validate(accounts_by_id[post.account_id]),
            assets=[
                PostAssetRead.model_validate(asset)
                for asset in assets_by_post_id.get(post.id, [])
            ],
        )
        for post in posts
        if post.account_id in accounts_by_id
    ]

    return FeedResponse(user=UserRead.model_validate(user), items=items)
