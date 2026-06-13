from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import get_session
from app.schemas.feed import TagListResponse
from app.services.post_filters import DEFAULT_TAG_LIMIT, MAX_TAG_LIMIT, get_top_tags


router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=TagListResponse)
def list_tags(
    limit: int = Query(default=DEFAULT_TAG_LIMIT, ge=1, le=MAX_TAG_LIMIT),
    session: Session = Depends(get_session),
) -> TagListResponse:
    return TagListResponse(items=get_top_tags(session, limit=limit))
