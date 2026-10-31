"""Track when each room member last read messages."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0020_message_read_state"
down_revision: str | None = "0019_message_rooms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("message_room_members", sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True))
    # Existing conversations were visible before read tracking existed. Start
    # counting only messages that arrive after this migration.
    op.execute("UPDATE message_room_members SET last_read_at = CURRENT_TIMESTAMP")


def downgrade() -> None:
    op.drop_column("message_room_members", "last_read_at")
