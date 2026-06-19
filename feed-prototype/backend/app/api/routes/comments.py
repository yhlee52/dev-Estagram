from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, col, select

from app.api.deps import get_current_user, get_session
from app.models.account import Account
from app.models.comment import Comment, utc_now
from app.models.post import Post
from app.models.user import User
from app.schemas.feed import (
    CommentCreate,
    CommentListResponse,
    CommentUpdate,
    CommentWithAuthor,
)
from app.services.comments import build_comment_with_author, get_comment_authors
from app.services.post_filters import get_user_account_id


router = APIRouter(tags=["comments"])

ALLOWED_COMMENT_SORTS = {"oldest", "newest"}


def _get_post_or_404(session: Session, post_id: str) -> Post:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    return post


def _get_author_account(session: Session, user_id: str) -> Account:
    # Reuses the validated user/account resolution (404 on missing user or
    # account); the id always points at a real account, so the get is safe.
    return session.get(Account, get_user_account_id(session, user_id))


@router.get("/api/posts/{post_id}/comments", response_model=CommentListResponse)
def list_post_comments(
    post_id: str,
    sort: str = Query(default="oldest"),
    session: Session = Depends(get_session),
) -> CommentListResponse:
    _get_post_or_404(session, post_id)

    sort_value = (sort or "oldest").strip().lower()
    if sort_value not in ALLOWED_COMMENT_SORTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid sort. Expected one of: "
            + ", ".join(sorted(ALLOWED_COMMENT_SORTS)),
        )

    statement = select(Comment).where(Comment.post_id == post_id)
    if sort_value == "newest":
        statement = statement.order_by(col(Comment.created_at).desc(), col(Comment.id).desc())
    else:
        statement = statement.order_by(col(Comment.created_at).asc(), col(Comment.id).asc())

    comments = list(session.exec(statement).all())
    authors = get_comment_authors(session, [c.author_user_id for c in comments])

    items = [
        build_comment_with_author(comment, authors[comment.author_user_id])
        for comment in comments
        if comment.author_user_id in authors
    ]
    return CommentListResponse(items=items)


@router.post(
    "/api/posts/{post_id}/comments",
    response_model=CommentWithAuthor,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: str,
    comment_create: CommentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CommentWithAuthor:
    _get_post_or_404(session, post_id)
    account = _get_author_account(session, current_user.id)

    comment = Comment(
        id=f"comment-{uuid4()}",
        post_id=post_id,
        author_user_id=current_user.id,
        text=comment_create.text,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)

    return build_comment_with_author(comment, account)


@router.patch("/api/comments/{comment_id}", response_model=CommentWithAuthor)
def update_comment(
    comment_id: str,
    comment_update: CommentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CommentWithAuthor:
    comment = session.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the author can edit this comment"
        )

    comment.text = comment_update.text
    comment.updated_at = utc_now()
    session.add(comment)
    session.commit()
    session.refresh(comment)

    account = _get_author_account(session, comment.author_user_id)
    return build_comment_with_author(comment, account)


@router.delete(
    "/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_comment(
    comment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    comment = session.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the author can delete this comment"
        )

    session.delete(comment)
    session.commit()
