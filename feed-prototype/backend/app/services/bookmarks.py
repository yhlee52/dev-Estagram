from __future__ import annotations

from typing import Iterable

from sqlmodel import Session, select

from app.models.bookmark import Bookmark


def get_bookmark(
    session: Session, user_id: str, post_id: str
) -> Bookmark | None:
    return session.exec(
        select(Bookmark).where(
            Bookmark.user_id == user_id,
            Bookmark.post_id == post_id,
        )
    ).first()


def get_bookmarked_post_ids(session: Session, user_id: str) -> list[str]:
    """All post ids the user has bookmarked (for card toggle state)."""
    return list(
        session.exec(
            select(Bookmark.post_id).where(Bookmark.user_id == user_id)
        ).all()
    )


def get_bookmarks_by_post_id(
    session: Session,
    user_id: str,
    post_ids: Iterable[str],
) -> dict[str, Bookmark]:
    """Resolve ``{post_id: Bookmark}`` for one user over the given posts in one
    query. Used to attach note/bookmarked_at to a page of bookmarked posts
    (mirrors the batch helpers in ``post_filters``)."""
    post_id_list = list(dict.fromkeys(post_ids))
    if not post_id_list:
        return {}

    bookmarks = session.exec(
        select(Bookmark).where(
            Bookmark.user_id == user_id,
            Bookmark.post_id.in_(post_id_list),
        )
    ).all()
    return {bookmark.post_id: bookmark for bookmark in bookmarks}
