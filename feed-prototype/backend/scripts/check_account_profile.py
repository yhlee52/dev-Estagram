"""Account profile self-service regression check (v0.6.2).

Exercises the owner-only profile update API. It verifies that a user can update
their 1:1 account profile, another user cannot, and identity fields stay fixed.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_account_profile

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
from app.models.user import User
from app.services.import_external_posts import generated_account_id, generated_user_id


SUFFIX = uuid4().hex[:8]
BATCH = f"check-profile-batch-{SUFFIX}"
OWNER_EXT = f"check-profile-owner-{SUFFIX}"
OTHER_EXT = f"check-profile-other-{SUFFIX}"
POST_EXT = f"check-profile-post-{SUFFIX}"

OWNER_USER = generated_user_id(OWNER_EXT)
OTHER_USER = generated_user_id(OTHER_EXT)
OWNER_ACCOUNT = generated_account_id(OWNER_EXT)


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_account_profile"},
        "accounts": [
            {
                "external_id": OWNER_EXT,
                "handle": f"profile.owner.{SUFFIX}",
                "display_name": "Profile Owner",
                "bio": "Original owner bio.",
                "avatar_url": "/assets/profiles/original-owner.png",
            },
            {
                "external_id": OTHER_EXT,
                "handle": f"profile.other.{SUFFIX}",
                "display_name": "Profile Other",
            },
        ],
        "posts": [
            {
                "external_id": POST_EXT,
                "account_external_id": OWNER_EXT,
                "title": "Profile update check post",
                "text": "profile",
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

    original = client.get(f"/api/accounts/{OWNER_ACCOUNT}")
    check(original.status_code == 200, "owner account is readable")
    original_body = original.json() if original.status_code == 200 else {}
    original_handle = original_body.get("handle")
    original_kind = original_body.get("kind")
    original_user_id = original_body.get("user_id")

    denied = client.patch(
        f"/api/accounts/{OWNER_ACCOUNT}",
        json={
            "user_id": OTHER_USER,
            "display_name": "Wrong Owner",
        },
    )
    check(denied.status_code == 403, f"non-owner update is 403 (got {denied.status_code})")

    updated = client.patch(
        f"/api/accounts/{OWNER_ACCOUNT}",
        json={
            "user_id": OWNER_USER,
            "display_name": "Updated Profile Owner",
            "bio": "  Updated owner bio.  ",
            "avatar_url": "/assets/profiles/check-owner/avatar.png",
        },
    )
    check(updated.status_code == 200, f"owner update returns 200 (got {updated.status_code})")
    body = updated.json() if updated.status_code == 200 else {}
    check(body.get("display_name") == "Updated Profile Owner", "display_name updates")
    check(body.get("bio") == "Updated owner bio.", "bio is trimmed and updated")
    check(
        body.get("avatar_url") == "/assets/profiles/check-owner/avatar.png",
        "avatar_url updates",
    )
    check(body.get("handle") == original_handle, "handle stays fixed")
    check(body.get("kind") == original_kind, "kind stays fixed")
    check(body.get("user_id") == original_user_id, "user_id stays fixed")
    check(body.get("profile_source") == "user", "profile_source becomes user")

    cleared = client.patch(
        f"/api/accounts/{OWNER_ACCOUNT}",
        json={
            "user_id": OWNER_USER,
            "display_name": "Updated Profile Owner",
            "bio": "   ",
            "avatar_url": "",
        },
    )
    check(cleared.status_code == 200, f"clearing optional fields returns 200 (got {cleared.status_code})")
    cleared_body = cleared.json() if cleared.status_code == 200 else {}
    check(cleared_body.get("bio") is None, "blank bio normalizes to null")
    check(cleared_body.get("avatar_url") is None, "blank avatar_url normalizes to null")

    reimported = client.post("/api/imports", json=payload())
    check(reimported.status_code == 200, f"reimport returns 200 (got {reimported.status_code})")
    after_reimport = client.get(f"/api/accounts/{OWNER_ACCOUNT}")
    reimport_body = after_reimport.json() if after_reimport.status_code == 200 else {}
    check(
        reimport_body.get("display_name") == "Updated Profile Owner",
        "reimport preserves user-edited display_name",
    )
    check(reimport_body.get("bio") is None, "reimport preserves user-cleared bio")
    check(
        reimport_body.get("avatar_url") is None,
        "reimport preserves user-cleared avatar_url",
    )

    invalid = client.patch(
        f"/api/accounts/{OWNER_ACCOUNT}",
        json={
            "user_id": OWNER_USER,
            "display_name": " ",
        },
    )
    check(invalid.status_code == 422, f"blank display_name is 422 (got {invalid.status_code})")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        post = session.exec(select(Post).where(Post.external_id == POST_EXT)).first()
        if post is not None:
            session.delete(post)

        for external_id in (OWNER_EXT, OTHER_EXT):
            account = session.exec(
                select(Account).where(Account.external_id == external_id)
            ).first()
            if account is not None:
                session.delete(account)

        for user_id in (OWNER_USER, OTHER_USER):
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
        print("\nAccount profile check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nAccount profile check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
