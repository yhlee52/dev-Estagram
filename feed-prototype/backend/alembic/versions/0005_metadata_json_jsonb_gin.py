"""convert posts.metadata_json to jsonb + gin index, add created_at keyset index

Revision ID: 0005_metadata_jsonb_gin
Revises: 0004_mvp12_sort_order_nullable
Create Date: 2026-06-13
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0005_metadata_jsonb_gin"
down_revision: str | None = "0004_mvp12_sort_order_nullable"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # JSON -> JSONB so we can use containment / `?` key-existence and a GIN index
    # for scalable metadata filtering (v0.1.0 Read at Scale).
    op.execute(
        sa.text(
            "ALTER TABLE posts "
            "ALTER COLUMN metadata_json TYPE JSONB "
            "USING metadata_json::jsonb"
        )
    )
    op.create_index(
        "ix_posts_metadata_json_gin",
        "posts",
        ["metadata_json"],
        postgresql_using="gin",
    )
    # Composite index supporting keyset pagination ordering on (created_at, id).
    op.create_index(
        "ix_posts_created_at_id",
        "posts",
        ["created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_posts_created_at_id", table_name="posts")
    op.drop_index("ix_posts_metadata_json_gin", table_name="posts")
    op.execute(
        sa.text(
            "ALTER TABLE posts "
            "ALTER COLUMN metadata_json TYPE JSON "
            "USING metadata_json::json"
        )
    )
