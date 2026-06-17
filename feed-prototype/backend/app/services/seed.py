from typing import TypeVar

from sqlmodel import Session, SQLModel, select

from app.db.session import create_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.follow import Follow
from app.models.post import Post
from app.models.user import User


ModelT = TypeVar("ModelT", bound=SQLModel)


USERS = [
    {
        "id": "demo-user-ari",
        "handle": "ari",
        "display_name": "Ari Lane",
        "avatar_url": "/uploads/demo/avatars/ari.png",
        "bio": "Collects small updates, notes, and snapshots.",
    },
    {
        "id": "demo-user-mika",
        "handle": "mika",
        "display_name": "Mika Park",
        "avatar_url": "/uploads/demo/avatars/mika.png",
        "bio": "Keeps a project and reading feed.",
    },
    {
        "id": "demo-user-nova",
        "handle": "nova",
        "display_name": "Nova Bot",
        "avatar_url": "/uploads/demo/avatars/nova.png",
        "bio": "Posts lightweight generated summaries.",
    },
]

ACCOUNTS = [
    {
        "id": "demo-account-ari",
        "user_id": "demo-user-ari",
        "handle": "ari.notes",
        "display_name": "Ari Notes",
        "bio": "Personal notes and image posts.",
        "avatar_url": "/uploads/demo/avatars/ari-notes.png",
        "kind": "person",
        "profile_source": "user",
    },
    {
        "id": "demo-account-mika",
        "user_id": "demo-user-mika",
        "handle": "mika.project",
        "display_name": "Mika Project Log",
        "bio": "Project progress and small tables.",
        "avatar_url": "/uploads/demo/avatars/mika-project.png",
        "kind": "project",
        "profile_source": "user",
    },
    {
        "id": "demo-account-nova",
        "user_id": "demo-user-nova",
        "handle": "nova.digest",
        "display_name": "Nova Digest",
        "bio": "Automated digest examples for local feed testing.",
        "avatar_url": "/uploads/demo/avatars/nova-digest.png",
        "kind": "bot",
        "profile_source": "user",
    },
]

POSTS = [
    {
        "id": "demo-post-morning-walk",
        "account_id": "demo-account-ari",
        "title": "Morning Walk",
        "text": "A quiet image post for testing the feed card layout.",
        "tags": ["personal", "image"],
        "metadata_json": {"mood": "calm", "location": "local park"},
    },
    {
        "id": "demo-post-weekly-chart",
        "account_id": "demo-account-mika",
        "title": "Weekly Progress Chart",
        "text": "A chart-style asset attached to a generic project update.",
        "tags": ["project", "progress"],
        "metadata_json": {"status": "on_track", "week": 24},
    },
    {
        "id": "demo-post-summary-table",
        "account_id": "demo-account-mika",
        "title": "Summary Table",
        "text": "A compact table example for read-only API validation.",
        "tags": ["project", "table"],
        "metadata_json": {"category": "planning"},
    },
    {
        "id": "demo-post-daily-digest",
        "account_id": "demo-account-nova",
        "title": "Daily Digest",
        "text": "A generated digest example with JSON-style structured data.",
        "tags": ["digest", "generated"],
        "metadata_json": {"source": "demo", "generated": True},
    },
    {
        "id": "demo-post-html-note",
        "account_id": "demo-account-nova",
        "title": "HTML Note",
        "text": "A simple HTML asset example for future renderer checks.",
        "tags": ["html", "asset"],
        "metadata_json": {"format": "html"},
    },
    {
        "id": "demo-post-weekend-plan",
        "account_id": "demo-account-ari",
        "title": "Weekend Plan",
        "text": "Plain text post data to round out the demo feed.",
        "tags": ["personal", "planning"],
        "metadata_json": {"tags": ["personal", "planning"]},
    },
]

ASSETS = [
    {
        "id": "demo-asset-walk-image",
        "post_id": "demo-post-morning-walk",
        "type": "image",
        "title": "Walk snapshot",
        "description": "Demo image placeholder path.",
        "url": "/uploads/demo/morning-walk.jpg",
        "src": "/uploads/demo/morning-walk.jpg",
        "mime_type": "image/jpeg",
        "sort_order": 0,
        "metadata_json": {"width": 1200, "height": 800},
    },
    {
        "id": "demo-asset-progress-chart",
        "post_id": "demo-post-weekly-chart",
        "type": "plot",
        "title": "Progress chart",
        "description": "Demo chart placeholder path.",
        "url": "/uploads/demo/sample-chart.png",
        "src": "/uploads/demo/sample-chart.png",
        "mime_type": "image/png",
        "sort_order": 0,
        "metadata_json": {"chart_type": "line"},
    },
    {
        "id": "demo-asset-summary-table",
        "post_id": "demo-post-summary-table",
        "type": "table",
        "title": "Planning table",
        "description": "Small table represented as a local JSON asset.",
        "url": "/uploads/demo/summary-table.json",
        "src": "/uploads/demo/summary-table.json",
        "mime_type": "application/json",
        "sort_order": 0,
        "metadata_json": {"columns": ["item", "status"]},
    },
    {
        "id": "demo-asset-digest-json",
        "post_id": "demo-post-daily-digest",
        "type": "file",
        "title": "Digest payload",
        "description": "Structured payload example.",
        "url": "/uploads/demo/digest.json",
        "src": "/uploads/demo/digest.json",
        "mime_type": "application/json",
        "sort_order": 0,
        "metadata_json": {"schema": "demo.digest.v1"},
    },
    {
        "id": "demo-asset-html-note",
        "post_id": "demo-post-html-note",
        "type": "link",
        "title": "HTML preview",
        "description": "HTML placeholder path.",
        "url": "/uploads/demo/html-note.html",
        "src": "/uploads/demo/html-note.html",
        "mime_type": "text/html",
        "sort_order": 0,
        "metadata_json": {"trusted": False},
    },
]

FOLLOWS = [
    {
        "id": "demo-follow-ari-mika",
        "follower_user_id": "demo-user-ari",
        "following_account_id": "demo-account-mika",
    },
    {
        "id": "demo-follow-ari-nova",
        "follower_user_id": "demo-user-ari",
        "following_account_id": "demo-account-nova",
    },
    {
        "id": "demo-follow-mika-ari",
        "follower_user_id": "demo-user-mika",
        "following_account_id": "demo-account-ari",
    },
    {
        "id": "demo-follow-nova-mika",
        "follower_user_id": "demo-user-nova",
        "following_account_id": "demo-account-mika",
    },
]


def get_by_id(session: Session, model: type[ModelT], item_id: str) -> ModelT | None:
    return session.get(model, item_id)


def add_if_missing(session: Session, model: type[ModelT], values: dict) -> bool:
    if get_by_id(session, model, values["id"]) is not None:
        return False

    session.add(model(**values))
    return True


def add_follow_if_missing(session: Session, values: dict) -> bool:
    existing = session.exec(
        select(Follow).where(
            Follow.follower_user_id == values["follower_user_id"],
            Follow.following_account_id == values["following_account_id"],
        )
    ).first()
    if existing is not None:
        return False

    session.add(Follow(**values))
    return True


def seed_database() -> dict[str, int]:
    counts = {
        "users": 0,
        "accounts": 0,
        "posts": 0,
        "post_assets": 0,
        "follows": 0,
    }

    with create_session() as session:
        for values in USERS:
            counts["users"] += int(add_if_missing(session, User, values))

        for values in ACCOUNTS:
            counts["accounts"] += int(add_if_missing(session, Account, values))

        for values in POSTS:
            counts["posts"] += int(add_if_missing(session, Post, values))

        for values in ASSETS:
            counts["post_assets"] += int(add_if_missing(session, PostAsset, values))

        for values in FOLLOWS:
            counts["follows"] += int(add_follow_if_missing(session, values))

        session.commit()

    return counts


def main() -> None:
    counts = seed_database()
    print("Seed complete")
    for name, count in counts.items():
        print(f"{name}: {count} inserted")


if __name__ == "__main__":
    main()
