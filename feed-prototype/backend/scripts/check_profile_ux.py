"""API regression for profile summary, search, pins, and import ownership.

Runs in memory by default. The isolated PostgreSQL runner can supply a newly
created disposable database to verify the real dialect and migrations.
"""

import os
from fastapi import FastAPI
from pathlib import Path
from tempfile import TemporaryDirectory
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import make_url
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select
from datetime import datetime, timezone

from app.api.deps import get_current_user, get_session
from app.api.routes.accounts import router as accounts_router
from app.api.routes.posts import router as posts_router
from app.api.routes.notifications import router as notifications_router
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.like import PostLike
from app.models.post import Post
from app.models.notification_state import NotificationState
from app.models.profile_pin import ProfilePin
from app.models.user import User
from app.schemas.external_import import ExternalImportPost
from app.services.import_external_posts import ImportSummary, upsert_post
from app.services.import_external_posts import run_import
import app.models.init  # noqa: F401 - register all tables for the isolated dry-run DB


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kw):
    return "JSON"


database_url = os.environ.get("PROFILE_UX_TEST_DATABASE_URL")
if database_url and not (make_url(database_url).database or "").startswith("feed_profile_check_"):
    raise RuntimeError("Profile UX PostgreSQL checks require a disposable test database")
engine = (create_engine(database_url) if database_url else
          create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool))
SQLModel.metadata.create_all(engine, tables=[
    User.__table__, Account.__table__, Post.__table__, PostAsset.__table__,
    Comment.__table__, Bookmark.__table__, PostLike.__table__, Follow.__table__, ProfilePin.__table__, NotificationState.__table__,
])
with Session(engine) as db:
    for name in ("ari", "bom", "coco"):
        db.add(User(id=name, handle=name, display_name=name))
    db.flush()
    for name in ("ari", "bom", "coco"):
        db.add(Account(id=f"account-{name}", user_id=name, handle=name, display_name=name))
    db.flush()
    db.add(Post(id="post-ari", external_id="ext-ari", account_id="account-ari", title="안녕", text="첫 게시글"))
    db.add(Post(id="post-bom", account_id="account-bom", title="Hello", text="@ari Second"))
    db.add(Follow(id="follow-1", follower_user_id="bom", following_account_id="account-ari"))
    db.add(Follow(id="follow-2", follower_user_id="coco", following_account_id="account-ari"))
    db.commit()

app = FastAPI()
app.include_router(accounts_router)
app.include_router(posts_router)
app.include_router(notifications_router)
active_user = {"id": "ari"}


def test_session():
    with Session(engine) as db:
        yield db


def test_user():
    with Session(engine) as db:
        return db.get(User, active_user["id"])


app.dependency_overrides[get_session] = test_session
app.dependency_overrides[get_current_user] = test_user
client = TestClient(app)

search = client.get("/api/accounts/search", params={"keyword": "AR", "sort": "handle"})
assert search.status_code == 200, search.text
assert [row["account"]["handle"] for row in search.json()["items"]] == ["ari"]
assert [row["account"]["handle"] for row in client.get("/api/accounts/search", params={"keyword": "@ari"}).json()["items"]] == ["ari"]
assert search.json()["items"][0]["post_count"] == 1
assert client.get("/api/accounts/search", params={"sort": "bad"}).status_code == 400
assert client.get("/api/accounts/search", params={"keyword": "%"}).json()["items"] == []
with Session(engine) as db:
    inactive = db.get(Account, "account-coco")
    inactive.deactivated_at = datetime.now(timezone.utc)
    db.add(inactive)
    db.commit()
assert all(row["account"]["handle"] != "coco" for row in client.get("/api/accounts/search").json()["items"])
assert client.get("/api/accounts/account-coco").status_code == 200
mentions = client.get("/api/users/ari/notifications", params={"reason": "mention", "limit": 1})
assert mentions.status_code == 200, mentions.text
assert len(mentions.json()["items"]) == 1
assert mentions.json()["items"][0]["post"]["id"] == "post-bom"

summary = client.get("/api/accounts/account-ari/summary")
assert summary.status_code == 200, summary.text
assert summary.json()["post_count"] == 1
assert summary.json()["follower_count"] == 2
followers = client.get("/api/accounts/account-ari/followers", params={"limit": 1})
assert followers.status_code == 200, followers.text
assert followers.json()["has_more"] is True
assert client.get("/api/accounts/account-ari/followers", params={"limit": 1, "cursor": followers.json()["next_cursor"]}).json()["items"][0]["handle"] == "coco"

with Session(engine) as db:
    db.add(Post(id="post-kst-before", account_id="account-bom", title="Before midnight", text="",
                created_at=datetime(2026, 1, 1, 14, 59, tzinfo=timezone.utc)))
    db.add(Post(id="post-kst-after", account_id="account-bom", title="After midnight", text="",
                created_at=datetime(2026, 1, 1, 15, 1, tzinfo=timezone.utc)))
    db.commit()
date_results = client.get("/api/posts", params={"account_id": "account-bom",
    "created_at_from": "2026-01-02T00:00:00+09:00", "created_at_to": "2026-01-02T23:59:59.999999+09:00"})
assert date_results.status_code == 200, date_results.text
assert [item["id"] for item in date_results.json()["items"]] == ["post-kst-after"], date_results.json()
ranked_accounts = client.get("/api/accounts/search", params={"sort": "post_count", "limit": 1})
assert ranked_accounts.status_code == 200, ranked_accounts.text
assert ranked_accounts.json()["items"][0]["account"]["handle"] == "bom"
assert ranked_accounts.json()["has_more"] is True
next_accounts = client.get("/api/accounts/search", params={"sort": "post_count", "limit": 1,
    "cursor": ranked_accounts.json()["next_cursor"]})
assert next_accounts.json()["items"][0]["account"]["handle"] == "ari"
assert client.get("/api/accounts/search", params={"sort": "recent"}).status_code == 200
with Session(engine) as db:
    db.add(PostAsset(id="asset-ari", post_id="post-ari", type="image", src="/assets/photo.png", url="/assets/photo.png"))
    db.commit()
assert [item["id"] for item in client.get("/api/posts", params={"account_id": "account-ari", "has_assets": "true"}).json()["items"]] == ["post-ari"]
assert client.get("/api/posts", params={"account_id": "account-bom", "has_assets": "true"}).json()["items"] == []

assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": ["post-ari"]}).status_code == 200
assert len(client.get("/api/accounts/account-ari/pinned-posts").json()) == 1
assert client.get("/api/posts", params={"account_id": "account-ari", "exclude_pinned": "true"}).json()["items"] == []
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": ["post-ari", "post-ari"]}).status_code == 422
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": ["a", "b", "c", "d"]}).status_code == 422
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": ["post-bom"]}).status_code == 403
with Session(engine) as db:
    db.add(Post(id="post-extra", account_id="account-ari", title="Extra", text=""))
    db.commit()
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": ["post-ari", "post-extra"]}).status_code == 200
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": ["post-extra", "post-ari"]}).status_code == 200
assert [item["id"] for item in client.get("/api/accounts/account-ari/pinned-posts").json()] == ["post-extra", "post-ari"]
assert client.delete("/api/posts/post-extra").status_code == 204
assert [item["id"] for item in client.get("/api/accounts/account-ari/pinned-posts").json()] == ["post-ari"]
active_user["id"] = "bom"
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": []}).status_code == 403
assert client.patch("/api/accounts/account-ari", json={"cover_url": "/assets/other.jpg"}).status_code == 403
active_user["id"] = "ari"

updated = client.patch("/api/accounts/account-ari", json={"cover_url": "/assets/cover.jpg", "profile_links": [{"label": "Site", "url": "https://example.com"}]})
assert updated.status_code == 200, updated.text
assert updated.json()["profile_source"] == "user"
assert updated.json()["profile_links"][0]["label"] == "Site"
assert client.patch("/api/accounts/account-ari", json={"cover_url": "javascript:alert(1)"}).status_code == 422
assert client.patch("/api/accounts/account-ari", json={"profile_links": [{"label": str(index), "url": "https://example.com"} for index in range(4)]}).status_code == 422
assert client.patch("/api/accounts/account-ari", json={"profile_links": [{"label": "bad", "url": "javascript:alert(1)"}]}).status_code == 422

with Session(engine) as db:
    first = db.get(Account, "account-ari")
    upsert_post(db, ExternalImportPost(external_id="ext-ari", account_external_id="ext-ari", title="Updated"),
                account=first, batch_external_id="batch", dry_run=False, summary=ImportSummary())
    db.commit()
    assert len(db.exec(select(ProfilePin)).all()) == 1
    second = db.get(Account, "account-bom")
    upsert_post(db, ExternalImportPost(external_id="ext-ari", account_external_id="ext-bom", title="Moved"),
                account=second, batch_external_id="batch", dry_run=False, summary=ImportSummary())
    db.commit()
    assert db.exec(select(ProfilePin)).all() == []

app.dependency_overrides.pop(get_current_user)
assert client.get("/api/accounts/account-ari/summary").status_code == 401
assert client.put("/api/accounts/account-ari/pinned-posts", json={"post_ids": []}).status_code == 401
assert client.patch("/api/accounts/account-ari", json={"cover_url": "/assets/cover.jpg"}).status_code == 401

examples = Path(__file__).resolve().parents[2] / "data" / "external_posts" / "examples"
samples = sorted(examples.rglob("feed_posts.json"))
top_level = examples / "feed_import_sample.json"
if top_level.exists():
    samples.append(top_level)
assert samples, "No golden samples found"
with TemporaryDirectory() as temporary_dir:
    database_url = f"sqlite:///{Path(temporary_dir) / 'golden.db'}"
    golden_engine = create_engine(database_url)
    SQLModel.metadata.create_all(golden_engine)
    golden_engine.dispose()
    for sample in samples:
        run_import(input_path=sample, dry_run=True, database_url=database_url, print_result=False)
print("Profile UX API regression passed")
