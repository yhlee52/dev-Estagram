"""Notifications regression check (v0.5.2).

Exercises the derived in-app notifications API via FastAPI TestClient against a
real DB, then cleans up everything it created.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_notifications
"""

from __future__ import annotations

import sys
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import select

from app.db.session import create_session
from app.main import app
from app.models.account import Account
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.import_batch import ImportBatch
from app.models.notification_state import NotificationState
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import generated_user_id


SUFFIX = uuid4().hex[:8]
MY_ACCT_EXT = f"check-notify-me-{SUFFIX}"
FOLLOWED_ACCT_EXT = f"check-notify-followed-{SUFFIX}"
OTHER_ACCT_EXT = f"check-notify-other-{SUFFIX}"
BATCH = f"check-notify-batch-{SUFFIX}"
MY_POST_EXT = f"check-notify-my-post-{SUFFIX}"
FOLLOWED_POST_EXT = f"check-notify-followed-post-{SUFFIX}"
OTHER_POST_EXT = f"check-notify-other-post-{SUFFIX}"

USER = generated_user_id(MY_ACCT_EXT)
USER_OTHER = generated_user_id(OTHER_ACCT_EXT)
MY_HANDLE = f"notifme{SUFFIX}"


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_notifications"},
        "accounts": [
            {
                "external_id": MY_ACCT_EXT,
                "handle": MY_HANDLE,
                "display_name": "Notification Owner",
            },
            {
                "external_id": FOLLOWED_ACCT_EXT,
                "handle": f"notifbot{SUFFIX}",
                "display_name": "Followed Bot",
            },
            {
                "external_id": OTHER_ACCT_EXT,
                "handle": f"notifother{SUFFIX}",
                "display_name": "Other Person",
            },
        ],
        "posts": [
            {
                "external_id": MY_POST_EXT,
                "account_external_id": MY_ACCT_EXT,
                "title": "My notification target",
                "text": "owned post",
            },
            {
                "external_id": FOLLOWED_POST_EXT,
                "account_external_id": FOLLOWED_ACCT_EXT,
                "title": "Followed post mentioning me",
                "text": f"please review @{MY_HANDLE}",
            },
            {
                "external_id": OTHER_POST_EXT,
                "account_external_id": OTHER_ACCT_EXT,
                "title": "Other post",
                "text": f"email user@{MY_HANDLE} should not count",
            },
        ],
    }


def resolve_ids() -> tuple[str, str, str]:
    with create_session() as session:
        followed = session.exec(
            select(Account).where(Account.external_id == FOLLOWED_ACCT_EXT)
        ).first()
        my_post = session.exec(select(Post).where(Post.external_id == MY_POST_EXT)).first()
        other_post = session.exec(
            select(Post).where(Post.external_id == OTHER_POST_EXT)
        ).first()
        if followed is None or my_post is None or other_post is None:
            raise RuntimeError("seed rows not found")
        return followed.id, my_post.id, other_post.id


def notification_items(client: TestClient) -> list[dict]:
    response = client.get(f"/api/users/{USER}/notifications")
    if response.status_code != 200:
        raise RuntimeError(f"notifications request failed: {response.status_code}")
    return response.json()["items"]


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

    followed_account_id, my_post_id, other_post_id = resolve_ids()
    followed = client.post(f"/api/users/{USER}/follows/{followed_account_id}")
    check(followed.status_code == 200, "follow account returns 200")

    own_comment = client.post(
        f"/api/posts/{my_post_id}/comments",
        json={"user_id": USER_OTHER, "text": f"comment mentions @{MY_HANDLE}"},
    )
    check(own_comment.status_code == 201, "comment on my post returns 201")
    own_comment_id = own_comment.json()["comment"]["id"]

    ignored = client.post(
        f"/api/posts/{other_post_id}/comments",
        json={"user_id": USER_OTHER, "text": f"email user@{MY_HANDLE} ignored"},
    )
    check(ignored.status_code == 201, "negative mention fixture comment returns 201")

    listed = client.get(f"/api/users/{USER}/notifications")
    check(listed.status_code == 200, "list notifications returns 200")
    body = listed.json()
    items = body["items"]
    check(body["unread_count"] >= 2, "initial notifications are unread")

    followed_item = next((item for item in items if item["source_type"] == "post"), None)
    check(
        followed_item is not None
        and set(followed_item["reasons"]) == {"followed_post", "mention"},
        "followed post mention merges reasons into one item",
    )

    comment_item = next(
        (item for item in items if item["source_id"] == own_comment_id), None
    )
    check(
        comment_item is not None
        and set(comment_item["reasons"]) == {"own_post_comment", "mention"},
        "own post comment mention merges reasons into one item",
    )

    check(
        not any(item["post"]["id"] == other_post_id for item in items),
        "email-style user@handle is not treated as a mention",
    )

    read = client.post(f"/api/users/{USER}/notifications/read-all")
    check(read.status_code == 200, "read-all returns 200")
    after_read = client.get(f"/api/users/{USER}/notifications").json()
    check(after_read["unread_count"] == 0, "read-all clears unread count")

    new_comment = client.post(
        f"/api/posts/{my_post_id}/comments",
        json={"user_id": USER_OTHER, "text": "fresh unread comment"},
    )
    check(new_comment.status_code == 201, "fresh comment after read-all returns 201")
    new_comment_id = new_comment.json()["comment"]["id"]
    after_new = client.get(f"/api/users/{USER}/notifications").json()
    check(after_new["unread_count"] == 1, "new source after read-all is unread")

    deleted = client.delete(f"/api/comments/{new_comment_id}?user_id={USER_OTHER}")
    check(deleted.status_code == 204, "delete fresh comment returns 204")
    after_delete = notification_items(client)
    check(
        not any(item["source_id"] == new_comment_id for item in after_delete),
        "deleted comment notification disappears",
    )

    return failures


def cleanup() -> None:
    with create_session() as session:
        for post_ext in (MY_POST_EXT, FOLLOWED_POST_EXT, OTHER_POST_EXT):
            post = session.exec(select(Post).where(Post.external_id == post_ext)).first()
            if post is not None:
                for comment in session.exec(
                    select(Comment).where(Comment.post_id == post.id)
                ).all():
                    session.delete(comment)
                session.delete(post)

        for account_ext in (MY_ACCT_EXT, FOLLOWED_ACCT_EXT, OTHER_ACCT_EXT):
            account = session.exec(
                select(Account).where(Account.external_id == account_ext)
            ).first()
            if account is not None:
                for follow in session.exec(
                    select(Follow).where(Follow.following_account_id == account.id)
                ).all():
                    session.delete(follow)
                session.delete(account)

        state = session.get(NotificationState, USER)
        if state is not None:
            session.delete(state)

        for user_id in (USER, USER_OTHER, generated_user_id(FOLLOWED_ACCT_EXT)):
            user = session.get(User, user_id)
            if user is not None:
                session.delete(user)

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
        print("\nNotifications check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nNotifications check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
