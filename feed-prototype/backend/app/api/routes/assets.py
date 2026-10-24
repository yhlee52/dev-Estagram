"""Serve copied package assets from the configured local data directory."""

import mimetypes

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.api.deps import get_session
from app.core.config import get_settings
from app.models.asset import PostAsset
from app.services.asset_storage import managed_asset_path


router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/{asset_id}")
def get_asset(asset_id: str, session: Session = Depends(get_session)) -> FileResponse:
    asset = session.get(PostAsset, asset_id)
    path = managed_asset_path(asset.url or "", get_settings()) if asset else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Local asset not found")
    media_type = asset.mime_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)
