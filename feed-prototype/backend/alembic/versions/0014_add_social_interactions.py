"""Add post likes and one-to-one text messages."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0014_social_interactions"
down_revision: str | None = "0013_s3_ingest_tracking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "post_likes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("post_id", sa.String(), sa.ForeignKey("posts.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "post_id", name="uq_post_likes_user_post"),
    )
    op.create_index("ix_post_likes_user_id", "post_likes", ["user_id"])
    op.create_index("ix_post_likes_post_id", "post_likes", ["post_id"])
    op.create_table(
        "direct_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("sender_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recipient_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("text", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_direct_messages_sender_user_id", "direct_messages", ["sender_user_id"])
    op.create_index("ix_direct_messages_recipient_user_id", "direct_messages", ["recipient_user_id"])
    op.create_index("ix_direct_messages_created_at", "direct_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_direct_messages_created_at", table_name="direct_messages")
    op.drop_index("ix_direct_messages_recipient_user_id", table_name="direct_messages")
    op.drop_index("ix_direct_messages_sender_user_id", table_name="direct_messages")
    op.drop_table("direct_messages")
    op.drop_index("ix_post_likes_post_id", table_name="post_likes")
    op.drop_index("ix_post_likes_user_id", table_name="post_likes")
    op.drop_table("post_likes")
