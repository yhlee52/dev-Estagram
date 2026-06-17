"""add account profile source (v0.6.2 profile self-service)

Revision ID: 0010_account_profile_source
Revises: 0009_notification_state
Create Date: 2026-06-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0010_account_profile_source"
down_revision: str | None = "0009_notification_state"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column(
            "profile_source",
            sa.String(),
            nullable=False,
            server_default="import",
        ),
    )
    op.execute(
        "UPDATE accounts SET profile_source = 'user' WHERE external_id IS NULL"
    )
    op.alter_column("accounts", "profile_source", server_default=None)


def downgrade() -> None:
    op.drop_column("accounts", "profile_source")
