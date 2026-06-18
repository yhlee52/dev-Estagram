"""Account identity regression check (v0.6.1).

Verifies the chosen v0.6.x identity policy: User:Account remains 1:1, including
bot/program/facility-like imported accounts. The check exercises import-created
paired users, post ownership, and cross-user edit/delete denial.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_account_identity

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
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import generated_user_id


SUFFIX = uuid4().hex[:8]
BATCH = f"check-identity-batch-{SUFFIX}"
ACCT_A_EXT = f"check-identity-line-a-{SUFFIX}"
ACCT_B_EXT = f"check-identity-line-b-{SUFFIX}"
POST_A_EXT = f"check-identity-imported-a-{SUFFIX}"

USER_A = generated_user_id(ACCT_A_EXT)
USER_B = generated_user_id(ACCT_B_EXT)

created_post_ids: list[str] = []


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_account_identity"},
        "accounts": [
            {
                "external_id": ACCT_A_EXT,
                "handle": f"line.a.{SUFFIX}",
                "display_name": "Line A Bot",
                "bio": "Imported bot-like account for identity regression.",
            },
            {
                "external_id": ACCT_B_EXT,
                "handle": f"line.b.{SUFFIX}",
                "display_name": "Line B Bot",
                "bio": "Second imported bot-like account for identity regression.",
            },
        ],
        "posts": [
            {
                "external_id": POST_A_EXT,
                "account_external_id": ACCT_A_EXT,
                "title": "Imported identity check post",
                "text": "imported",
                "tags": [f"identity{SUFFIX}"],
            }
        ],
    }


def user_accounts(user_id: str) -> list[Account]:
    with create_session() as session:
        return list(session.exec(select(Account).where(Account.user_id == user_id)).all())


def imported_account(external_id: str) -> Account | None:
    with create_session() as session:
        return session.exec(select(Account).where(Account.external_id == external_id)).first()


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

    user_a = client.get(f"/api/users/{USER_A}")
    user_b = client.get(f"/api/users/{USER_B}")
    check(user_a.status_code == 200, "import creates paired user A")
    check(user_b.status_code == 200, "import creates paired user B")

    account_a = imported_account(ACCT_A_EXT)
    account_b = imported_account(ACCT_B_EXT)
    check(account_a is not None and account_a.user_id == USER_A, "account A is paired to user A")
    check(account_b is not None and account_b.user_id == USER_B, "account B is paired to user B")
    check(len(user_accounts(USER_A)) == 1, "user A has exactly one account")
    check(len(user_accounts(USER_B)) == 1, "user B has exactly one account")

    manual_post = client.post(
        "/api/posts",
        json={
            "user_id": USER_A,
            "title": "Manual identity check post",
            "text": "created through user A",
            "tags": [f"identity{SUFFIX}"],
        },
    )
    check(manual_post.status_code == 201, f"user A can create post (got {manual_post.status_code})")

    if manual_post.status_code == 201 and account_a is not None:
        body = manual_post.json()
        post_id = body["post"]["id"]
        created_post_ids.append(post_id)
        check(body["account"]["id"] == account_a.id, "created post uses user A's 1:1 account")

        denied_edit = client.patch(
            f"/api/posts/{post_id}",
            json={"user_id": USER_B, "title": "Wrong owner edit"},
        )
        check(denied_edit.status_code == 403, "user B cannot edit user A account post")

        allowed_edit = client.patch(
            f"/api/posts/{post_id}",
            json={"user_id": USER_A, "title": "Owner edit"},
        )
        check(allowed_edit.status_code == 200, "user A can edit own account post")

        denied_delete = client.delete(f"/api/posts/{post_id}?user_id={USER_B}")
        check(denied_delete.status_code == 403, "user B cannot delete user A account post")

        allowed_delete = client.delete(f"/api/posts/{post_id}?user_id={USER_A}")
        check(allowed_delete.status_code == 204, "user A can delete own account post")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for post_id in created_post_ids:
            post = session.get(Post, post_id)
            if post is not None:
                session.delete(post)

        post = session.exec(select(Post).where(Post.external_id == POST_A_EXT)).first()
        if post is not None:
            session.delete(post)

        for external_id in (ACCT_A_EXT, ACCT_B_EXT):
            account = session.exec(
                select(Account).where(Account.external_id == external_id)
            ).first()
            if account is not None:
                session.delete(account)

        # Import provisions a paired credential per user (v0.6.0). Delete those
        # (and any sessions) before the users, then flush, so the
        # user_credentials/user_sessions -> users FK does not block deletion.
        for user_id in (USER_A, USER_B):
            credential = session.get(UserCredential, user_id)
            if credential is not None:
                session.delete(credential)
            for auth_session in session.exec(
                select(UserSession).where(UserSession.user_id == user_id)
            ).all():
                session.delete(auth_session)

        session.flush()

        for user_id in (USER_A, USER_B):
            user = session.get(User, user_id)
            if user is not None:
                session.delete(user)

        batch = session.exec(select(ImportBatch).where(ImportBatch.external_id == BATCH)).first()
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
        print("\nAccount identity check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nAccount identity check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
