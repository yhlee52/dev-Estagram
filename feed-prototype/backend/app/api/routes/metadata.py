from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import get_session
from app.schemas.feed import MetadataKeyListResponse, MetadataValueListResponse
from app.services.post_filters import (
    DEFAULT_FACET_LIMIT,
    MAX_FACET_LIMIT,
    get_metadata_keys,
    get_metadata_values,
)


router = APIRouter(prefix="/api/metadata", tags=["metadata"])


@router.get("/keys", response_model=MetadataKeyListResponse)
def list_metadata_keys(
    limit: int = Query(default=DEFAULT_FACET_LIMIT, ge=1, le=MAX_FACET_LIMIT),
    session: Session = Depends(get_session),
) -> MetadataKeyListResponse:
    return MetadataKeyListResponse(items=get_metadata_keys(session, limit=limit))


@router.get("/values", response_model=MetadataValueListResponse)
def list_metadata_values(
    key: str = Query(...),
    limit: int = Query(default=DEFAULT_FACET_LIMIT, ge=1, le=MAX_FACET_LIMIT),
    session: Session = Depends(get_session),
) -> MetadataValueListResponse:
    return MetadataValueListResponse(
        key=key,
        items=get_metadata_values(session, key, limit=limit),
    )
