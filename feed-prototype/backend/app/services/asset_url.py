"""Asset URL serialization for object-storage assets (v1.2.4).

The DB stores the permanent identity of an S3 asset (storage_backend / bucket /
object_key), never an expiring URL. At response time the API turns that identity
into a browser-usable URL pointing at the backend asset proxy
(`GET /api/assets/{id}`), which streams the object from S3/MinIO. This keeps
private buckets working, needs no frontend change (the frontend uses the stored
url directly), and never persists a presigned URL.

Non-S3 assets (existing local `/assets/...` or remote `http(s)://` urls) are left
exactly as-is.
"""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.schemas.feed import PostAssetRead

STORAGE_BACKEND_S3 = "s3"


def s3_asset_proxy_url(
    *,
    asset_id: str,
    storage_backend: str | None,
    object_key: str | None,
    base_url: str,
) -> str | None:
    """Absolute proxy URL for an S3-backed asset, or None if the asset is not
    object-storage backed. Pure (no settings/DB) so it is unit-testable."""
    if storage_backend == STORAGE_BACKEND_S3 and object_key:
        return f"{base_url.rstrip('/')}/api/assets/{asset_id}"
    return None


def serialize_asset(asset: Any, *, base_url: str | None = None) -> PostAssetRead:
    """Serialize a `PostAsset` ORM row to `PostAssetRead`, rewriting url/src to
    the proxy URL for S3 assets. `base_url` defaults to
    `Settings.asset_proxy_base_url` (injectable for tests)."""
    read = PostAssetRead.model_validate(asset)
    if base_url is None:
        base_url = get_settings().asset_proxy_base_url
    proxy = s3_asset_proxy_url(
        asset_id=asset.id,
        storage_backend=getattr(asset, "storage_backend", None),
        object_key=getattr(asset, "object_key", None),
        base_url=base_url,
    )
    if proxy is not None:
        read.url = proxy
        read.src = proxy
    return read
