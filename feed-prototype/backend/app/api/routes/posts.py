from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlmodel import Session, col, select
from sqlalchemy import delete

from app.api.deps import get_current_user, get_session
from app.models.account import Account
from app.models.follow import Follow
from app.models.asset import PostAsset
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.like import PostLike
from app.models.post import Post, utc_now
from app.models.post_account_ref import PostAccountRef
from app.models.profile_pin import ProfilePin
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    FeedItem,
    PaginatedPosts,
    PostAssetCreate,
    PostAssetRead,
    PostCreate,
    PostRead,
    PostSearchMatch,
    PostUpdate,
    PostWithAssets,
)
from app.services.asset_url import serialize_asset
from app.services.comments import get_comment_counts
from app.services.auth import require_session_user
from app.services.post_account_refs import replace_post_tags, sync_post_mentions
from app.services.post_filters import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    PostFilters,
    PostPagination,
    paginate_posts,
    get_accounts_by_id,
)


router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=PaginatedPosts)
def list_posts(
    request: Request,
    keyword: str | None = Query(default=None),
    tag: list[str] = Query(default=[]),
    person: list[str] = Query(default=[]),
    place: str | None = Query(default=None),
    scope: str = Query(default="all"),
    metadata_key: str | None = Query(default=None),
    metadata_value: str | None = Query(default=None),
    metadata_match: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    has_assets: bool = Query(default=False),
    exclude_pinned: bool = Query(default=False),
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
    if scope not in {"all", "feed"}:
        raise HTTPException(status_code=400, detail="Invalid scope")
    people: list[tuple[str, str]] = []
    for condition in person:
        mode, separator, person_account_id = condition.partition(":")
        if not separator or not person_account_id:
            raise HTTPException(status_code=400, detail="Invalid person condition")
        people.append((person_account_id, mode))
    if bookmarked_only or my_posts_only:
        scoped_user = require_session_user(request, session)
        if user_id is not None and user_id != scoped_user.id:
            raise HTTPException(status_code=403, detail="User-scoped filters belong to the current session")
    base = select(Post)
    if scope == "feed":
        current_user = require_session_user(request, session)
        own = get_user_account(session, current_user.id)
        followed = session.exec(select(Follow.following_account_id).where(Follow.follower_user_id == current_user.id)).all()
        base = base.where(Post.account_id.in_(list(set(followed) | {own.id})))
    page = paginate_posts(
        session,
        base,
        PostFilters(
            keyword=keyword,
            tag=tag[0] if tag else None,
            tags=tuple(tag[1:]),
            people=tuple(people),
            place=place,
            metadata_key=metadata_key,
            metadata_value=metadata_value,
            metadata_match=metadata_match,
            asset_type=asset_type,
            has_assets=has_assets,
            exclude_pinned=exclude_pinned,
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
    accounts = get_accounts_by_id(session, [post.account_id for post in page.posts] + [account_id for account_id, _ in people])
    refs_by_post: dict[str, list[PostAccountRef]] = {post.id: [] for post in page.posts}
    if refs_by_post:
        for ref in session.exec(select(PostAccountRef).where(PostAccountRef.post_id.in_(refs_by_post))):
            refs_by_post[ref.post_id].append(ref)
    return PaginatedPosts(
        items=[
            build_post_with_assets(session, post, comment_counts.get(post.id, 0), accounts.get(post.account_id), people, accounts, refs_by_post[post.id])
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
    session: Session, post: Post, comment_count: int = 0,
    account: Account | None = None, people: list[tuple[str, str]] | None = None,
    matched_accounts: dict[str, Account] | None = None,
    refs: list[PostAccountRef] | None = None,
) -> PostWithAssets:
    assets = get_post_assets(session, post.id)
    post_read = PostRead.model_validate(post).model_copy(
        update={"comment_count": comment_count}
    )
    if refs is None:
        refs = list(session.exec(select(PostAccountRef).where(PostAccountRef.post_id == post.id)).all())
    tagged = [ref.account_id for ref in refs if ref.kind == "tag"]
    matches = []
    for account_id, _mode in people or []:
        reasons = (["author"] if post.account_id == account_id else []) + [ref.kind for ref in refs if ref.account_id == account_id]
        if reasons:
            matched_account = matched_accounts.get(account_id) if matched_accounts else None
            matches.append(PostSearchMatch(
                account_id=account_id,
                account_handle=matched_account.handle if matched_account else None,
                reasons=sorted(set(reasons)),
            ))
    return PostWithAssets(
        **post_read.model_dump(),
        assets=[serialize_asset(asset) for asset in assets],
        account=AccountRead.model_validate(account) if account else None,
        tagged_account_ids=tagged,
        search_matches=matches,
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
    session.flush()
    create_post_assets(session, post.id, post_create.assets)
    sync_post_mentions(session, post)
    replace_post_tags(session, post.id, post_create.tagged_account_ids)
    session.commit()
    session.refresh(post)

    assets = get_post_assets(session, post.id)
    return FeedItem(
        post=PostRead.model_validate(post),
        account=AccountRead.model_validate(account),
        assets=[serialize_asset(asset) for asset in assets],
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
    if post_update.text is not None:
        sync_post_mentions(session, post)
    if post_update.tagged_account_ids is not None:
        replace_post_tags(session, post.id, post_update.tagged_account_ids)

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

    for like in session.exec(select(PostLike).where(PostLike.post_id == post_id)).all():
        session.delete(like)

    session.exec(delete(ProfilePin).where(ProfilePin.post_id == post_id))
    session.exec(delete(PostAccountRef).where(PostAccountRef.post_id == post_id))

    session.delete(post)
    session.commit()
