"""Small DB-backed API regression for local likes and direct messages.

Uses in-memory SQLite and a dependency override so PostgreSQL is not required.
The production schema is still applied with Alembic before local API use.
"""

from datetime import datetime, timezone

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
from app.models.like import PostLike
from app.models.message import DirectMessage
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
    tables=[User.__table__, Account.__table__, Post.__table__, PostLike.__table__, DirectMessage.__table__],
)
with Session(engine) as db:
    for user_id in ("alice", "bob", "carol"):
        db.add(User(id=user_id, handle=user_id, display_name=user_id))
        db.add(Account(id=f"account-{user_id}", user_id=user_id,
                       handle=user_id, display_name=user_id))
    db.add(Post(id="post-1", account_id="account-bob", title="Hello", text="World"))
    db.commit()

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
assert client.post("/api/messages/with/account-bob", json={"text": "   "}).status_code == 422
sent = client.post("/api/messages/with/account-bob", json={"text": " Hello "})
assert sent.status_code == 201 and sent.json()["text"] == "Hello"
assert len(client.get("/api/messages/with/account-bob").json()) == 1
assert client.get("/api/messages/conversations").json()[0]["account"]["id"] == "account-bob"
active_user[0] = "bob"
assert client.get("/api/messages/with/account-alice").json()[0]["text"] == "Hello"
reply = client.post("/api/messages/with/account-alice", json={"text": "Hi"})
assert reply.status_code == 201
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
print("Social interaction API regression passed")
