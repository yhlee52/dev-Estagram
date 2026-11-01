"""Add an optional story display time without changing delivery clocks."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0021_historical_display_time"
down_revision: str | None = "0020_message_read_state"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("comments", sa.Column("display_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("direct_messages", sa.Column("display_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("direct_messages", "display_at")
    op.drop_column("comments", "display_at")
