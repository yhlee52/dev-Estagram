"""add comments table (v0.5.0 collaboration)

Revision ID: 0007_comments_table
Revises: 0006_import_batch_table
Create Date: 2026-06-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0007_comments_table"
down_revision: str | None = "0006_import_batch_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add-only: a new collaboration table. Existing tables and the frozen
    # external package format are untouched.
    op.create_table(
        "comments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("post_id", sa.String(), nullable=False),
        sa.Column("author_user_id", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comments_post_id"), "comments", ["post_id"])
    op.create_index(
        op.f("ix_comments_author_user_id"), "comments", ["author_user_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_comments_author_user_id"), table_name="comments")
    op.drop_index(op.f("ix_comments_post_id"), table_name="comments")
    op.drop_table("comments")
