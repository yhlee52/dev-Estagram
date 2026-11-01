"""Optional display time for operator-controlled imported accounts.

The server's created_at remains the delivery clock for ordering, room
membership, unread state, and reconciliation.
"""

from datetime import datetime, timezone

from fastapi import HTTPException
from app.core.config import get_settings


def validated_display_at(value: datetime | None, user_id: str) -> datetime | None:
    if value is None:
        return None
    if (not get_settings().enable_historical_display_at
            or not user_id.startswith("import-user-")):
        raise HTTPException(status_code=403, detail="Historical display time is unavailable")
    if value.tzinfo is None or value.utcoffset() is None:
        raise HTTPException(status_code=422, detail="Display time requires a timezone")
    result = value.astimezone(timezone.utc)
    if result > datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Display time cannot be in the future")
    return result
