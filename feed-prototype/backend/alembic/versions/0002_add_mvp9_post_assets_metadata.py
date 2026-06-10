"""add mvp9 post asset metadata fields

Revision ID: 0002_mvp9_assets_metadata
Revises: 0001_create_initial_feed_tables
Create Date: 2026-06-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0002_mvp9_assets_metadata"
down_revision: str | None = "0001_create_initial_feed_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("tags", sa.JSON(), nullable=True))
    op.execute(sa.text("UPDATE posts SET tags = '[]' WHERE tags IS NULL"))
    op.alter_column("posts", "tags", existing_type=sa.JSON(), nullable=False)

    op.add_column("post_assets", sa.Column("url", sa.String(), nullable=True))
    op.execute(sa.text("UPDATE post_assets SET url = src WHERE url IS NULL"))


def downgrade() -> None:
    op.drop_column("post_assets", "url")
    op.drop_column("posts", "tags")
