"""Asset proxy for object-storage assets (v1.2.4).

`GET /api/assets/{asset_id}` streams the S3/MinIO object for an S3-backed asset.
The frontend receives this absolute URL from the serializer (see
`app.services.asset_url`) and uses it as a normal `<img src>`/link. The object
binary stays in S3; the DB only holds its identity. Only S3-backed assets are
served here — local/remote-url assets keep their own url and never hit this
route.
"""

from __future__ import annotations

import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from app.api.deps import get_session
from app.core.config import get_settings
from app.models.asset import PostAsset
from app.services.s3_storage import ObjectNotFound, S3IngestConfig, S3ObjectStore

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/{asset_id}")
def get_asset(asset_id: str, session: Session = Depends(get_session)) -> Response:
    asset = session.get(PostAsset, asset_id)
    if asset is None or asset.storage_backend != "s3" or not asset.object_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found or not object-storage backed.",
        )

    config = S3IngestConfig.from_settings(get_settings())
    store = S3ObjectStore.from_config(config)
    try:
        data = store.get_bytes(asset.object_key)
    except ObjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Object not found in storage.",
        ) from exc

    media_type = (
        asset.mime_type
        or mimetypes.guess_type(asset.object_key)[0]
        or "application/octet-stream"
    )
    return Response(content=data, media_type=media_type)
