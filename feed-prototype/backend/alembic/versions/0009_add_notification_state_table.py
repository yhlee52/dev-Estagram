"""add notification state table (v0.5.2 collaboration)

Revision ID: 0009_notification_state
Revises: 0008_bookmarks_table
Create Date: 2026-06-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_notification_state"
down_revision: str | None = "0008_bookmarks_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add-only: notification items are derived from existing collaboration data;
    # this table stores only a per-user read watermark.
    op.create_table(
        "notification_state",
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("notification_state")
