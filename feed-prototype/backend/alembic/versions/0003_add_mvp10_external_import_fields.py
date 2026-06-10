"""add mvp10 external import fields

Revision ID: 0003_mvp10_import_fields
Revises: 0002_mvp9_assets_metadata
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0003_mvp10_import_fields"
down_revision: str | None = "0002_mvp9_assets_metadata"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("external_id", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_accounts_external_id"),
        "accounts",
        ["external_id"],
        unique=True,
    )

    op.add_column("posts", sa.Column("external_id", sa.String(), nullable=True))
    op.add_column("posts", sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "posts",
        sa.Column("import_batch_external_id", sa.String(), nullable=True),
    )
    op.create_index(op.f("ix_posts_external_id"), "posts", ["external_id"], unique=True)
    op.create_index(
        op.f("ix_posts_import_batch_external_id"),
        "posts",
        ["import_batch_external_id"],
        unique=False,
    )

    op.add_column("post_assets", sa.Column("external_id", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_post_assets_external_id"),
        "post_assets",
        ["external_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_post_assets_external_id"), table_name="post_assets")
    op.drop_column("post_assets", "external_id")

    op.drop_index(op.f("ix_posts_import_batch_external_id"), table_name="posts")
    op.drop_index(op.f("ix_posts_external_id"), table_name="posts")
    op.drop_column("posts", "import_batch_external_id")
    op.drop_column("posts", "imported_at")
    op.drop_column("posts", "external_id")

    op.drop_index(op.f("ix_accounts_external_id"), table_name="accounts")
    op.drop_column("accounts", "external_id")
