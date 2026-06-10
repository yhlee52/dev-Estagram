from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.post import Post
from app.schemas.feed import AccountRead, PostAssetRead, PostRead, PostWithAssets
from app.services.post_filters import PostFilters, apply_post_filters


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


def get_post_assets(session: Session, post_id: str) -> list[PostAsset]:
    assets = session.exec(
        select(PostAsset)
        .where(PostAsset.post_id == post_id)
        .order_by(PostAsset.sort_order, PostAsset.created_at)
    ).all()
    return list(assets)


def build_post_with_assets(session: Session, post: Post) -> PostWithAssets:
    return PostWithAssets(
        **PostRead.model_validate(post).model_dump(),
        assets=[
            PostAssetRead.model_validate(asset)
            for asset in get_post_assets(session, post.id)
        ],
    )


@router.get("/{account_id}/posts", response_model=list[PostWithAssets])
def list_account_posts(
    account_id: str,
    keyword: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    metadata_key: str | None = Query(default=None),
    metadata_value: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    my_posts_only: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> list[PostWithAssets]:
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    posts = session.exec(
        select(Post)
        .where(Post.account_id == account_id)
        .order_by(Post.created_at.desc())
    ).all()
    filtered_posts, _, _ = apply_post_filters(
        session,
        posts,
        PostFilters(
            keyword=keyword,
            tag=tag,
            metadata_key=metadata_key,
            metadata_value=metadata_value,
            asset_type=asset_type,
            account_id=account_id,
            user_id=user_id,
            my_posts_only=my_posts_only,
        ),
    )
    return [build_post_with_assets(session, post) for post in filtered_posts]
