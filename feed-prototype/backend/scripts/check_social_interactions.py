"""Small DB-backed API regression for likes and message rooms.

Uses in-memory SQLite and a dependency override so PostgreSQL is not required.
The production schema is still applied with Alembic before local API use.
"""

import base64
from datetime import datetime, timezone
from importlib import import_module
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.deps import get_current_user, get_session
from app.api.routes.likes import router as likes_router
from app.api.routes.messages import router as messages_router
from app.models.account import Account
from app.models.follow import Follow
from app.models.like import PostLike
from app.models.message import DirectMessage, MessageRoom, MessageRoomMember
from app.models.post import Post
from app.models.user import User


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kw):
    return "JSON"


engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
SQLModel.metadata.create_all(
    engine,
    tables=[User.__table__, Account.__table__, Post.__table__, PostLike.__table__,
            Follow.__table__, MessageRoom.__table__, MessageRoomMember.__table__,
            DirectMessage.__table__],
)
with Session(engine) as db:
    for user_id in ("alice", "bob", "carol"):
        db.add(User(id=user_id, handle=user_id, display_name=user_id))
        db.add(Account(id=f"account-{user_id}", user_id=user_id,
                       handle=user_id, display_name=user_id))
    db.add(Post(id="post-1", account_id="account-bob", title="Hello", text="World"))
    db.commit()

image_dir = TemporaryDirectory()
import_module("app.api.routes.messages").get_settings = lambda: SimpleNamespace(message_images_dir=Path(image_dir.name))

app = FastAPI()
app.include_router(likes_router)
app.include_router(messages_router)
active_user = ["alice"]


def session_override():
    with Session(engine) as db:
        yield db


def user_override():
    with Session(engine) as db:
        return db.get(User, active_user[0])


app.dependency_overrides[get_session] = session_override
app.dependency_overrides[get_current_user] = user_override
client = TestClient(app)

assert client.get("/api/posts/post-1/likes").json() == {
    "post_id": "post-1", "count": 0, "liked_by_me": False
}
assert client.post("/api/posts/post-1/likes").json()["count"] == 1
assert client.post("/api/posts/post-1/likes").json()["count"] == 1
active_user[0] = "bob"
assert client.post("/api/posts/post-1/likes").json()["count"] == 2
active_user[0] = "alice"
assert client.delete("/api/posts/post-1/likes").json()["count"] == 1
assert client.get("/api/posts/missing/likes").status_code == 404

assert client.post("/api/messages/with/account-alice", json={"text": "self"}).status_code == 400
assert client.post("/api/messages/direct/account-carol").status_code == 403
assert client.post("/api/messages/with/account-bob", json={"text": "   "}).status_code == 422
assert client.post("/api/messages/with/account-bob", json={"text": "first"}).status_code == 403
assert client.post("/api/messages/rooms", json={"account_ids": ["account-bob", "account-carol"]}).status_code == 403
with Session(engine) as db:
    db.add(Follow(id="follow-alice-bob", follower_user_id="alice", following_account_id="account-bob"))
    db.commit()
sent = client.post("/api/messages/with/account-bob", json={"text": " Hello "})
assert sent.status_code == 201 and sent.json()["text"] == "Hello"
assert len(client.get("/api/messages/with/account-bob").json()) == 1
assert client.get("/api/messages/conversations").json()[0]["account"]["id"] == "account-bob"
active_user[0] = "bob"
assert client.get("/api/messages/with/account-alice").json()[0]["text"] == "Hello"
reply = client.post("/api/messages/with/account-alice", json={"text": "Hi"})
assert reply.status_code == 201

active_user[0] = "alice"
direct_room_id = next(room["id"] for room in client.get("/api/messages/rooms").json()
                      if any(member["id"] == "account-bob" for member in room["members"]))
with Session(engine) as db:
    db.delete(db.get(Follow, "follow-alice-bob"))
    db.commit()
assert client.post("/api/messages/direct/account-bob").status_code == 201
assert client.post("/api/messages/with/account-bob", json={"text": "Still here"}).status_code == 201
assert client.post(f"/api/messages/rooms/{direct_room_id}/messages", json={"text": "After unfollow"}).status_code == 201
assert client.post(f"/api/messages/rooms/{direct_room_id}/members", json={"account_ids": ["account-carol"]}).status_code == 403
with Session(engine) as db:
    db.add(Follow(id="follow-alice-bob", follower_user_id="alice", following_account_id="account-bob"))
    db.add(Follow(id="follow-alice-carol", follower_user_id="alice", following_account_id="account-carol"))
    db.commit()
invited = client.post(f"/api/messages/rooms/{direct_room_id}/members", json={"account_ids": ["account-carol"]})
assert invited.status_code == 200 and invited.json()["kind"] == "group"
active_user[0] = "carol"
assert client.get(f"/api/messages/rooms/{direct_room_id}").json()["messages"] == []
active_user[0] = "alice"
assert client.post(f"/api/messages/rooms/{direct_room_id}/messages", json={"text": "Welcome"}).status_code == 201
active_user[0] = "carol"
assert [item["text"] for item in client.get(f"/api/messages/rooms/{direct_room_id}").json()["messages"]] == ["Welcome"]
active_user[0] = "alice"
group = client.post("/api/messages/rooms", json={"account_ids": ["account-bob", "account-carol"], "name": "Team"})
assert group.status_code == 201 and group.json()["kind"] == "group"
room_id = group.json()["id"]
assert client.get(f"/api/messages/rooms/{room_id}").status_code == 200
assert client.post(f"/api/messages/rooms/{room_id}/members", json={"account_ids": ["account-bob"]}).status_code == 409
assert client.post("/api/messages/rooms", json={"account_ids": ["account-bob", "account-bob"]}).status_code == 400
with Session(engine) as db:
    db.delete(db.get(Follow, "follow-alice-bob"))
    db.delete(db.get(Follow, "follow-alice-carol"))
    db.commit()
posted = client.post(f"/api/messages/rooms/{room_id}/messages", json={"text": "Hello team"})
assert posted.status_code == 201

png = base64.b64encode(base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
)).decode()
image = client.post(f"/api/messages/rooms/{room_id}/images", json={"data_base64": png, "text": "Photo"})
assert image.status_code == 201 and image.json()["image_url"]
image_url = image.json()["image_url"]
assert client.get(image_url).status_code == 200
assert client.post(f"/api/messages/rooms/{room_id}/images", json={"data_base64": "!!!"}).status_code == 422
assert client.post(f"/api/messages/rooms/{room_id}/images", json={"data_base64": base64.b64encode(b"not an image").decode()}).status_code == 415
assert client.post(f"/api/messages/rooms/{room_id}/images", json={"data_base64": base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024)).decode()}).status_code == 413

active_user[0] = "bob"
assert client.get(f"/api/messages/rooms/{room_id}").json()["messages"][-1]["text"] == "Photo"
assert client.get(image_url).status_code == 200
assert client.post(f"/api/messages/rooms/{room_id}/messages", json={"text": "No follows needed"}).status_code == 201
assert client.post(f"/api/messages/rooms/{room_id}/images", json={"data_base64": png}).status_code == 201
assert client.post(f"/api/messages/rooms/{room_id}/members", json={"account_ids": ["account-carol"]}).status_code == 403
active_user[0] = "carol"
assert client.get(f"/api/messages/rooms/{room_id}").status_code == 200
assert client.get(image_url).status_code == 200
assert client.post(f"/api/messages/rooms/{room_id}/messages", json={"text": "I can reply too"}).status_code == 201
assert client.delete(f"/api/messages/rooms/{room_id}/members/me").status_code == 204
assert client.get(f"/api/messages/rooms/{room_id}").status_code == 404
assert client.get(image_url).status_code == 404
assert client.post(f"/api/messages/rooms/{room_id}/messages", json={"text": "left"}).status_code == 404
active_user[0] = "carol"
assert client.get("/api/messages/with/account-alice").json() == []
assert client.get("/api/messages/conversations").json() == []
with Session(engine) as db:
    account = db.get(Account, "account-bob")
    account.deactivated_at = datetime.now(timezone.utc)
    db.add(account)
    db.commit()
assert client.post("/api/messages/with/account-bob", json={"text": "Hi"}).status_code == 409
del app.dependency_overrides[get_current_user]
assert client.post("/api/posts/post-1/likes").status_code == 401
assert client.get("/api/messages/conversations").status_code == 401
image_dir.cleanup()
print("Social interaction API regression passed")
