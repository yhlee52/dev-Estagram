import base64
import binascii
import unicodedata
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func
from sqlmodel import Session, col, select

from app.api.deps import get_current_user, get_session
from app.models.account import Account, utc_now
from app.models.follow import Follow
from app.models.asset import PostAsset
from app.models.post import Post
from app.models.profile_pin import ProfilePin
from app.models.user import User
from app.schemas.feed import (
    AccountProfileUpdate,
    AccountRead,
    AccountSearchItem,
    AccountSearchPage,
    AccountSummary,
    AccountRelationPage,
    PinnedPostsUpdate,
    PostAssetRead,
    PostRead,
    PostWithAssets,
)
from app.services.asset_url import serialize_asset
from app.services.auth import revoke_user_sessions
from app.services.comments import get_comment_counts
from app.services.post_filters import PostFilters, apply_filters_to_select


router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("/search", response_model=AccountSearchPage)
def search_accounts(
    keyword: str = Query(default=""),
    sort: str = Query(default="handle"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> AccountSearchPage:
    if sort not in {"handle", "recent", "post_count"}:
        raise HTTPException(status_code=400, detail="Invalid account sort")
    try:
        offset = int(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()) if cursor else 0
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc
    if offset < 0:
        raise HTTPException(status_code=400, detail="Invalid cursor")

    count = func.count(Post.id).label("post_count")
    last = func.max(Post.created_at).label("last_post_at")
    statement = (
        select(Account, count, last)
        .outerjoin(Post, Post.account_id == Account.id)
        .where(col(Account.deactivated_at).is_(None))
        .group_by(Account.id)
    )
    term = unicodedata.normalize("NFC", keyword.strip())
    if term.startswith("@"):
        term = term[1:]
    if term:
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        statement = statement.where(
            col(Account.handle).ilike(pattern, escape="\\")
            | col(Account.display_name).ilike(pattern, escape="\\")
        )
    if sort == "recent":
        statement = statement.order_by(last.desc().nullslast(), Account.id)
    elif sort == "post_count":
        statement = statement.order_by(count.desc(), Account.id)
    else:
        statement = statement.order_by(Account.handle, Account.id)
    rows = session.exec(statement.offset(offset).limit(limit + 1)).all()
    has_more = len(rows) > limit
    items = [
        AccountSearchItem(
            account=AccountRead.model_validate(account),
            post_count=post_count,
            last_post_at=last_post_at,
        )
        for account, post_count, last_post_at in rows[:limit]
    ]
    next_cursor = (
        base64.urlsafe_b64encode(str(offset + limit).encode()).decode().rstrip("=")
        if has_more else None
    )
    return AccountSearchPage(items=items, next_cursor=next_cursor, has_more=has_more)


@router.get("", response_model=list[AccountRead])
def list_accounts(
    include_deactivated: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> list[Account]:
    # Discovery hides deactivated accounts (v0.6.4); their posts stay visible
    # elsewhere. include_deactivated is an explicit opt-in escape hatch.
    statement = select(Account).order_by(Account.handle)
    if not include_deactivated:
        statement = statement.where(col(Account.deactivated_at).is_(None))
    return list(session.exec(statement).all())


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: str, session: Session = Depends(get_session)) -> Account:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    return account


@router.get("/{account_id}/summary", response_model=AccountSummary)
def get_account_summary(
    account_id: str,
    session: Session = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> AccountSummary:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    post_count, last_post_at = session.exec(
        select(func.count(Post.id), func.max(Post.created_at)).where(Post.account_id == account_id)
    ).one()
    follower_count = session.exec(
        select(func.count(Follow.id)).where(Follow.following_account_id == account_id)
    ).one()
    following_count = session.exec(
        select(func.count(Follow.id)).where(Follow.follower_user_id == account.user_id)
    ).one()
    return AccountSummary(
        post_count=post_count,
        follower_count=follower_count,
        following_count=following_count,
        last_post_at=last_post_at,
    )


def _relation_page(
    session: Session, account: Account, kind: str, cursor: str | None, limit: int
) -> AccountRelationPage:
    try:
        offset = int(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()) if cursor else 0
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc
    if offset < 0:
        raise HTTPException(status_code=400, detail="Invalid cursor")
    statement = select(Account).join(
        Follow,
        Follow.follower_user_id == Account.user_id if kind == "followers"
        else Follow.following_account_id == Account.id,
    )
    if kind == "followers":
        statement = statement.where(Follow.following_account_id == account.id)
    else:
        statement = statement.where(Follow.follower_user_id == account.user_id)
    rows = session.exec(statement.order_by(Account.handle, Account.id).offset(offset).limit(limit + 1)).all()
    has_more = len(rows) > limit
    return AccountRelationPage(
        items=[AccountRead.model_validate(row) for row in rows[:limit]],
        next_cursor=base64.urlsafe_b64encode(str(offset + limit).encode()).decode().rstrip("=") if has_more else None,
        has_more=has_more,
    )


@router.get("/{account_id}/followers", response_model=AccountRelationPage)
def get_account_followers(
    account_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> AccountRelationPage:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return _relation_page(session, account, "followers", cursor, limit)


@router.get("/{account_id}/following", response_model=AccountRelationPage)
def get_account_following(
    account_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> AccountRelationPage:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return _relation_page(session, account, "following", cursor, limit)


def _pinned_posts(session: Session, account_id: str) -> list[PostWithAssets]:
    pins = session.exec(
        select(ProfilePin).where(ProfilePin.account_id == account_id).order_by(ProfilePin.position)
    ).all()
    posts = [session.get(Post, pin.post_id) for pin in pins]
    valid = [post for post in posts if post is not None and post.account_id == account_id]
    counts = get_comment_counts(session, [post.id for post in valid])
    return [build_post_with_assets(session, post, counts.get(post.id, 0)) for post in valid]


@router.get("/{account_id}/pinned-posts", response_model=list[PostWithAssets])
def get_pinned_posts(
    account_id: str,
    session: Session = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> list[PostWithAssets]:
    if session.get(Account, account_id) is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return _pinned_posts(session, account_id)


@router.put("/{account_id}/pinned-posts", response_model=list[PostWithAssets])
def replace_pinned_posts(
    account_id: str,
    payload: PinnedPostsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[PostWithAssets]:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Account is not owned by user")
    if len(set(payload.post_ids)) != len(payload.post_ids):
        raise HTTPException(status_code=422, detail="Duplicate pinned post")
    for post_id in payload.post_ids:
        post = session.get(Post, post_id)
        if post is None:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.account_id != account_id:
            raise HTTPException(status_code=403, detail="Post is not owned by account")
    session.exec(delete(ProfilePin).where(ProfilePin.account_id == account_id))
    session.flush()
    for position, post_id in enumerate(payload.post_ids):
        session.add(ProfilePin(id=f"pin-{uuid4()}", account_id=account_id, post_id=post_id, position=position))
    session.commit()
    return _pinned_posts(session, account_id)


@router.patch("/{account_id}", response_model=AccountRead)
def update_account_profile(
    account_id: str,
    profile_update: AccountProfileUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Account:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Account is not owned by user")

    if profile_update.display_name is not None:
        account.display_name = profile_update.display_name
    if "bio" in profile_update.model_fields_set:
        account.bio = profile_update.bio
    if "avatar_url" in profile_update.model_fields_set:
        account.avatar_url = profile_update.avatar_url
    if "cover_url" in profile_update.model_fields_set:
        account.cover_url = profile_update.cover_url
    if "profile_links" in profile_update.model_fields_set:
        account.profile_links = profile_update.profile_links or []

    account.profile_source = "user"
    account.updated_at = utc_now()
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.post("/{account_id}/deactivate", response_model=AccountRead)
def deactivate_account(
    account_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Account:
    """Soft-deactivate the owner's 1:1 account (v0.6.4).

    Posts and collaboration data are preserved; the account is hidden from
    discovery and its user can no longer log in. All of the user's sessions are
    revoked so any current login stops immediately. Idempotent: re-deactivating
    keeps the original timestamp. Reactivation is operator-only
    (scripts/reactivate_user.py).
    """
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Account is not owned by user")

    if account.deactivated_at is None:
        account.deactivated_at = utc_now()
        account.updated_at = utc_now()
        session.add(account)

    revoke_user_sessions(session, account.user_id)
    session.commit()
    session.refresh(account)
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
    post_read = PostRead.model_validate(post).model_copy(
        update={"comment_count": comment_count}
    )
    return PostWithAssets(
        **post_read.model_dump(),
        assets=[
            serialize_asset(asset)
            for asset in get_post_assets(session, post.id)
        ],
    )


@router.get("/{account_id}/posts", response_model=list[PostWithAssets])
def list_account_posts(
    account_id: str,
    keyword: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    metadata_key: str | None = Query(default=None),
    metadata_value: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    my_posts_only: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> list[PostWithAssets]:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    statement, _ = apply_filters_to_select(
        session,
        select(Post).where(Post.account_id == account_id),
        PostFilters(
            keyword=keyword,
            tag=tag,
            metadata_key=metadata_key,
            metadata_value=metadata_value,
            asset_type=asset_type,
            user_id=user_id,
            my_posts_only=my_posts_only,
        ),
    )
    if statement is None:
        return []

    posts = list(
        session.exec(
            statement.order_by(col(Post.created_at).desc(), col(Post.id).desc())
        ).all()
    )
    comment_counts = get_comment_counts(session, [post.id for post in posts])
    return [
        build_post_with_assets(session, post, comment_counts.get(post.id, 0))
        for post in posts
    ]
