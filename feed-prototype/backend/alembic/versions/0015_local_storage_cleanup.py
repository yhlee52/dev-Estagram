"""Remove obsolete object-ingestion columns after local asset conversion.

Revision ID: 0015_local_storage_cleanup
Revises: 0014_social_interactions
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0015_local_storage_cleanup"
down_revision: str | None = "0014_social_interactions"
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
    unresolved = op.get_bind().execute(
        sa.text(
            "SELECT count(*) FROM post_assets WHERE storage_backend = 's3' "
            "AND (url IS NULL OR url NOT LIKE '/assets/managed/%')"
        )
    ).scalar_one()
    if unresolved:
        raise RuntimeError(
            f"{unresolved} legacy assets still need local files or removal. "
            "Resolve them before running this migration."
        )

    for name, _ in reversed(_POST_ASSET_COLUMNS):
        op.drop_column("post_assets", name)
    op.drop_index(op.f("ix_import_batch_ingest_state"), table_name="import_batch")
    for name, _ in reversed(_IMPORT_BATCH_COLUMNS):
        op.drop_column("import_batch", name)


def downgrade() -> None:
    for name, column_type in _IMPORT_BATCH_COLUMNS:
        op.add_column("import_batch", sa.Column(name, column_type, nullable=True))
    op.create_index(op.f("ix_import_batch_ingest_state"), "import_batch", ["ingest_state"])
    for name, column_type in _POST_ASSET_COLUMNS:
        op.add_column("post_assets", sa.Column(name, column_type, nullable=True))
