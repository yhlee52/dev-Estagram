"""make post asset sort_order nullable

Revision ID: 0004_mvp12_sort_order_nullable
Revises: 0003_mvp10_import_fields
Create Date: 2026-06-10
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004_mvp12_sort_order_nullable"
down_revision: str | None = "0003_mvp10_import_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "post_assets",
        "sort_order",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(sa.text("UPDATE post_assets SET sort_order = 0 WHERE sort_order IS NULL"))
    op.alter_column(
        "post_assets",
        "sort_order",
        existing_type=sa.Integer(),
        nullable=False,
    )
