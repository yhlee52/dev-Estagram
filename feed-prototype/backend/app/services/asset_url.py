"""Turn managed local asset paths into browser-usable backend URLs."""

from typing import Any

from app.core.config import get_settings
from app.schemas.feed import PostAssetRead
from app.services.asset_storage import managed_asset_path


def serialize_asset(asset: Any) -> PostAssetRead:
    read = PostAssetRead.model_validate(asset)
    settings = get_settings()
    if read.url and managed_asset_path(read.url, settings) is not None:
        proxy_url = f"{settings.local_asset_base_url.rstrip('/')}/api/assets/{asset.id}"
        read.url = proxy_url
        read.src = proxy_url
    return read
