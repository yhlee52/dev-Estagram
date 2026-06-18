"""Shared cleanup helpers for backend check scripts.

Centralizes the deletion ordering the v0.6.0 auth tables require. A user has a
paired `user_credentials` row (and may have `user_sessions`), both with a FK to
`users.id`, so those must be deleted before the user. Check scripts that import
accounts (import provisions a paired user per account) should call
`delete_test_users` in their cleanup() instead of deleting `User` rows directly,
so this ordering lives in one place and cannot drift per script.
"""

from collections.abc import Iterable

from sqlmodel import Session, col, select

from app.models.auth import UserCredential, UserSession
from app.models.user import User


def delete_test_users(session: Session, user_ids: Iterable[str]) -> None:
    """Delete the given users and their auth rows in FK-safe order.

    For each id, delete its `user_credentials` (PK = user_id) and any
    `user_sessions`, flush so the auth -> users FK is satisfied, then delete the
    `users` rows. Missing rows are skipped. The caller still controls the commit.
    """
    ids = list(user_ids)
    if not ids:
        return

    for credential in session.exec(
        select(UserCredential).where(col(UserCredential.user_id).in_(ids))
    ).all():
        session.delete(credential)
    for auth_session in session.exec(
        select(UserSession).where(col(UserSession.user_id).in_(ids))
    ).all():
        session.delete(auth_session)

    session.flush()

    for user_id in ids:
        user = session.get(User, user_id)
        if user is not None:
            session.delete(user)
