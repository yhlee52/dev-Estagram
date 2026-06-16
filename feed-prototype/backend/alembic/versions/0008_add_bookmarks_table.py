"""add bookmarks table (v0.5.1 collaboration)

Revision ID: 0008_bookmarks_table
Revises: 0007_comments_table
Create Date: 2026-06-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0008_bookmarks_table"
down_revision: str | None = "0007_comments_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add-only: a new collaboration table. Existing tables and the frozen
    # external package format are untouched.
    op.create_table(
        "bookmarks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("post_id", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "post_id", name="uq_bookmarks_user_post"),
    )
    op.create_index(op.f("ix_bookmarks_user_id"), "bookmarks", ["user_id"])
    op.create_index(op.f("ix_bookmarks_post_id"), "bookmarks", ["post_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_bookmarks_post_id"), table_name="bookmarks")
    op.drop_index(op.f("ix_bookmarks_user_id"), table_name="bookmarks")
    op.drop_table("bookmarks")
