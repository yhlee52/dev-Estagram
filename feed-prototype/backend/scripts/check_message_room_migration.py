"""Verify that the room migration keeps existing direct-message history.

Creates and removes a disposable PostgreSQL database. The configured app
database is never populated by this check.
"""

import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import get_settings


def main() -> None:
    source = make_url(get_settings().database_url)
    if not source.drivername.startswith("postgresql"):
        raise RuntimeError("A PostgreSQL server is required")
    name = f"feed_message_check_{uuid4().hex[:12]}"
    admin = create_engine(source.set(database="postgres"), isolation_level="AUTOCOMMIT")
    created = False
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
        created = True
        test_url = source.set(database=name).render_as_string(hide_password=False)
        env = {**os.environ, "DATABASE_URL": test_url}
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "0018_post_account_refs"],
                       env=env, check=True, stdout=subprocess.DEVNULL)
        engine = create_engine(test_url)
        try:
            first_at = datetime.now(timezone.utc) - timedelta(days=1)
            with engine.begin() as connection:
                for user_id in ("alice", "bob"):
                    connection.execute(text(
                        "INSERT INTO users (id, handle, display_name, created_at, updated_at) "
                        "VALUES (:id, :id, :id, :at, :at)"
                    ), {"id": user_id, "at": first_at})
                for message_id, sender, recipient, at in (
                    ("old-1", "alice", "bob", first_at),
                    ("old-2", "bob", "alice", first_at + timedelta(minutes=1)),
                ):
                    connection.execute(text(
                        "INSERT INTO direct_messages "
                        "(id, sender_user_id, recipient_user_id, text, created_at) "
                        "VALUES (:id, :sender, :recipient, :body, :at)"
                    ), {"id": message_id, "sender": sender, "recipient": recipient,
                        "body": message_id, "at": at})
            subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"],
                           env=env, check=True, stdout=subprocess.DEVNULL)
            with engine.connect() as connection:
                messages = connection.execute(text(
                    "SELECT id, room_id, text FROM direct_messages ORDER BY created_at"
                )).mappings().all()
                assert [row["text"] for row in messages] == ["old-1", "old-2"]
                assert messages[0]["room_id"] == messages[1]["room_id"]
                room_id = messages[0]["room_id"]
                assert room_id is not None
                members = connection.execute(text(
                    "SELECT user_id FROM message_room_members WHERE room_id = :room_id ORDER BY user_id"
                ), {"room_id": room_id}).scalars().all()
                assert members == ["alice", "bob"]
                assert connection.execute(text(
                    "SELECT count(*) FROM message_room_members WHERE room_id = :room_id AND last_read_at IS NOT NULL"
                ), {"room_id": room_id}).scalar_one() == 2
                assert connection.execute(text(
                    "SELECT kind FROM message_rooms WHERE id = :room_id"
                ), {"room_id": room_id}).scalar_one() == "direct"
        finally:
            engine.dispose()
    finally:
        if created:
            with admin.connect() as connection:
                connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()
    print("Message room migration regression passed")


if __name__ == "__main__":
    main()
