"""Regression check for disk-backed imported assets without a database server."""

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

from app.api.routes.assets import get_asset
from app.core.config import Settings
from app.models.asset import PostAsset
from app.services.asset_storage import managed_asset_path
from app.services.asset_url import serialize_asset


class AssetSession:
    def __init__(self, asset: PostAsset):
        self.asset = asset

    def get(self, _model, asset_id: str):
        return self.asset if asset_id == self.asset.id else None


with TemporaryDirectory() as directory:
    settings = Settings(database_url="sqlite://", external_posts_dir=Path(directory))
    path = settings.resolved_managed_assets_dir / "batch-1" / "sample.svg"
    path.parent.mkdir(parents=True)
    path.write_text("<svg></svg>", encoding="utf-8")
    asset = PostAsset(
        id="asset-1", post_id="post-1", type="image",
        url="/assets/managed/batch-1/sample.svg",
        src="/assets/managed/batch-1/sample.svg",
    )
    assert managed_asset_path(asset.url, settings) == path.resolve()
    assert managed_asset_path("/assets/managed/../secret", settings) is None
    assert managed_asset_path("/assets/managed/batch-1/..\\secret", settings) is None
    assert managed_asset_path("/assets/other/sample.svg", settings) is None

    with patch("app.services.asset_url.get_settings", return_value=settings):
        read = serialize_asset(asset)
    assert read.url == "http://127.0.0.1:8000/api/assets/asset-1"
    assert read.src == read.url

    with patch("app.api.routes.assets.get_settings", return_value=settings):
        response = get_asset(asset.id, session=AssetSession(asset))
        assert Path(response.path) == path.resolve()
        assert response.media_type == "image/svg+xml"
        try:
            get_asset("missing", session=AssetSession(asset))
        except HTTPException as exc:
            assert exc.status_code == 404
        else:
            raise AssertionError("Missing asset should return 404")

print("Local asset serving regression passed")
