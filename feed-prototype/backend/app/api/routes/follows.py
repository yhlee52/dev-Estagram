from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.models.account import Account
from app.models.follow import Follow
from app.models.user import User
from app.schemas.feed import (
    AccountRead,
    FollowRead,
    FollowWithAccount,
    UserFollowsResponse,
)


router = APIRouter(tags=["follows"])


def _get_existing_follow(
    session: Session,
    user_id: str,
    account_id: str,
) -> Follow | None:
    return session.exec(
        select(Follow).where(
            Follow.follower_user_id == user_id,
            Follow.following_account_id == account_id,
        )
    ).first()


def _ensure_user_and_account(
    session: Session,
    user_id: str,
    account_id: str,
) -> None:
    if session.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    if session.get(Account, account_id) is None:
        raise HTTPException(status_code=404, detail="Account not found")


def _require_self(current_user: User, user_id: str) -> None:
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot access another user's follows"
        )


def _user_follows_response(session: Session, user_id: str) -> UserFollowsResponse:
    follows = list(
        session.exec(
            select(Follow)
            .where(Follow.follower_user_id == user_id)
            .order_by(Follow.created_at, Follow.following_account_id)
        ).all()
    )
    following_account_ids = [follow.following_account_id for follow in follows]

    accounts_by_id: dict[str, Account] = {}
    if following_account_ids:
        accounts = session.exec(
            select(Account).where(Account.id.in_(following_account_ids))
        ).all()
        accounts_by_id = {account.id: account for account in accounts}

    return UserFollowsResponse(
        user_id=user_id,
        following_account_ids=following_account_ids,
        follows=[
            FollowWithAccount(
                follow=FollowRead.model_validate(follow),
                account=AccountRead.model_validate(accounts_by_id[follow.following_account_id]),
            )
            for follow in follows
            if follow.following_account_id in accounts_by_id
        ],
    )


@router.get("/api/follows", response_model=list[FollowRead])
def list_follows(session: Session = Depends(get_session)) -> list[Follow]:
    follows = session.exec(
        select(Follow).order_by(Follow.follower_user_id, Follow.following_account_id)
    ).all()
    return list(follows)


@router.get("/api/users/{user_id}/follows", response_model=UserFollowsResponse)
def list_user_follows(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserFollowsResponse:
    _require_self(current_user, user_id)
    return _user_follows_response(session, user_id)


@router.post("/api/users/{user_id}/follows/{account_id}", response_model=UserFollowsResponse)
def follow_account(
    user_id: str,
    account_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserFollowsResponse:
    _require_self(current_user, user_id)
    _ensure_user_and_account(session, user_id, account_id)

    existing = _get_existing_follow(session, user_id, account_id)
    if existing is not None:
        return _user_follows_response(session, user_id)

    # v0.6.4: existing follows of a now-deactivated account are kept, but new
    # follows are not allowed (the account is hidden from discovery anyway).
    target = session.get(Account, account_id)
    if target is not None and target.deactivated_at is not None:
        raise HTTPException(
            status_code=409, detail="Cannot follow a deactivated account"
        )

    follow = Follow(
        id=f"follow-{uuid4()}",
        follower_user_id=user_id,
        following_account_id=account_id,
    )
    session.add(follow)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()

    return _user_follows_response(session, user_id)


@router.delete("/api/users/{user_id}/follows/{account_id}", response_model=UserFollowsResponse)
def unfollow_account(
    user_id: str,
    account_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserFollowsResponse:
    _require_self(current_user, user_id)
    _ensure_user_and_account(session, user_id, account_id)

    existing = _get_existing_follow(session, user_id, account_id)
    if existing is not None:
        session.delete(existing)
        session.commit()

    return _user_follows_response(session, user_id)
