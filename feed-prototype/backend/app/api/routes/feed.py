from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.account import Account
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
from app.services.post_filters import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    PostFilters,
    PostPagination,
    get_accounts_by_id,
    get_assets_by_post_id,
    paginate_posts,
    validate_post_filters,
    validate_pagination,
)


router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
def get_feed(
    user_id: str = Query(...),
    keyword: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    metadata_key: str | None = Query(default=None),
    metadata_value: str | None = Query(default=None),
    metadata_match: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    account_handle: str | None = Query(default=None),
    my_posts_only: bool = Query(default=False),
    created_at_from: str | None = Query(default=None),
    created_at_to: str | None = Query(default=None),
    sort: str = Query(default="newest"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    session: Session = Depends(get_session),
) -> FeedResponse:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    filters = PostFilters(
        keyword=keyword,
        tag=tag,
        metadata_key=metadata_key,
        metadata_value=metadata_value,
        metadata_match=metadata_match,
        asset_type=asset_type,
        account_id=account_id,
        account_handle=account_handle,
        user_id=user_id,
        my_posts_only=my_posts_only,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
    )
    pagination = PostPagination(sort=sort, cursor=cursor, limit=limit)

    followed_account_ids = list(
        session.exec(
            select(Follow.following_account_id).where(Follow.follower_user_id == user_id)
        ).all()
    )

    own_account = session.exec(select(Account).where(Account.user_id == user_id)).first()
    feed_account_ids = list(dict.fromkeys(
        followed_account_ids + ([own_account.id] if own_account is not None else [])
    ))

    if not feed_account_ids:
        # Still validate query params so invalid input surfaces a 400.
        validate_post_filters(session, filters)
        validate_pagination(pagination)
        return FeedResponse(user=UserRead.model_validate(user), items=[])

    page = paginate_posts(
        session,
        select(Post).where(Post.account_id.in_(feed_account_ids)),
        filters,
        pagination,
    )

    accounts_by_id = get_accounts_by_id(session, [post.account_id for post in page.posts])
    assets_by_post_id = get_assets_by_post_id(session, [post.id for post in page.posts])

    items = [
        FeedItem(
            post=PostRead.model_validate(post),
            account=AccountRead.model_validate(accounts_by_id[post.account_id]),
            assets=[
                PostAssetRead.model_validate(asset)
                for asset in assets_by_post_id.get(post.id, [])
            ],
        )
        for post in page.posts
        if post.account_id in accounts_by_id
    ]

    return FeedResponse(
        user=UserRead.model_validate(user),
        items=items,
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )
