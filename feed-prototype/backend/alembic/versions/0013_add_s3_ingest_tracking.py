"""add S3 ingestion tracking columns (v1.2.1)

Revision ID: 0013_s3_ingest_tracking
Revises: 0012_account_deactivated_at
Create Date: 2026-07-24

Add-only: nullable columns on `import_batch` (S3 batch lifecycle tracking, kept
separate from the existing success/failed `status` snapshot via a new
`ingest_state`) and on `post_assets` (permanent object identity for S3 assets).
Existing rows and the filesystem/HTTP import paths are untouched — every new
column is nullable and left NULL by them.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0013_s3_ingest_tracking"
down_revision: str | None = "0012_account_deactivated_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_IMPORT_BATCH_COLUMNS = [
    ("ingest_state", sa.String()),
    ("storage_backend", sa.String()),
    ("bucket", sa.String()),
    ("object_prefix", sa.String()),
    ("manifest_key", sa.String()),
    ("ready_key", sa.String()),
    ("discovered_at", sa.DateTime(timezone=True)),
    ("processing_started_at", sa.DateTime(timezone=True)),
    ("completed_at", sa.DateTime(timezone=True)),
    ("failed_at", sa.DateTime(timezone=True)),
    ("attempt_count", sa.Integer()),
    ("error_code", sa.String()),
    ("error_message", sa.String()),
    ("manifest_etag", sa.String()),
    ("manifest_last_modified", sa.DateTime(timezone=True)),
    ("created_post_count", sa.Integer()),
    ("created_asset_count", sa.Integer()),
]

_POST_ASSET_COLUMNS = [
    ("storage_backend", sa.String()),
    ("bucket", sa.String()),
    ("object_key", sa.String()),
    ("size_bytes", sa.Integer()),
    ("etag", sa.String()),
]


def upgrade() -> None:
    for name, col_type in _IMPORT_BATCH_COLUMNS:
        op.add_column("import_batch", sa.Column(name, col_type, nullable=True))
    op.create_index(
        op.f("ix_import_batch_ingest_state"),
        "import_batch",
        ["ingest_state"],
        unique=False,
    )
    for name, col_type in _POST_ASSET_COLUMNS:
        op.add_column("post_assets", sa.Column(name, col_type, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_POST_ASSET_COLUMNS):
        op.drop_column("post_assets", name)
    op.drop_index(op.f("ix_import_batch_ingest_state"), table_name="import_batch")
    for name, _ in reversed(_IMPORT_BATCH_COLUMNS):
        op.drop_column("import_batch", name)
