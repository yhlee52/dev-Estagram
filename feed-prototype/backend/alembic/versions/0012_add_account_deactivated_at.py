"""add account deactivated_at (v0.6.4 account lifecycle)

Revision ID: 0012_account_deactivated_at
Revises: 0011_auth_credentials_sessions
Create Date: 2026-06-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0012_account_deactivated_at"
down_revision: str | None = "0011_auth_credentials_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("accounts", "deactivated_at")
