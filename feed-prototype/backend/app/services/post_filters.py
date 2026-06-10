from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Iterable

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models.account import Account
from app.models.asset import PostAsset
from app.models.post import Post
from app.models.user import User


ALLOWED_ASSET_TYPES = {"image", "plot", "table", "file", "link"}


@dataclass(frozen=True)
class PostFilters:
    keyword: str | None = None
    tag: str | None = None
    metadata_key: str | None = None
    metadata_value: str | None = None
    asset_type: str | None = None
    account_id: str | None = None
    account_handle: str | None = None
    user_id: str | None = None
    my_posts_only: bool = False


def normalize_filter_value(value: str | None) -> str | None:
    if value is None:
        return None

    stripped_value = value.strip()
    return stripped_value or None


def normalize_post_filters(filters: PostFilters) -> PostFilters:
    return PostFilters(
        keyword=normalize_filter_value(filters.keyword),
        tag=normalize_filter_value(filters.tag),
        metadata_key=normalize_filter_value(filters.metadata_key),
        metadata_value=normalize_filter_value(filters.metadata_value),
        asset_type=normalize_filter_value(filters.asset_type),
        account_id=normalize_filter_value(filters.account_id),
        account_handle=normalize_filter_value(filters.account_handle),
        user_id=normalize_filter_value(filters.user_id),
        my_posts_only=filters.my_posts_only,
    )


def get_assets_by_post_id(
    session: Session,
    post_ids: Iterable[str],
) -> dict[str, list[PostAsset]]:
    post_id_list = list(dict.fromkeys(post_ids))
    assets_by_post_id: dict[str, list[PostAsset]] = {
        post_id: [] for post_id in post_id_list
    }

    if not post_id_list:
        return assets_by_post_id

    assets = session.exec(
        select(PostAsset)
        .where(PostAsset.post_id.in_(post_id_list))
        .order_by(
            col(PostAsset.sort_order).is_(None),
            PostAsset.sort_order,
            PostAsset.created_at,
            PostAsset.id,
        )
    ).all()

    for asset in assets:
        assets_by_post_id.setdefault(asset.post_id, []).append(asset)

    return assets_by_post_id


def get_accounts_by_id(
    session: Session,
    account_ids: Iterable[str],
) -> dict[str, Account]:
    account_id_list = list(dict.fromkeys(account_ids))
    if not account_id_list:
        return {}

    accounts = session.exec(
        select(Account).where(Account.id.in_(account_id_list))
    ).all()
    return {account.id: account for account in accounts}


def get_account_id_by_handle(session: Session, handle: str) -> str | None:
    account = session.exec(select(Account).where(Account.handle == handle)).first()
    return account.id if account is not None else None


def get_user_account_id(session: Session, user_id: str) -> str:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    account = session.exec(select(Account).where(Account.user_id == user_id)).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found for user")

    return account.id


def validate_post_filters(session: Session, filters: PostFilters) -> PostFilters:
    normalized_filters = normalize_post_filters(filters)

    if (
        normalized_filters.asset_type is not None
        and normalized_filters.asset_type not in ALLOWED_ASSET_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid asset_type. Expected one of: "
                + ", ".join(sorted(ALLOWED_ASSET_TYPES))
            ),
        )

    if (
        normalized_filters.metadata_value is not None
        and normalized_filters.metadata_key is None
    ):
        raise HTTPException(
            status_code=400,
            detail="metadata_key is required when metadata_value is set",
        )

    if normalized_filters.my_posts_only and normalized_filters.user_id is None:
        raise HTTPException(
            status_code=400,
            detail="user_id is required when my_posts_only is true",
        )

    if normalized_filters.my_posts_only and normalized_filters.user_id is not None:
        get_user_account_id(session, normalized_filters.user_id)

    return normalized_filters


def metadata_value_to_text(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, default=str)

    return str(value)


def metadata_matches(
    metadata: dict[str, Any] | None,
    metadata_key: str,
    metadata_value: str | None,
) -> bool:
    if not isinstance(metadata, dict) or metadata_key not in metadata:
        return False

    if metadata_value is None:
        return True

    value_text = metadata_value_to_text(metadata[metadata_key]).casefold()
    return metadata_value.casefold() in value_text


def keyword_matches(post: Post, account: Account | None, keyword: str) -> bool:
    needle = keyword.casefold()
    haystacks = [
        post.title,
        post.text,
        account.handle if account is not None else "",
        account.display_name if account is not None else "",
    ]

    return any(needle in haystack.casefold() for haystack in haystacks)


def tag_matches(post: Post, tag: str) -> bool:
    needle = tag.casefold()
    return any(
        post_tag.casefold() == needle
        for post_tag in (post.tags or [])
        if isinstance(post_tag, str)
    )


def asset_type_matches(assets: list[PostAsset], asset_type: str) -> bool:
    return any(asset.type == asset_type for asset in assets)


def apply_post_filters(
    session: Session,
    posts: Iterable[Post],
    filters: PostFilters,
) -> tuple[list[Post], dict[str, Account], dict[str, list[PostAsset]]]:
    normalized_filters = validate_post_filters(session, filters)
    post_list = list(posts)

    accounts_by_id = get_accounts_by_id(
        session,
        [post.account_id for post in post_list],
    )
    assets_by_post_id = get_assets_by_post_id(
        session,
        [post.id for post in post_list],
    )

    effective_account_id = normalized_filters.account_id
    if effective_account_id is None and normalized_filters.account_handle is not None:
        effective_account_id = get_account_id_by_handle(
            session,
            normalized_filters.account_handle,
        )
        if effective_account_id is None:
            return [], accounts_by_id, assets_by_post_id

    my_posts_account_id = (
        get_user_account_id(session, normalized_filters.user_id)
        if normalized_filters.my_posts_only and normalized_filters.user_id is not None
        else None
    )

    filtered_posts: list[Post] = []
    for post in post_list:
        account = accounts_by_id.get(post.account_id)
        assets = assets_by_post_id.get(post.id, [])

        if effective_account_id is not None and post.account_id != effective_account_id:
            continue

        if my_posts_account_id is not None and post.account_id != my_posts_account_id:
            continue

        if normalized_filters.keyword is not None and not keyword_matches(
            post,
            account,
            normalized_filters.keyword,
        ):
            continue

        if normalized_filters.tag is not None and not tag_matches(
            post,
            normalized_filters.tag,
        ):
            continue

        if (
            normalized_filters.metadata_key is not None
            and not metadata_matches(
                post.metadata_json,
                normalized_filters.metadata_key,
                normalized_filters.metadata_value,
            )
        ):
            continue

        if (
            normalized_filters.asset_type is not None
            and not asset_type_matches(assets, normalized_filters.asset_type)
        ):
            continue

        filtered_posts.append(post)

    return filtered_posts, accounts_by_id, assets_by_post_id
