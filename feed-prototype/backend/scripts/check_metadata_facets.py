"""Metadata facet regression check (v0.4.0).

Exercises the facet API and the exact/contains metadata match end-to-end via
FastAPI TestClient against a real DB (writes + reads), then cleans up everything
it created.

Covers:
1. GET /api/metadata/keys surfaces a data-derived key with its post count.
2. GET /api/metadata/values?key=... returns distinct values + frequency,
   highest count first.
3. metadata_value filtering: default (contains/ILIKE) matches substrings;
   metadata_match=exact matches only the exact value.
4. an invalid metadata_match returns 400.

The run uses a unique metadata key so its posts are isolated from any other
data already in the DB (no account filter needed for deterministic counts).

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_metadata_facets

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
from app.models.post import Post
from app.services.import_external_posts import generated_user_id
from scripts.cleanup_utils import delete_test_users


SUFFIX = uuid4().hex[:8]
ACCT_EXT = f"check-facet-acct-{SUFFIX}"
BATCH = f"check-facet-batch-{SUFFIX}"
KEY = f"sev_{SUFFIX}"  # unique key isolates our posts from the rest of the DB
# (external_id, value): "high" appears twice, "highest" is a superset string of
# "high" (so contains matches it but exact does not), "low" is unrelated.
POSTS = [
    (f"check-facet-post-{SUFFIX}-1", "high"),
    (f"check-facet-post-{SUFFIX}-2", "high"),
    (f"check-facet-post-{SUFFIX}-3", "highest"),
    (f"check-facet-post-{SUFFIX}-4", "low"),
]
POST_EXTS = [external_id for external_id, _ in POSTS]


def payload() -> dict:
    return {
        "batch": {"external_id": BATCH, "source": "check_metadata_facets"},
        "accounts": [
            {
                "external_id": ACCT_EXT,
                "handle": f"checkfacet{SUFFIX}",
                "display_name": "Check Facet Account",
            }
        ],
        "posts": [
            {
                "external_id": external_id,
                "account_external_id": ACCT_EXT,
                "title": f"Facet post {value}",
                "text": "regression",
                "metadata_json": {KEY: value},
            }
            for external_id, value in POSTS
        ],
    }


def find_value(items: list[dict], value: str) -> dict | None:
    return next((item for item in items if item["value"] == value), None)


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

    # 1) keys endpoint surfaces our key with the right post count (4 posts).
    keys = client.get("/api/metadata/keys?limit=100")
    check(keys.status_code == 200, "GET /api/metadata/keys returns 200")
    key_items = keys.json()["items"]
    our_key = next((item for item in key_items if item["key"] == KEY), None)
    check(our_key is not None, "metadata keys include our data-derived key")
    if our_key is not None:
        check(our_key["count"] == 4, f"key count is 4 (got {our_key['count']})")

    # 2) values endpoint: frequency-ordered distinct values for the key.
    values = client.get(f"/api/metadata/values?key={KEY}&limit=100")
    check(values.status_code == 200, "GET /api/metadata/values returns 200")
    body = values.json()
    check(body["key"] == KEY, "values response echoes the key")
    value_items = body["items"]
    high = find_value(value_items, "high")
    highest = find_value(value_items, "highest")
    low = find_value(value_items, "low")
    check(high is not None and high["count"] == 2, "value 'high' has count 2")
    check(highest is not None and highest["count"] == 1, "value 'highest' has count 1")
    check(low is not None and low["count"] == 1, "value 'low' has count 1")
    check(
        bool(value_items) and value_items[0]["value"] == "high",
        "values are ordered by count desc (high first)",
    )

    # 3a) contains (default): metadata_value=high matches high + highest = 3.
    contains = client.get(f"/api/posts?metadata_key={KEY}&metadata_value=high")
    check(contains.status_code == 200, "contains filter returns 200")
    contains_count = len(contains.json()["items"])
    check(contains_count == 3, f"contains match returns 3 posts (got {contains_count})")

    # 3b) exact: metadata_value=high matches only the two exact 'high' posts.
    exact = client.get(
        f"/api/posts?metadata_key={KEY}&metadata_value=high&metadata_match=exact"
    )
    check(exact.status_code == 200, "exact filter returns 200")
    exact_count = len(exact.json()["items"])
    check(exact_count == 2, f"exact match returns 2 posts (got {exact_count})")

    # 4) invalid metadata_match -> 400.
    bad = client.get(
        f"/api/posts?metadata_key={KEY}&metadata_value=high&metadata_match=bogus"
    )
    check(bad.status_code == 400, f"invalid metadata_match returns 400 (got {bad.status_code})")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for external_id in POST_EXTS:
            post = session.exec(
                select(Post).where(Post.external_id == external_id)
            ).first()
            if post is not None:
                session.delete(post)

        account = session.exec(
            select(Account).where(Account.external_id == ACCT_EXT)
        ).first()
        if account is not None:
            session.delete(account)

        delete_test_users(session, [generated_user_id(ACCT_EXT)])

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
        print("\nMetadata facet check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nMetadata facet check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
