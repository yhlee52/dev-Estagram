"""Bookmarks regression check (v0.5.1).

Exercises the bookmark API end-to-end via FastAPI TestClient against a real DB
(writes + reads), then cleans up everything it created.

Covers:
1. POST add (idempotent) + note; PATCH note edit; DELETE remove.
2. GET /api/users/{id}/bookmark-ids reflects current bookmarks.
3. GET /api/users/{id}/bookmarks returns bookmarked posts with note +
   bookmarked_at, and respects post filters (tag).
4. bookmarked_only feed filter returns only bookmarked posts for the user.
5. PATCH on a missing bookmark returns 404.

Two posts are seeded so filtering/only-subset behavior is observable; the
import creates a generated user that owns the bookmarks.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_bookmarks

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
from app.models.bookmark import Bookmark
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import generated_user_id


SUFFIX = uuid4().hex[:8]
ACCT_EXT = f"check-bm-acct-{SUFFIX}"
BATCH = f"check-bm-batch-{SUFFIX}"
POST_A_EXT = f"check-bm-post-a-{SUFFIX}"
POST_B_EXT = f"check-bm-post-b-{SUFFIX}"
TAG = f"bmtag{SUFFIX}"  # unique tag isolates the filter check

USER = generated_user_id(ACCT_EXT)


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_bookmarks"},
        "accounts": [
            {
                "external_id": ACCT_EXT,
                "handle": f"checkbm{SUFFIX}",
                "display_name": "Bookmark User",
            }
        ],
        "posts": [
            {
                "external_id": POST_A_EXT,
                "account_external_id": ACCT_EXT,
                "title": "Bookmark target A",
                "text": "regression",
                "tags": [TAG],
            },
            {
                "external_id": POST_B_EXT,
                "account_external_id": ACCT_EXT,
                "title": "Bookmark target B",
                "text": "regression",
            },
        ],
    }


def resolve_post_ids() -> tuple[str, str]:
    with create_session() as session:
        post_a = session.exec(select(Post).where(Post.external_id == POST_A_EXT)).first()
        post_b = session.exec(select(Post).where(Post.external_id == POST_B_EXT)).first()
        if post_a is None or post_b is None:
            raise RuntimeError("seed posts not found")
        return post_a.id, post_b.id


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

    post_a, post_b = resolve_post_ids()
    base = f"/api/users/{USER}/bookmarks"

    # 1) add A with a note, add B (idempotent re-add keeps note).
    added = client.post(f"{base}/{post_a}", json={"note": "look later"})
    check(added.status_code == 200, "add bookmark returns 200")
    check(added.json().get("note") == "look later", "added bookmark stores note")

    client.post(f"{base}/{post_b}")
    again = client.post(f"{base}/{post_a}")  # idempotent, no note -> keep existing
    check(again.json().get("note") == "look later", "idempotent re-add keeps note")

    # 2) bookmark-ids reflects both.
    ids = client.get(f"/api/users/{USER}/bookmark-ids").json()["post_ids"]
    check(set(ids) == {post_a, post_b}, "bookmark-ids lists both posts")

    # 3) list returns both with note + bookmarked_at; tag filter narrows to A.
    listed = client.get(base)
    check(listed.status_code == 200, "list bookmarks returns 200")
    listed_items = listed.json()["items"]
    check(len(listed_items) == 2, f"list returns 2 bookmarks (got {len(listed_items)})")
    item_a = next((i for i in listed_items if i["post"]["id"] == post_a), None)
    check(item_a is not None and item_a["note"] == "look later", "list item carries note")
    check(
        item_a is not None and bool(item_a.get("bookmarked_at")),
        "list item carries bookmarked_at",
    )

    filtered = client.get(f"{base}?tag={TAG}")
    filtered_ids = [i["post"]["id"] for i in filtered.json()["items"]]
    check(filtered_ids == [post_a], "tag filter on bookmark list returns only post A")

    # 4) bookmarked_only feed filter.
    only = client.get(f"/api/posts?bookmarked_only=true&user_id={USER}")
    only_ids = {i["id"] for i in only.json()["items"]}
    check(only_ids == {post_a, post_b}, "bookmarked_only returns the user's bookmarks")

    bad = client.get("/api/posts?bookmarked_only=true")  # no user_id
    check(bad.status_code == 400, f"bookmarked_only without user_id is 400 (got {bad.status_code})")

    # 5) edit note; patch missing -> 404; delete.
    edited = client.patch(f"{base}/{post_a}", json={"note": "updated"})
    check(edited.json().get("note") == "updated", "PATCH updates the note")

    missing = client.patch(f"{base}/nonexistent-post-id", json={"note": "x"})
    check(missing.status_code == 404, f"PATCH missing bookmark is 404 (got {missing.status_code})")

    removed = client.delete(f"{base}/{post_a}")
    check(removed.status_code == 204, f"delete returns 204 (got {removed.status_code})")
    remaining = client.get(f"/api/users/{USER}/bookmark-ids").json()["post_ids"]
    check(remaining == [post_b], "after delete only post B remains bookmarked")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for post_ext in (POST_A_EXT, POST_B_EXT):
            post = session.exec(select(Post).where(Post.external_id == post_ext)).first()
            if post is not None:
                for bookmark in session.exec(
                    select(Bookmark).where(Bookmark.post_id == post.id)
                ).all():
                    session.delete(bookmark)
                session.delete(post)

        account = session.exec(
            select(Account).where(Account.external_id == ACCT_EXT)
        ).first()
        if account is not None:
            session.delete(account)

        user = session.get(User, generated_user_id(ACCT_EXT))
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
        print("\nBookmarks check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nBookmarks check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
