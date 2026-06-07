"""create initial feed tables

Revision ID: 0001_create_initial_feed_tables
Revises:
Create Date: 2026-06-07
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001_create_initial_feed_tables"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("handle", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("bio", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_handle"), "users", ["handle"], unique=True)

    op.create_table(
        "accounts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("handle", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("bio", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_accounts_handle"), "accounts", ["handle"], unique=True)

    op.create_table(
        "posts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_posts_account_id"), "posts", ["account_id"], unique=False)

    op.create_table(
        "follows",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("follower_user_id", sa.String(), nullable=False),
        sa.Column("following_account_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["follower_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["following_account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "follower_user_id",
            "following_account_id",
            name="uq_follows_follower_user_following_account",
        ),
    )

    op.create_table(
        "post_assets",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("post_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("src", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_post_assets_post_id"), "post_assets", ["post_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_post_assets_post_id"), table_name="post_assets")
    op.drop_table("post_assets")
    op.drop_table("follows")
    op.drop_index(op.f("ix_posts_account_id"), table_name="posts")
    op.drop_table("posts")
    op.drop_index(op.f("ix_accounts_handle"), table_name="accounts")
    op.drop_table("accounts")
    op.drop_index(op.f("ix_users_handle"), table_name="users")
    op.drop_table("users")
