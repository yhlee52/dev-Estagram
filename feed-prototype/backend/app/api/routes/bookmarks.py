from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.models.bookmark import Bookmark, utc_now
from app.models.post import Post
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    BookmarkedPost,
    BookmarkNoteBody,
    BookmarkRead,
    PaginatedBookmarks,
    PostAssetRead,
    PostRead,
    PostWithAssets,
    UserBookmarkIdsResponse,
)
from app.services.asset_url import serialize_asset
from app.services.bookmarks import (
    get_bookmark,
    get_bookmarked_post_ids,
    get_bookmarks_by_post_id,
)
from app.services.comments import get_comment_counts
from app.services.post_filters import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    PostFilters,
    PostPagination,
    get_accounts_by_id,
    get_assets_by_post_id,
    paginate_posts,
)


router = APIRouter(tags=["bookmarks"])


def _require_self(current_user: User, user_id: str) -> None:
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot access another user's bookmarks"
        )


def _require_post(session: Session, post_id: str) -> None:
    if session.get(Post, post_id) is None:
        raise HTTPException(status_code=404, detail="Post not found")


@router.get(
    "/api/users/{user_id}/bookmark-ids", response_model=UserBookmarkIdsResponse
)
def list_user_bookmark_ids(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserBookmarkIdsResponse:
    _require_self(current_user, user_id)
    return UserBookmarkIdsResponse(
        user_id=user_id,
        post_ids=get_bookmarked_post_ids(session, user_id),
    )


@router.get("/api/users/{user_id}/bookmarks", response_model=PaginatedBookmarks)
def list_user_bookmarks(
    user_id: str,
    keyword: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    metadata_key: str | None = Query(default=None),
    metadata_value: str | None = Query(default=None),
    metadata_match: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    account_handle: str | None = Query(default=None),
    created_at_from: str | None = Query(default=None),
    created_at_to: str | None = Query(default=None),
    sort: str = Query(default="newest"),
    sort_metadata_key: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PaginatedBookmarks:
    _require_self(current_user, user_id)

    # The bookmark list is just "the posts this user bookmarked" filtered/sorted
    # with the regular post machinery (v0.4.x facets/sorts reused).
    bookmarked_select = select(Post).where(
        Post.id.in_(select(Bookmark.post_id).where(Bookmark.user_id == user_id))
    )
    page = paginate_posts(
        session,
        bookmarked_select,
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
            created_at_from=created_at_from,
            created_at_to=created_at_to,
        ),
        PostPagination(
            sort=sort, cursor=cursor, limit=limit, sort_metadata_key=sort_metadata_key
        ),
    )

    post_ids = [post.id for post in page.posts]
    assets_by_post_id = get_assets_by_post_id(session, post_ids)
    comment_counts = get_comment_counts(session, post_ids)
    bookmarks_by_post_id = get_bookmarks_by_post_id(session, user_id, post_ids)
    accounts_by_id = get_accounts_by_id(session, [post.account_id for post in page.posts])

    items: list[BookmarkedPost] = []
    for post in page.posts:
        bookmark = bookmarks_by_post_id.get(post.id)
        account = accounts_by_id.get(post.account_id)
        if bookmark is None or account is None:
            continue
        post_read = PostRead.model_validate(post).model_copy(
            update={"comment_count": comment_counts.get(post.id, 0)}
        )
        items.append(
            BookmarkedPost(
                post=PostWithAssets(
                    **post_read.model_dump(),
                    assets=[
                        serialize_asset(asset)
                        for asset in assets_by_post_id.get(post.id, [])
                    ],
                ),
                account=AccountRead.model_validate(account),
                note=bookmark.note,
                bookmarked_at=bookmark.created_at,
            )
        )

    return PaginatedBookmarks(
        items=items, next_cursor=page.next_cursor, has_more=page.has_more
    )


@router.get(
    "/api/users/{user_id}/bookmarks/{post_id}", response_model=BookmarkRead
)
def get_user_bookmark(
    user_id: str,
    post_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Bookmark:
    _require_self(current_user, user_id)
    bookmark = get_bookmark(session, user_id, post_id)
    if bookmark is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    return bookmark


@router.post(
    "/api/users/{user_id}/bookmarks/{post_id}", response_model=BookmarkRead
)
def add_bookmark(
    user_id: str,
    post_id: str,
    body: BookmarkNoteBody = Body(default_factory=BookmarkNoteBody),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Bookmark:
    _require_self(current_user, user_id)
    _require_post(session, post_id)

    existing = get_bookmark(session, user_id, post_id)
    if existing is not None:
        # Idempotent add: update the note only when one was provided.
        if body.note is not None:
            existing.note = body.note
            session.add(existing)
            session.commit()
            session.refresh(existing)
        return existing

    bookmark = Bookmark(
        id=f"bookmark-{uuid4()}",
        user_id=user_id,
        post_id=post_id,
        note=body.note,
    )
    session.add(bookmark)
    session.commit()
    session.refresh(bookmark)
    return bookmark


@router.patch(
    "/api/users/{user_id}/bookmarks/{post_id}", response_model=BookmarkRead
)
def update_bookmark_note(
    user_id: str,
    post_id: str,
    body: BookmarkNoteBody = Body(default_factory=BookmarkNoteBody),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Bookmark:
    _require_self(current_user, user_id)
    bookmark = get_bookmark(session, user_id, post_id)
    if bookmark is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    bookmark.note = body.note
    session.add(bookmark)
    session.commit()
    session.refresh(bookmark)
    return bookmark


@router.delete(
    "/api/users/{user_id}/bookmarks/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_bookmark(
    user_id: str,
    post_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_self(current_user, user_id)
    bookmark = get_bookmark(session, user_id, post_id)
    if bookmark is not None:
        session.delete(bookmark)
        session.commit()
