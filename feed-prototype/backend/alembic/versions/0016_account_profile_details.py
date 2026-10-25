"""Add optional cover and profile links to accounts."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0016_account_profile_details"
down_revision: str | None = "0015_local_storage_cleanup"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("cover_url", sa.String(), nullable=True))
    op.add_column("accounts", sa.Column("profile_links", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.alter_column("accounts", "profile_links", server_default=None)


def downgrade() -> None:
    op.drop_column("accounts", "profile_links")
    op.drop_column("accounts", "cover_url")
