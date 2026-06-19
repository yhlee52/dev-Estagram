from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.api.deps import get_current_user, get_session
from app.models.user import User
from app.schemas.feed import NotificationReadState, PaginatedNotifications
from app.services.notifications import (
    DEFAULT_NOTIFICATION_LIMIT,
    MAX_NOTIFICATION_LIMIT,
    list_notifications,
    mark_all_notifications_read,
)


router = APIRouter(tags=["notifications"])


def _require_self(current_user: User, user_id: str) -> None:
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot access another user's notifications"
        )


@router.get(
    "/api/users/{user_id}/notifications",
    response_model=PaginatedNotifications,
)
def list_user_notifications(
    user_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(
        default=DEFAULT_NOTIFICATION_LIMIT, ge=1, le=MAX_NOTIFICATION_LIMIT
    ),
    unread_only: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PaginatedNotifications:
    _require_self(current_user, user_id)
    return list_notifications(
        session,
        user_id,
        cursor=cursor,
        limit=limit,
        unread_only=unread_only,
    )


@router.post(
    "/api/users/{user_id}/notifications/read-all",
    response_model=NotificationReadState,
)
def mark_user_notifications_read(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> NotificationReadState:
    _require_self(current_user, user_id)
    return mark_all_notifications_read(session, user_id)
