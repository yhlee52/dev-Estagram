from __future__ import annotations

from typing import Iterable

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.account import Account
from app.models.comment import Comment
from app.schemas.feed import AccountRead, CommentRead, CommentWithAuthor


def get_comment_counts(
    session: Session,
    post_ids: Iterable[str],
) -> dict[str, int]:
    """Return ``{post_id: comment_count}`` for the given posts in one query.

    Mirrors the batch helpers in ``post_filters`` (e.g. ``get_assets_by_post_id``)
    so the list builders avoid an N+1. Posts with no comments are absent from the
    map; callers default to 0.
    """
    post_id_list = list(dict.fromkeys(post_ids))
    if not post_id_list:
        return {}

    rows = session.exec(
        select(Comment.post_id, func.count())
        .where(Comment.post_id.in_(post_id_list))
        .group_by(Comment.post_id)
    ).all()

    return {post_id: count for post_id, count in rows}


def get_comment_authors(
    session: Session,
    author_user_ids: Iterable[str],
) -> dict[str, Account]:
    """Resolve each author user id to its account (1:1 User:Account).

    Used to attach author identity to comments. A comment whose author has no
    account is dropped by the caller (mirrors the follows account-resolution).
    """
    user_id_list = list(dict.fromkeys(author_user_ids))
    if not user_id_list:
        return {}

    accounts = session.exec(
        select(Account).where(Account.user_id.in_(user_id_list))
    ).all()
    return {account.user_id: account for account in accounts}


def build_comment_with_author(
    comment: Comment,
    account: Account,
) -> CommentWithAuthor:
    return CommentWithAuthor(
        comment=CommentRead.model_validate(comment),
        author=AccountRead.model_validate(account),
    )
