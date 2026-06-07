from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.account import Account
from app.models.post import Post
from app.schemas.feed import AccountRead, PostRead


router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
def list_accounts(session: Session = Depends(get_session)) -> list[Account]:
    return list(session.exec(select(Account).order_by(Account.handle)).all())


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: str, session: Session = Depends(get_session)) -> Account:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    return account


@router.get("/{account_id}/posts", response_model=list[PostRead])
def list_account_posts(
    account_id: str,
    session: Session = Depends(get_session),
) -> list[Post]:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    posts = session.exec(
        select(Post)
        .where(Post.account_id == account_id)
        .order_by(Post.created_at.desc())
    ).all()
    return list(posts)
