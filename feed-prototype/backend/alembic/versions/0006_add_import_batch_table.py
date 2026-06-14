"""add import_batch table (v0.3.1 batch history)

Revision ID: 0006_import_batch_table
Revises: 0005_metadata_jsonb_gin
Create Date: 2026-06-14
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0006_import_batch_table"
down_revision: str | None = "0005_metadata_jsonb_gin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add-only: a new operational metadata table. Existing tables and
    # posts.import_batch_external_id are untouched.
    op.create_table(
        "import_batch",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("batch_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("first_imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("import_count", sa.Integer(), nullable=False),
        sa.Column("accounts_created", sa.Integer(), nullable=False),
        sa.Column("accounts_updated", sa.Integer(), nullable=False),
        sa.Column("users_created", sa.Integer(), nullable=False),
        sa.Column("users_updated", sa.Integer(), nullable=False),
        sa.Column("posts_created", sa.Integer(), nullable=False),
        sa.Column("posts_updated", sa.Integer(), nullable=False),
        sa.Column("posts_skipped", sa.Integer(), nullable=False),
        sa.Column("asset_replace_target_posts", sa.Integer(), nullable=False),
        sa.Column("assets_deleted", sa.Integer(), nullable=False),
        sa.Column("assets_created", sa.Integer(), nullable=False),
        sa.Column("errors", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_import_batch_external_id"),
        "import_batch",
        ["external_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_import_batch_external_id"), table_name="import_batch")
    op.drop_table("import_batch")
