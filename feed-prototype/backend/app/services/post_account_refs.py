"""Maintain account references without changing the original post text."""

from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, func
from sqlmodel import Session, select

from app.models.account import Account
from app.models.post import Post
from app.models.post_account_ref import PostAccountRef
from app.services.mentions import find_mentioned_handles


def sync_post_mentions(session: Session, post: Post) -> None:
    handles = find_mentioned_handles(post.text)
    account_ids = set()
    if handles:
        account_ids = set(session.exec(select(Account.id).where(func.lower(Account.handle).in_(handles))).all())
    existing = set(session.exec(select(PostAccountRef.account_id).where(
        PostAccountRef.post_id == post.id, PostAccountRef.kind == "mention"
    )).all())
    for account_id in existing - account_ids:
        session.exec(delete(PostAccountRef).where(
            PostAccountRef.post_id == post.id, PostAccountRef.account_id == account_id,
            PostAccountRef.kind == "mention"
        ))
    for account_id in account_ids - existing:
        session.add(PostAccountRef(id=f"post-ref-{uuid4()}", post_id=post.id, account_id=account_id, kind="mention"))


def replace_post_tags(session: Session, post_id: str, account_ids: list[str], *, allow_inactive: bool = False) -> None:
    if len(account_ids) > 5 or len(set(account_ids)) != len(account_ids):
        raise HTTPException(status_code=422, detail="Select at most five different accounts")
    accounts = session.exec(select(Account).where(Account.id.in_(account_ids))).all() if account_ids else []
    if len(accounts) != len(account_ids) or (not allow_inactive and any(account.deactivated_at is not None for account in accounts)):
        raise HTTPException(status_code=422, detail="Tagged account is unavailable")
    session.exec(delete(PostAccountRef).where(PostAccountRef.post_id == post_id, PostAccountRef.kind == "tag"))
    session.flush()
    for account_id in account_ids:
        session.add(PostAccountRef(id=f"post-ref-{uuid4()}", post_id=post_id, account_id=account_id, kind="tag"))


def rebuild_mentions_for_handles(session: Session, handles: set[str]) -> int:
    """Re-resolve raw mentions when an account is registered or its handle moves."""
    candidates: dict[str, Post] = {}
    for handle in handles:
        if not handle:
            continue
        escaped = handle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        for post in session.exec(select(Post).where(Post.text.ilike(f"%@{escaped}%", escape="\\"))):
            candidates[post.id] = post
    for post in candidates.values():
        sync_post_mentions(session, post)
    return len(candidates)
