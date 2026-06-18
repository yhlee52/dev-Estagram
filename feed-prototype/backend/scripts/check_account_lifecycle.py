"""Account lifecycle regression check (v0.6.4).

Exercises soft deactivation with post preservation: owner-only deactivate,
session revocation + login block, discovery hiding while posts stay readable,
new-follow blocking with existing follows preserved, and operator reactivation.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_account_lifecycle

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
from app.models.follow import Follow
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.services.import_external_posts import (
    generated_account_id,
    generated_user_id,
    generated_user_handle,
)
from scripts import reactivate_user
from scripts.cleanup_utils import delete_test_users


SUFFIX = uuid4().hex[:8]
BATCH = f"check-lifecycle-batch-{SUFFIX}"
ACCT_EXT = f"check-lifecycle-acct-{SUFFIX}"
KEEP_EXT = f"check-lifecycle-keep-{SUFFIX}"
NEW_EXT = f"check-lifecycle-new-{SUFFIX}"
POST_EXT = f"check-lifecycle-post-{SUFFIX}"

USER = generated_user_id(ACCT_EXT)
ACCOUNT = generated_account_id(ACCT_EXT)
PW = generated_user_handle(ACCT_EXT)  # import sets initial password = generated handle
KEEP_USER = generated_user_id(KEEP_EXT)
NEW_USER = generated_user_id(NEW_EXT)

ALL_USERS = (USER, KEEP_USER, NEW_USER)
ALL_ACCTS = (ACCT_EXT, KEEP_EXT, NEW_EXT)


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_account_lifecycle"},
        "accounts": [
            {"external_id": ACCT_EXT, "handle": f"life.{SUFFIX}", "display_name": "Lifecycle Acct"},
            {"external_id": KEEP_EXT, "handle": f"keep.{SUFFIX}", "display_name": "Keep Follower"},
            {"external_id": NEW_EXT, "handle": f"new.{SUFFIX}", "display_name": "New Follower"},
        ],
        "posts": [
            {
                "external_id": POST_EXT,
                "account_external_id": ACCT_EXT,
                "title": "Lifecycle preserved post",
                "text": "preserved",
            }
        ],
    }


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

    # Pre-deactivation: login works and issues a session.
    login_before = client.post("/api/auth/login", json={"login": USER, "password": PW})
    check(login_before.status_code == 200, f"login works before deactivation (got {login_before.status_code})")
    check(client.get("/api/auth/session").status_code == 200, "session readable before deactivation")

    # Existing follow that must survive deactivation.
    client.post(f"/api/users/{KEEP_USER}/follows/{ACCOUNT}")
    keep_before = client.get(f"/api/users/{KEEP_USER}/follows").json()
    check(ACCOUNT in keep_before["following_account_ids"], "keep-follower follows account before deactivation")

    posts_before = client.get(f"/api/accounts/{ACCOUNT}/posts")
    check(
        posts_before.status_code == 200 and len(posts_before.json()) == 1,
        "imported post is present before deactivation",
    )

    listed_before = client.get("/api/accounts").json()
    check(
        any(a["id"] == ACCOUNT for a in listed_before),
        "account appears in discovery before deactivation",
    )

    # Ownership: a different user cannot deactivate this account.
    denied = client.post(f"/api/accounts/{ACCOUNT}/deactivate", json={"user_id": NEW_USER})
    check(denied.status_code == 403, f"non-owner deactivate is 403 (got {denied.status_code})")

    # Owner deactivates.
    deactivated = client.post(f"/api/accounts/{ACCOUNT}/deactivate", json={"user_id": USER})
    check(deactivated.status_code == 200, f"owner deactivate returns 200 (got {deactivated.status_code})")
    check(
        deactivated.status_code == 200 and deactivated.json().get("deactivated_at") is not None,
        "deactivated_at is set",
    )

    # Login blocked + prior session revoked.
    login_after = client.post("/api/auth/login", json={"login": USER, "password": PW})
    check(login_after.status_code == 403, f"login blocked after deactivation (got {login_after.status_code})")
    check(client.get("/api/auth/session").status_code == 401, "prior session revoked after deactivation")

    # Discovery hides it; opt-in shows it; profile + posts still readable.
    listed_after = client.get("/api/accounts").json()
    check(
        all(a["id"] != ACCOUNT for a in listed_after),
        "account hidden from discovery after deactivation",
    )
    listed_opt_in = client.get("/api/accounts?include_deactivated=true").json()
    check(
        any(a["id"] == ACCOUNT for a in listed_opt_in),
        "include_deactivated=true reveals the account",
    )
    profile_after = client.get(f"/api/accounts/{ACCOUNT}")
    check(profile_after.status_code == 200, "deactivated account profile still readable")
    posts_after = client.get(f"/api/accounts/{ACCOUNT}/posts")
    check(
        posts_after.status_code == 200 and len(posts_after.json()) == 1,
        "posts are preserved after deactivation",
    )

    # Existing follow preserved; new follow blocked.
    keep_after = client.get(f"/api/users/{KEEP_USER}/follows").json()
    check(ACCOUNT in keep_after["following_account_ids"], "existing follow preserved after deactivation")
    new_follow = client.post(f"/api/users/{NEW_USER}/follows/{ACCOUNT}")
    check(new_follow.status_code == 409, f"new follow of deactivated account is 409 (got {new_follow.status_code})")

    # Operator reactivation restores login + discovery.
    code = reactivate_user.main(["--user", USER])
    check(code == 0, f"reactivate CLI exits 0 (got {code})")
    login_reactivated = client.post("/api/auth/login", json={"login": USER, "password": PW})
    check(login_reactivated.status_code == 200, f"login works after reactivation (got {login_reactivated.status_code})")
    listed_reactivated = client.get("/api/accounts").json()
    check(
        any(a["id"] == ACCOUNT for a in listed_reactivated),
        "account back in discovery after reactivation",
    )

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for user_id in ALL_USERS:
            for follow in session.exec(
                select(Follow).where(Follow.follower_user_id == user_id)
            ).all():
                session.delete(follow)

        post = session.exec(select(Post).where(Post.external_id == POST_EXT)).first()
        if post is not None:
            session.delete(post)

        for external_id in ALL_ACCTS:
            account = session.exec(
                select(Account).where(Account.external_id == external_id)
            ).first()
            if account is not None:
                session.delete(account)

        session.flush()
        delete_test_users(session, ALL_USERS)

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
        print("\nAccount lifecycle check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nAccount lifecycle check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
