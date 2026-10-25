"""Store explicit person tags and resolved post-body mentions."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0018_post_account_refs"
down_revision: str | None = "0017_profile_pins"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "post_account_refs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("post_id", sa.String(), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.String(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.CheckConstraint("kind IN ('mention', 'tag')", name="ck_post_account_refs_kind"),
        sa.UniqueConstraint("post_id", "account_id", "kind", name="uq_post_account_refs_triplet"),
    )
    op.create_index("ix_post_account_refs_post_id", "post_account_refs", ["post_id"])
    op.create_index("ix_post_account_refs_account_id", "post_account_refs", ["account_id"])
    op.create_index("ix_post_account_refs_kind", "post_account_refs", ["kind"])
    op.create_index("ix_post_account_refs_account_kind_post", "post_account_refs", ["account_id", "kind", "post_id"])


def downgrade() -> None:
    op.drop_index("ix_post_account_refs_account_kind_post", table_name="post_account_refs")
    op.drop_index("ix_post_account_refs_kind", table_name="post_account_refs")
    op.drop_index("ix_post_account_refs_account_id", table_name="post_account_refs")
    op.drop_index("ix_post_account_refs_post_id", table_name="post_account_refs")
    op.drop_table("post_account_refs")
