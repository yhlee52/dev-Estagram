from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models.auth import UserCredential
from app.schemas.feed import (
    AuthLoginRequest,
    AuthPasswordChangeRequest,
    AuthSessionResponse,
)
from app.services.auth import (
    build_auth_session_response,
    clear_session_cookie,
    create_session_for_user,
    find_user_by_login,
    get_session_from_request,
    require_session_user,
    set_session_cookie,
    set_user_password,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/session", response_model=AuthSessionResponse)
def get_current_session(
    request: Request, session: Session = Depends(get_session)
) -> AuthSessionResponse:
    user = require_session_user(request, session)
    return build_auth_session_response(session, user)


@router.post("/login", response_model=AuthSessionResponse)
def login(
    login_request: AuthLoginRequest,
    response: Response,
    session: Session = Depends(get_session),
) -> AuthSessionResponse:
    user = find_user_by_login(session, login_request.login)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id/handle or password.",
        )

    user_credential = session.get(UserCredential, user.id)
    if user_credential is None or not verify_password(
        login_request.password, user_credential.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id/handle or password.",
        )

    auth_session = create_session_for_user(session, user.id)
    session.commit()
    session.refresh(auth_session)
    set_session_cookie(response, auth_session)
    return build_auth_session_response(session, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
) -> None:
    session_result = get_session_from_request(request, session)
    if session_result is not None:
        auth_session, _ = session_result
        session.delete(auth_session)
        session.commit()
    clear_session_cookie(response)


@router.patch("/password", response_model=AuthSessionResponse)
def change_password(
    password_change: AuthPasswordChangeRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> AuthSessionResponse:
    user = require_session_user(request, session)

    user_credential = session.get(UserCredential, user.id)
    if user_credential is None or not verify_password(
        password_change.current_password, user_credential.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current password is incorrect.",
        )

    set_user_password(session, user.id, password_change.new_password)
    session.commit()
    return build_auth_session_response(session, user)
