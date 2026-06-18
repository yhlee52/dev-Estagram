"""Comments regression check (v0.5.0).

Exercises the comment CRUD end-to-end via FastAPI TestClient against a real DB
(writes + reads), then cleans up everything it created.

Covers:
1. POST /api/posts/{id}/comments creates a comment with author identity; empty
   text is rejected (422).
2. GET /api/posts/{id}/comments returns comments oldest-first / newest-first.
3. PATCH /api/comments/{id} edits only for the author (others get 403) and bumps
   updated_at.
4. DELETE /api/comments/{id} deletes only for the author (others get 403).
5. The post's derived comment_count reflects the current number of comments.

Two accounts are seeded so the import creates two generated users; one authors
the comments, the other is used for the not-the-author 403 checks.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_comments

This WRITES to the DB and then deletes the rows it created (unique ids). Exit
code is non-zero if any check fails.
"""

from __future__ import annotations

import sys
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import select

from app.db.session import create_session
from app.main import app
from app.models.account import Account
from app.models.auth import UserCredential, UserSession
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import generated_user_id


SUFFIX = uuid4().hex[:8]
ACCT_EXT = f"check-comment-acct-{SUFFIX}"
OTHER_ACCT_EXT = f"check-comment-other-{SUFFIX}"
BATCH = f"check-comment-batch-{SUFFIX}"
POST_EXT = f"check-comment-post-{SUFFIX}"

USER_A = generated_user_id(ACCT_EXT)  # comment author
USER_B = generated_user_id(OTHER_ACCT_EXT)  # not the author


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_comments"},
        "accounts": [
            {
                "external_id": ACCT_EXT,
                "handle": f"checkcomment{SUFFIX}",
                "display_name": "Comment Author",
            },
            {
                "external_id": OTHER_ACCT_EXT,
                "handle": f"checkother{SUFFIX}",
                "display_name": "Other User",
            },
        ],
        "posts": [
            {
                "external_id": POST_EXT,
                "account_external_id": ACCT_EXT,
                "title": "Comment target post",
                "text": "regression",
            }
        ],
    }


def resolve_post_id() -> str:
    with create_session() as session:
        post = session.exec(select(Post).where(Post.external_id == POST_EXT)).first()
        if post is None:
            raise RuntimeError("seed post not found")
        return post.id


def run_checks(client: TestClient) -> list[str]:
    failures: list[str] = []

    def check(condition: bool, message: str) -> None:
        if condition:
            print(f"OK: {message}")
        else:
            failures.append(message)
            print(f"FAILED: {message}", file=sys.stderr)

    created = client.post("/api/imports", json=payload())
    check(created.status_code == 200, f"seed import returns 200 (got {created.status_code})")

    post_id = resolve_post_id()

    # 1) create a first comment as the author.
    first = client.post(
        f"/api/posts/{post_id}/comments",
        json={"user_id": USER_A, "text": "first comment"},
    )
    check(first.status_code == 201, f"create comment returns 201 (got {first.status_code})")
    first_body = first.json()
    first_id = first_body["comment"]["id"]
    check(
        first_body["author"]["display_name"] == "Comment Author",
        "created comment carries author identity",
    )

    # empty text is rejected.
    empty = client.post(
        f"/api/posts/{post_id}/comments", json={"user_id": USER_A, "text": "   "}
    )
    check(empty.status_code == 422, f"empty comment text returns 422 (got {empty.status_code})")

    # 2) second comment, then ordering checks.
    second = client.post(
        f"/api/posts/{post_id}/comments",
        json={"user_id": USER_A, "text": "second comment"},
    )
    check(second.status_code == 201, "create second comment returns 201")
    second_id = second.json()["comment"]["id"]

    oldest = client.get(f"/api/posts/{post_id}/comments?sort=oldest")
    check(oldest.status_code == 200, "list comments (oldest) returns 200")
    oldest_ids = [item["comment"]["id"] for item in oldest.json()["items"]]
    check(oldest_ids == [first_id, second_id], "oldest-first ordering is [first, second]")

    newest = client.get(f"/api/posts/{post_id}/comments?sort=newest")
    newest_ids = [item["comment"]["id"] for item in newest.json()["items"]]
    check(newest_ids == [second_id, first_id], "newest-first ordering is [second, first]")

    # comment_count is reflected on the post.
    post_detail = client.get(f"/api/posts/{post_id}")
    check(
        post_detail.json().get("comment_count") == 2,
        f"post comment_count is 2 (got {post_detail.json().get('comment_count')})",
    )

    # 3) edit: not-the-author 403, author 200 + updated_at bump.
    forbidden_edit = client.patch(
        f"/api/comments/{first_id}", json={"user_id": USER_B, "text": "hijack"}
    )
    check(
        forbidden_edit.status_code == 403,
        f"editing another user's comment returns 403 (got {forbidden_edit.status_code})",
    )

    edited = client.patch(
        f"/api/comments/{first_id}", json={"user_id": USER_A, "text": "edited first"}
    )
    check(edited.status_code == 200, "author edit returns 200")
    edited_body = edited.json()["comment"]
    check(edited_body["text"] == "edited first", "edited comment text is updated")
    check(
        edited_body["updated_at"] != edited_body["created_at"],
        "edited comment bumps updated_at",
    )

    # 4) delete: not-the-author 403, author 204.
    forbidden_delete = client.delete(f"/api/comments/{second_id}?user_id={USER_B}")
    check(
        forbidden_delete.status_code == 403,
        f"deleting another user's comment returns 403 (got {forbidden_delete.status_code})",
    )

    deleted = client.delete(f"/api/comments/{second_id}?user_id={USER_A}")
    check(deleted.status_code == 204, f"author delete returns 204 (got {deleted.status_code})")

    remaining = client.get(f"/api/posts/{post_id}/comments")
    remaining_ids = [item["comment"]["id"] for item in remaining.json()["items"]]
    check(remaining_ids == [first_id], "deleted comment is gone, first remains")

    post_after = client.get(f"/api/posts/{post_id}")
    check(
        post_after.json().get("comment_count") == 1,
        f"post comment_count is 1 after delete (got {post_after.json().get('comment_count')})",
    )

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        post = session.exec(select(Post).where(Post.external_id == POST_EXT)).first()
        if post is not None:
            for comment in session.exec(
                select(Comment).where(Comment.post_id == post.id)
            ).all():
                session.delete(comment)
            session.delete(post)

        for acct_ext in (ACCT_EXT, OTHER_ACCT_EXT):
            account = session.exec(
                select(Account).where(Account.external_id == acct_ext)
            ).first()
            if account is not None:
                session.delete(account)

            user_id = generated_user_id(acct_ext)
            credential = session.get(UserCredential, user_id)
            if credential is not None:
                session.delete(credential)
            for auth_session in session.exec(
                select(UserSession).where(UserSession.user_id == user_id)
            ).all():
                session.delete(auth_session)
            session.flush()

            user = session.get(User, user_id)
            if user is not None:
                session.delete(user)

        from app.models.import_batch import ImportBatch

        batch = session.exec(
            select(ImportBatch).where(ImportBatch.external_id == BATCH)
        ).first()
        if batch is not None:
            session.delete(batch)

        session.commit()


def main() -> int:
    try:
        with TestClient(app) as client:
            failures = run_checks(client)
    finally:
        cleanup()

    if failures:
        print("\nComments check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nComments check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
