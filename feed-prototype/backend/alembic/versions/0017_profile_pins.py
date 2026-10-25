"""Add ordered profile pins."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0017_profile_pins"
down_revision: str | None = "0016_account_profile_details"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profile_pins",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("account_id", sa.String(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", sa.String(), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("account_id", "post_id", name="uq_profile_pins_account_post"),
        sa.UniqueConstraint("account_id", "position", name="uq_profile_pins_account_position"),
    )
    op.create_index("ix_profile_pins_account_id", "profile_pins", ["account_id"])
    op.create_index("ix_profile_pins_post_id", "profile_pins", ["post_id"])


def downgrade() -> None:
    op.drop_index("ix_profile_pins_post_id", table_name="profile_pins")
    op.drop_index("ix_profile_pins_account_id", table_name="profile_pins")
    op.drop_table("profile_pins")
