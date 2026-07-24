from __future__ import annotations

import base64
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models.account import Account
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.notification_state import NotificationState, utc_now
from app.models.post import Post
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    CommentRead,
    NotificationItem,
    NotificationReadState,
    PaginatedNotifications,
    PostAssetRead,
    PostRead,
    PostWithAssets,
)
from app.services.asset_url import serialize_asset
from app.services.comments import get_comment_authors, get_comment_counts
from app.services.mentions import mentions_handle
from app.services.post_filters import get_accounts_by_id, get_assets_by_post_id


DEFAULT_NOTIFICATION_LIMIT = 20
MAX_NOTIFICATION_LIMIT = 50

REASON_FOLLOWED_POST = "followed_post"
REASON_OWN_POST_COMMENT = "own_post_comment"
REASON_MENTION = "mention"


@dataclass
class DerivedNotification:
    source_key: str
    source_type: str
    source_id: str
    post_id: str
    created_at: datetime
    reasons: set[str] = field(default_factory=set)
    comment_id: str | None = None


def _encode_cursor(item: DerivedNotification) -> str:
    raw = f"{item.created_at.isoformat()}|{item.source_key}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        created_at_raw, source_key = raw.rsplit("|", 1)
        return datetime.fromisoformat(created_at_raw), source_key
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc


def _comparable_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _normalize_limit(limit: int) -> int:
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be at least 1")
    return min(limit, MAX_NOTIFICATION_LIMIT)


def _require_user_account(session: Session, user_id: str) -> Account:
    if session.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    account = session.exec(select(Account).where(Account.user_id == user_id)).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found for user")

    return account


def get_notification_state(
    session: Session,
    user_id: str,
) -> NotificationState | None:
    return session.get(NotificationState, user_id)


def _add_notification(
    items_by_key: dict[str, DerivedNotification],
    *,
    source_type: str,
    source_id: str,
    post_id: str,
    created_at: datetime,
    reason: str,
    comment_id: str | None = None,
) -> None:
    source_key = f"{source_type}:{source_id}"
    item = items_by_key.get(source_key)
    if item is None:
        item = DerivedNotification(
            source_key=source_key,
            source_type=source_type,
            source_id=source_id,
            post_id=post_id,
            created_at=created_at,
            comment_id=comment_id,
        )
        items_by_key[source_key] = item

    item.reasons.add(reason)


def _followed_account_ids(session: Session, user_id: str) -> list[str]:
    return list(
        session.exec(
            select(Follow.following_account_id).where(Follow.follower_user_id == user_id)
        ).all()
    )


def _derive_notification_sources(
    session: Session,
    user_id: str,
    account: Account,
) -> list[DerivedNotification]:
    items_by_key: dict[str, DerivedNotification] = {}

    followed_account_ids = _followed_account_ids(session, user_id)
    if followed_account_ids:
        followed_posts = session.exec(
            select(Post).where(
                Post.account_id.in_(followed_account_ids),
                Post.account_id != account.id,
            )
        ).all()
        for post in followed_posts:
            _add_notification(
                items_by_key,
                source_type="post",
                source_id=post.id,
                post_id=post.id,
                created_at=post.created_at,
                reason=REASON_FOLLOWED_POST,
            )

    own_post_comments = session.exec(
        select(Comment).where(
            col(Comment.post_id).in_(
                select(Post.id).where(Post.account_id == account.id)
            ),
            Comment.author_user_id != user_id,
        )
    ).all()
    for comment in own_post_comments:
        _add_notification(
            items_by_key,
            source_type="comment",
            source_id=comment.id,
            post_id=comment.post_id,
            created_at=comment.created_at,
            reason=REASON_OWN_POST_COMMENT,
            comment_id=comment.id,
        )

    handle_pattern = f"%@{account.handle}%"
    mentioned_posts = session.exec(
        select(Post).where(
            col(Post.text).ilike(handle_pattern),
            Post.account_id != account.id,
        )
    ).all()
    for post in mentioned_posts:
        if mentions_handle(post.text, account.handle):
            _add_notification(
                items_by_key,
                source_type="post",
                source_id=post.id,
                post_id=post.id,
                created_at=post.created_at,
                reason=REASON_MENTION,
            )

    mentioned_comments = session.exec(
        select(Comment).where(
            col(Comment.text).ilike(handle_pattern),
            Comment.author_user_id != user_id,
        )
    ).all()
    for comment in mentioned_comments:
        if mentions_handle(comment.text, account.handle):
            _add_notification(
                items_by_key,
                source_type="comment",
                source_id=comment.id,
                post_id=comment.post_id,
                created_at=comment.created_at,
                reason=REASON_MENTION,
                comment_id=comment.id,
            )

    return sorted(
        items_by_key.values(),
        key=lambda item: (_comparable_datetime(item.created_at), item.source_key),
        reverse=True,
    )


def _is_read(item: DerivedNotification, last_read_at: datetime | None) -> bool:
    return last_read_at is not None and _comparable_datetime(
        item.created_at
    ) <= _comparable_datetime(last_read_at)


def _apply_cursor(
    items: list[DerivedNotification],
    cursor: str | None,
) -> list[DerivedNotification]:
    if cursor is None:
        return items

    cursor_created_at, cursor_source_key = _decode_cursor(cursor)
    cursor_created_at = _comparable_datetime(cursor_created_at)
    return [
        item
        for item in items
        if (_comparable_datetime(item.created_at), item.source_key)
        < (cursor_created_at, cursor_source_key)
    ]


def _comments_by_id(session: Session, comment_ids: Iterable[str]) -> dict[str, Comment]:
    comment_id_list = list(dict.fromkeys(comment_ids))
    if not comment_id_list:
        return {}

    comments = session.exec(
        select(Comment).where(Comment.id.in_(comment_id_list))
    ).all()
    return {comment.id: comment for comment in comments}


def _build_post_with_assets(
    post: Post,
    assets_by_post_id: dict[str, list],
    comment_counts: dict[str, int],
) -> PostWithAssets:
    post_read = PostRead.model_validate(post).model_copy(
        update={"comment_count": comment_counts.get(post.id, 0)}
    )
    return PostWithAssets(
        **post_read.model_dump(),
        assets=[
            serialize_asset(asset)
            for asset in assets_by_post_id.get(post.id, [])
        ],
    )


def _build_notification_items(
    session: Session,
    items: list[DerivedNotification],
    *,
    last_read_at: datetime | None,
) -> list[NotificationItem]:
    post_ids = [item.post_id for item in items]
    posts = session.exec(select(Post).where(Post.id.in_(post_ids))).all() if post_ids else []
    posts_by_id = {post.id: post for post in posts}
    assets_by_post_id = get_assets_by_post_id(session, post_ids)
    comment_counts = get_comment_counts(session, post_ids)
    accounts_by_id = get_accounts_by_id(session, [post.account_id for post in posts])

    comment_ids = [item.comment_id for item in items if item.comment_id is not None]
    comments_by_id = _comments_by_id(session, comment_ids)
    comment_authors = get_comment_authors(
        session, [comment.author_user_id for comment in comments_by_id.values()]
    )

    response_items: list[NotificationItem] = []
    for item in items:
        post = posts_by_id.get(item.post_id)
        if post is None:
            continue
        account = accounts_by_id.get(post.account_id)
        if account is None:
            continue

        comment = comments_by_id.get(item.comment_id) if item.comment_id else None
        comment_author = (
            comment_authors.get(comment.author_user_id) if comment is not None else None
        )

        response_items.append(
            NotificationItem(
                id=item.source_key,
                source_type=item.source_type,
                source_id=item.source_id,
                reasons=sorted(item.reasons),
                created_at=item.created_at,
                is_read=_is_read(item, last_read_at),
                post=_build_post_with_assets(post, assets_by_post_id, comment_counts),
                account=AccountRead.model_validate(account),
                comment=CommentRead.model_validate(comment) if comment is not None else None,
                comment_author=(
                    AccountRead.model_validate(comment_author)
                    if comment_author is not None
                    else None
                ),
            )
        )

    return response_items


def list_notifications(
    session: Session,
    user_id: str,
    *,
    cursor: str | None = None,
    limit: int = DEFAULT_NOTIFICATION_LIMIT,
    unread_only: bool = False,
) -> PaginatedNotifications:
    account = _require_user_account(session, user_id)
    state = get_notification_state(session, user_id)
    last_read_at = state.last_read_at if state is not None else None
    limit = _normalize_limit(limit)

    all_items = _derive_notification_sources(session, user_id, account)
    unread_count = sum(1 for item in all_items if not _is_read(item, last_read_at))
    visible_items = [
        item for item in all_items if not _is_read(item, last_read_at)
    ] if unread_only else all_items
    visible_items = _apply_cursor(visible_items, cursor)

    page_items = visible_items[: limit + 1]
    has_more = len(page_items) > limit
    page_items = page_items[:limit]
    next_cursor = _encode_cursor(page_items[-1]) if has_more and page_items else None

    return PaginatedNotifications(
        items=_build_notification_items(session, page_items, last_read_at=last_read_at),
        unread_count=unread_count,
        last_read_at=last_read_at,
        next_cursor=next_cursor,
        has_more=has_more,
    )


def mark_all_notifications_read(
    session: Session,
    user_id: str,
) -> NotificationReadState:
    _require_user_account(session, user_id)

    now = utc_now()
    state = get_notification_state(session, user_id)
    if state is None:
        state = NotificationState(user_id=user_id, last_read_at=now, updated_at=now)
    else:
        state.last_read_at = now
        state.updated_at = now

    session.add(state)
    session.commit()
    session.refresh(state)

    return NotificationReadState(
        user_id=user_id,
        unread_count=0,
        last_read_at=state.last_read_at,
    )
