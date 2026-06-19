from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, col, select

from app.api.deps import get_current_user, get_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.post import Post, utc_now
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    FeedItem,
    PaginatedPosts,
    PostAssetCreate,
    PostAssetRead,
    PostCreate,
    PostRead,
    PostUpdate,
    PostWithAssets,
)
from app.services.comments import get_comment_counts
from app.services.post_filters import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    PostFilters,
    PostPagination,
    paginate_posts,
)


router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=PaginatedPosts)
def list_posts(
    keyword: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    metadata_key: str | None = Query(default=None),
    metadata_value: str | None = Query(default=None),
    metadata_match: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    account_handle: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    my_posts_only: bool = Query(default=False),
    bookmarked_only: bool = Query(default=False),
    created_at_from: str | None = Query(default=None),
    created_at_to: str | None = Query(default=None),
    sort: str = Query(default="newest"),
    sort_metadata_key: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    session: Session = Depends(get_session),
) -> PaginatedPosts:
    page = paginate_posts(
        session,
        select(Post),
        PostFilters(
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
            bookmarked_only=bookmarked_only,
            created_at_from=created_at_from,
            created_at_to=created_at_to,
        ),
        PostPagination(
            sort=sort, cursor=cursor, limit=limit, sort_metadata_key=sort_metadata_key
        ),
    )
    comment_counts = get_comment_counts(session, [post.id for post in page.posts])
    return PaginatedPosts(
        items=[
            build_post_with_assets(session, post, comment_counts.get(post.id, 0))
            for post in page.posts
        ],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


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
        .order_by(
            col(PostAsset.sort_order).is_(None),
            PostAsset.sort_order,
            PostAsset.created_at,
            PostAsset.id,
        )
    ).all()
    return list(assets)


def build_post_with_assets(
    session: Session, post: Post, comment_count: int = 0
) -> PostWithAssets:
    assets = get_post_assets(session, post.id)
    post_read = PostRead.model_validate(post).model_copy(
        update={"comment_count": comment_count}
    )
    return PostWithAssets(
        **post_read.model_dump(),
        assets=[PostAssetRead.model_validate(asset) for asset in assets],
    )


def create_post_assets(
    session: Session,
    post_id: str,
    asset_inputs: list[PostAssetCreate],
) -> None:
    for asset_input in asset_inputs:
        asset = PostAsset(
            id=f"asset-{uuid4()}",
            post_id=post_id,
            type=asset_input.type,
            title=asset_input.title,
            description=asset_input.description,
            url=asset_input.url,
            src=asset_input.url,
            sort_order=asset_input.sort_order,
        )
        session.add(asset)


def replace_post_assets(
    session: Session,
    post_id: str,
    asset_inputs: list[PostAssetCreate],
) -> None:
    for asset in get_post_assets(session, post_id):
        session.delete(asset)

    create_post_assets(session, post_id, asset_inputs)


@router.post("", response_model=FeedItem, status_code=201)
def create_post(
    post_create: PostCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FeedItem:
    account = get_user_account(session, current_user.id)

    post = Post(
        id=f"post-{uuid4()}",
        account_id=account.id,
        title=post_create.title,
        text=post_create.text,
        tags=post_create.tags,
        metadata_json=post_create.metadata_json,
    )
    session.add(post)
    create_post_assets(session, post.id, post_create.assets)
    session.commit()
    session.refresh(post)

    assets = get_post_assets(session, post.id)
    return FeedItem(
        post=PostRead.model_validate(post),
        account=AccountRead.model_validate(account),
        assets=[PostAssetRead.model_validate(asset) for asset in assets],
    )


@router.get("/{post_id}", response_model=PostWithAssets)
def get_post(post_id: str, session: Session = Depends(get_session)) -> PostWithAssets:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    comment_count = get_comment_counts(session, [post.id]).get(post.id, 0)
    return build_post_with_assets(session, post, comment_count)


@router.patch("/{post_id}", response_model=PostWithAssets)
def update_post(
    post_id: str,
    post_update: PostUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PostWithAssets:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    account = get_user_account(session, current_user.id)
    if post.account_id != account.id:
        raise HTTPException(status_code=403, detail="Post is not owned by user")

    if post_update.title is not None:
        post.title = post_update.title
    if post_update.text is not None:
        post.text = post_update.text
    if post_update.tags is not None:
        post.tags = post_update.tags
    if "metadata_json" in post_update.model_fields_set:
        post.metadata_json = post_update.metadata_json
    if post_update.assets is not None:
        replace_post_assets(session, post.id, post_update.assets)

    post.updated_at = utc_now()
    session.add(post)
    session.commit()
    session.refresh(post)

    return build_post_with_assets(session, post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    account = get_user_account(session, current_user.id)
    if post.account_id != account.id:
        raise HTTPException(status_code=403, detail="Post is not owned by user")

    for asset in get_post_assets(session, post_id):
        session.delete(asset)

    for comment in session.exec(select(Comment).where(Comment.post_id == post_id)).all():
        session.delete(comment)

    for bookmark in session.exec(select(Bookmark).where(Bookmark.post_id == post_id)).all():
        session.delete(bookmark)

    session.delete(post)
    session.commit()
