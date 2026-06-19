from collections.abc import Generator

from fastapi import Depends, Request
from sqlmodel import Session

from app.db.session import create_session
from app.models.user import User
from app.services.auth import require_session_user


def get_session() -> Generator[Session, None, None]:
    with create_session() as session:
        yield session


def get_current_user(
    request: Request, session: Session = Depends(get_session)
) -> User:
    return require_session_user(request, session)
