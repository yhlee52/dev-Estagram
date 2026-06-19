"""Shared session-login helper for backend check scripts.

Write endpoints and self-scoped read endpoints (bookmarks, notifications,
follows) derive the acting user from the session cookie rather than trusting a
client-supplied user_id (v1.0.0). Check scripts therefore need to log in as a
specific actor before exercising those endpoints.

Import-created users get an unguessable random password (see
generate_random_password in app.services.auth), so this sets a known password
directly via the DB before logging in through the real /api/auth/login flow.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.db.session import create_session
from app.services.auth import set_user_password


CHECK_PASSWORD = "check-script-password-1234"


def set_known_password(user_id: str, password: str = CHECK_PASSWORD) -> None:
    with create_session() as session:
        set_user_password(session, user_id, password)
        session.commit()


def login(client: TestClient, user_id: str, password: str = CHECK_PASSWORD):
    return client.post("/api/auth/login", json={"login": user_id, "password": password})
