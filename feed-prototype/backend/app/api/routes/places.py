from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlmodel import Session

from app.api.deps import get_session

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("")
def list_places(
    prefix: str = Query(default=""),
    limit: int = Query(default=8, ge=1, le=100),
    session: Session = Depends(get_session),
) -> dict:
    escaped = prefix.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = session.execute(text(
        "SELECT metadata_json ->> 'location' AS value, count(*) AS usage_count"
        " FROM posts WHERE jsonb_typeof(metadata_json -> 'location') = 'string'"
        " AND metadata_json ->> 'location' ILIKE :prefix ESCAPE '\\'"
        " GROUP BY value ORDER BY usage_count DESC, value ASC LIMIT :limit"
    ).bindparams(prefix=f"{escaped}%", limit=limit)).all()
    return {"items": [{"value": row.value, "count": row.usage_count} for row in rows]}
