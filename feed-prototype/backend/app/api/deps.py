from collections.abc import Generator

from sqlmodel import Session

from app.db.session import create_session


def get_session() -> Generator[Session, None, None]:
    with create_session() as session:
        yield session
