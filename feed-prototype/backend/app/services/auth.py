from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import secrets

from fastapi import HTTPException, Request, Response, status
from sqlmodel import Session, select

from app.models.account import Account
from app.models.auth import UserCredential, UserSession
from app.models.user import User
from app.schemas.feed import AccountRead, AuthSessionResponse, UserRead


SESSION_COOKIE_NAME = "feed_session_id"
SESSION_TTL = timedelta(days=7)
PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 260_000


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    encoded_digest = base64.b64encode(digest).decode("ascii")
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${salt}${encoded_digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_text, salt, encoded_digest = stored_hash.split("$", 3)
        iterations = int(iterations_text)
    except ValueError:
        return False

    if scheme != PASSWORD_SCHEME:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    expected_digest = base64.b64decode(encoded_digest.encode("ascii"))
    return hmac.compare_digest(digest, expected_digest)


def set_user_password(session: Session, user_id: str, password: str) -> None:
    credential = session.get(UserCredential, user_id)
    if credential is None:
        credential = UserCredential(user_id=user_id, password_hash=hash_password(password))
    else:
        credential.password_hash = hash_password(password)
        credential.updated_at = utc_now()
    session.add(credential)


def ensure_user_password(session: Session, user_id: str, password: str) -> None:
    if session.get(UserCredential, user_id) is not None:
        return

    session.add(UserCredential(user_id=user_id, password_hash=hash_password(password)))


def find_user_by_login(session: Session, login: str) -> User | None:
    normalized = login.strip().lower()
    if not normalized:
        return None

    user = session.get(User, login.strip())
    if user is not None:
        return user

    return session.exec(select(User).where(User.handle == normalized)).first()


def revoke_user_sessions(session: Session, user_id: str) -> int:
    """Delete all server-side sessions for a user (v0.6.4 deactivation).

    Returns the number of sessions removed. The caller controls the commit.
    """
    sessions = session.exec(
        select(UserSession).where(UserSession.user_id == user_id)
    ).all()
    for auth_session in sessions:
        session.delete(auth_session)
    return len(sessions)


def create_session_for_user(session: Session, user_id: str) -> UserSession:
    auth_session = UserSession(
        id=secrets.token_urlsafe(32),
        user_id=user_id,
        expires_at=utc_now() + SESSION_TTL,
    )
    session.add(auth_session)
    return auth_session


def set_session_cookie(response: Response, auth_session: UserSession) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        auth_session.id,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=False,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME)


def get_session_from_request(
    request: Request, session: Session
) -> tuple[UserSession, User] | None:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return None

    auth_session = session.get(UserSession, session_id)
    if auth_session is None:
        return None

    expires_at = auth_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= utc_now():
        session.delete(auth_session)
        session.commit()
        return None

    user = session.get(User, auth_session.user_id)
    if user is None:
        session.delete(auth_session)
        session.commit()
        return None

    return auth_session, user


def require_session_user(request: Request, session: Session) -> User:
    result = get_session_from_request(request, session)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not logged in.",
        )

    _, user = result
    return user


def build_auth_session_response(session: Session, user: User) -> AuthSessionResponse:
    account = session.exec(select(Account).where(Account.user_id == user.id)).first()
    return AuthSessionResponse(
        user=UserRead.model_validate(user),
        account=AccountRead.model_validate(account) if account is not None else None,
    )
