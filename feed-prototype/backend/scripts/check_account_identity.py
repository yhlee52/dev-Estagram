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
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.services.import_external_posts import generated_user_id
from scripts.auth_test_utils import login, set_known_password
from scripts.cleanup_utils import delete_test_users


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

    set_known_password(USER_A)
    set_known_password(USER_B)
    check(login(client, USER_A).status_code == 200, "user A logs in")

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

        check(login(client, USER_B).status_code == 200, "user B logs in")
        denied_edit = client.patch(
            f"/api/posts/{post_id}",
            json={"title": "Wrong owner edit"},
        )
        check(denied_edit.status_code == 403, "user B cannot edit user A account post")

        check(login(client, USER_A).status_code == 200, "user A logs back in")
        allowed_edit = client.patch(
            f"/api/posts/{post_id}",
            json={"title": "Owner edit"},
        )
        check(allowed_edit.status_code == 200, "user A can edit own account post")

        check(login(client, USER_B).status_code == 200, "user B logs in again")
        denied_delete = client.delete(f"/api/posts/{post_id}")
        check(denied_delete.status_code == 403, "user B cannot delete user A account post")

        check(login(client, USER_A).status_code == 200, "user A logs back in again")
        allowed_delete = client.delete(f"/api/posts/{post_id}")
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

        delete_test_users(session, (USER_A, USER_B))

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
