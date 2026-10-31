"""Add message rooms, membership, and optional image attachments."""

from collections.abc import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "0019_message_rooms"
down_revision: str | None = "0018_post_account_refs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "message_rooms",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "message_room_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("room_id", sa.String(), sa.ForeignKey("message_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("room_id", "user_id", name="uq_message_room_member"),
    )
    op.create_index("ix_message_room_members_room_id", "message_room_members", ["room_id"])
    op.create_index("ix_message_room_members_user_id", "message_room_members", ["user_id"])
    op.add_column("direct_messages", sa.Column("room_id", sa.String(), sa.ForeignKey("message_rooms.id"), nullable=True))
    op.add_column("direct_messages", sa.Column("image_path", sa.String(), nullable=True))
    op.add_column("direct_messages", sa.Column("image_mime_type", sa.String(), nullable=True))
    op.alter_column("direct_messages", "recipient_user_id", existing_type=sa.String(), nullable=True)
    op.create_index("ix_direct_messages_room_id", "direct_messages", ["room_id"])

    connection = op.get_bind()
    rows = connection.execute(sa.text(
        "SELECT id, sender_user_id, recipient_user_id, created_at FROM direct_messages "
        "ORDER BY created_at, id"
    )).mappings().all()
    pairs: dict[tuple[str, str], str] = {}
    for row in rows:
        pair = tuple(sorted((row["sender_user_id"], row["recipient_user_id"])))
        room_id = pairs.get(pair)
        if room_id is None:
            room_id = f"room-{uuid4()}"
            pairs[pair] = room_id
            connection.execute(sa.text(
                "INSERT INTO message_rooms (id, kind, name, created_at) VALUES (:id, 'direct', NULL, :created_at)"
            ), {"id": room_id, "created_at": row["created_at"]})
            for user_id in pair:
                connection.execute(sa.text(
                    "INSERT INTO message_room_members (id, room_id, user_id, joined_at) "
                    "VALUES (:id, :room_id, :user_id, :joined_at)"
                ), {"id": f"member-{uuid4()}", "room_id": room_id,
                    "user_id": user_id, "joined_at": row["created_at"]})
        connection.execute(sa.text(
            "UPDATE direct_messages SET room_id = :room_id WHERE id = :id"
        ), {"room_id": room_id, "id": row["id"]})


def downgrade() -> None:
    # The old schema cannot represent group or image-only messages.
    op.execute("DELETE FROM direct_messages WHERE recipient_user_id IS NULL")
    op.drop_index("ix_direct_messages_room_id", table_name="direct_messages")
    op.alter_column("direct_messages", "recipient_user_id", existing_type=sa.String(), nullable=False)
    op.drop_column("direct_messages", "image_mime_type")
    op.drop_column("direct_messages", "image_path")
    op.drop_column("direct_messages", "room_id")
    op.drop_index("ix_message_room_members_user_id", table_name="message_room_members")
    op.drop_index("ix_message_room_members_room_id", table_name="message_room_members")
    op.drop_table("message_room_members")
    op.drop_table("message_rooms")
