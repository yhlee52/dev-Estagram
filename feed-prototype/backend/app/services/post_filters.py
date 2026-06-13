from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import and_, or_, text
from sqlmodel import Session, col, select
from sqlmodel.sql.expression import SelectOfScalar

from app.models.account import Account
from app.models.asset import PostAsset
from app.models.post import Post
from app.models.user import User
from app.schemas.feed import TagCount


ALLOWED_ASSET_TYPES = {"image", "plot", "table", "file", "link"}
ALLOWED_SORTS = {"newest", "oldest"}

DEFAULT_LIMIT = 20
MAX_LIMIT = 100

DEFAULT_TAG_LIMIT = 20
MAX_TAG_LIMIT = 100

_DATE_ONLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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
    created_at_from: str | None = None
    created_at_to: str | None = None


@dataclass(frozen=True)
class PostPagination:
    sort: str = "newest"
    cursor: str | None = None
    limit: int = DEFAULT_LIMIT


@dataclass(frozen=True)
class PostPage:
    posts: list[Post]
    next_cursor: str | None
    has_more: bool


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
        created_at_from=normalize_filter_value(filters.created_at_from),
        created_at_to=normalize_filter_value(filters.created_at_to),
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


def get_top_tags(session: Session, *, limit: int = DEFAULT_TAG_LIMIT) -> list[TagCount]:
    """Return the most-used post tags, highest count first.

    Tags are grouped case-insensitively to match the `tag` filter semantics
    (which compares with ``lower(...)``), so ``#Chamber`` and ``#chamber`` count
    as one tag and are returned in lowercase. Posts with empty tag arrays do not
    contribute any rows.
    """
    rows = session.execute(
        text(
            "SELECT lower(tag_elem) AS tag, count(*) AS usage_count"
            " FROM posts, json_array_elements_text(posts.tags) AS tag_elem"
            " GROUP BY lower(tag_elem)"
            " ORDER BY usage_count DESC, tag ASC"
            " LIMIT :limit"
        ).bindparams(limit=limit)
    ).all()

    return [TagCount(tag=row.tag, count=row.usage_count) for row in rows]


def parse_date_bound(value: str, *, field_name: str) -> tuple[datetime, bool]:
    """Return (datetime, is_date_only) for a created_at_from/to bound.

    Accepts ISO date (YYYY-MM-DD) or ISO datetime. Naive values are treated as
    UTC so they compare consistently with stored UTC timestamps.
    """
    is_date_only = bool(_DATE_ONLY_RE.match(value))
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Use ISO date or datetime.",
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed, is_date_only


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

    bound_from = (
        parse_date_bound(normalized_filters.created_at_from, field_name="created_at_from")[0]
        if normalized_filters.created_at_from is not None
        else None
    )
    bound_to = (
        parse_date_bound(normalized_filters.created_at_to, field_name="created_at_to")[0]
        if normalized_filters.created_at_to is not None
        else None
    )
    if bound_from is not None and bound_to is not None and bound_from > bound_to:
        raise HTTPException(
            status_code=400,
            detail="created_at_from must be on or before created_at_to",
        )

    return normalized_filters


def validate_pagination(pagination: PostPagination) -> PostPagination:
    sort = (pagination.sort or "newest").strip().lower()
    if sort not in ALLOWED_SORTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid sort. Expected one of: " + ", ".join(sorted(ALLOWED_SORTS)),
        )

    limit = pagination.limit
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be at least 1")
    limit = min(limit, MAX_LIMIT)

    return PostPagination(
        sort=sort,
        cursor=normalize_filter_value(pagination.cursor),
        limit=limit,
    )


def encode_cursor(post: Post) -> str:
    raw = f"{post.created_at.isoformat()}|{post.id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        created_at_text, post_id = raw.split("|", 1)
        created_at = datetime.fromisoformat(created_at_text)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc

    return created_at, post_id


def apply_filters_to_select(
    session: Session,
    base_select: SelectOfScalar[Post],
    filters: PostFilters,
) -> tuple[SelectOfScalar[Post] | None, PostFilters]:
    """Apply filter conditions to a Post select.

    Returns (statement, normalized_filters). The statement is None when the
    filters can never match (e.g. an account_handle that does not exist), so the
    caller can short-circuit to an empty page.
    """
    normalized = validate_post_filters(session, filters)
    statement = base_select

    effective_account_id = normalized.account_id
    if effective_account_id is None and normalized.account_handle is not None:
        effective_account_id = get_account_id_by_handle(session, normalized.account_handle)
        if effective_account_id is None:
            return None, normalized

    if effective_account_id is not None:
        statement = statement.where(Post.account_id == effective_account_id)

    if normalized.my_posts_only and normalized.user_id is not None:
        my_account_id = get_user_account_id(session, normalized.user_id)
        statement = statement.where(Post.account_id == my_account_id)

    if normalized.keyword is not None:
        pattern = f"%{normalized.keyword}%"
        statement = statement.join(
            Account, col(Account.id) == col(Post.account_id)
        ).where(
            or_(
                col(Post.title).ilike(pattern),
                col(Post.text).ilike(pattern),
                col(Account.handle).ilike(pattern),
                col(Account.display_name).ilike(pattern),
            )
        )

    if normalized.tag is not None:
        statement = statement.where(
            text(
                "EXISTS (SELECT 1 FROM json_array_elements_text(posts.tags) AS tag_elem"
                " WHERE lower(tag_elem) = lower(:tag_value))"
            ).bindparams(tag_value=normalized.tag)
        )

    if normalized.metadata_key is not None:
        statement = statement.where(
            text("jsonb_exists(posts.metadata_json, :metadata_key)").bindparams(
                metadata_key=normalized.metadata_key
            )
        )
        if normalized.metadata_value is not None:
            statement = statement.where(
                text("(posts.metadata_json ->> :metadata_key) ILIKE :metadata_value").bindparams(
                    metadata_key=normalized.metadata_key,
                    metadata_value=f"%{normalized.metadata_value}%",
                )
            )

    if normalized.asset_type is not None:
        statement = statement.where(
            text(
                "EXISTS (SELECT 1 FROM post_assets pa"
                " WHERE pa.post_id = posts.id AND pa.type = :asset_type)"
            ).bindparams(asset_type=normalized.asset_type)
        )

    if normalized.created_at_from is not None:
        bound_from, _ = parse_date_bound(
            normalized.created_at_from, field_name="created_at_from"
        )
        statement = statement.where(Post.created_at >= bound_from)

    if normalized.created_at_to is not None:
        bound_to, is_date_only = parse_date_bound(
            normalized.created_at_to, field_name="created_at_to"
        )
        if is_date_only:
            statement = statement.where(Post.created_at < bound_to + timedelta(days=1))
        else:
            statement = statement.where(Post.created_at <= bound_to)

    return statement, normalized


def apply_sort_and_cursor(
    statement: SelectOfScalar[Post],
    pagination: PostPagination,
) -> SelectOfScalar[Post]:
    if pagination.sort == "oldest":
        statement = statement.order_by(col(Post.created_at).asc(), col(Post.id).asc())
        if pagination.cursor is not None:
            cursor_created_at, cursor_id = decode_cursor(pagination.cursor)
            statement = statement.where(
                or_(
                    Post.created_at > cursor_created_at,
                    and_(Post.created_at == cursor_created_at, Post.id > cursor_id),
                )
            )
    else:
        statement = statement.order_by(col(Post.created_at).desc(), col(Post.id).desc())
        if pagination.cursor is not None:
            cursor_created_at, cursor_id = decode_cursor(pagination.cursor)
            statement = statement.where(
                or_(
                    Post.created_at < cursor_created_at,
                    and_(Post.created_at == cursor_created_at, Post.id < cursor_id),
                )
            )

    return statement


def paginate_posts(
    session: Session,
    base_select: SelectOfScalar[Post],
    filters: PostFilters,
    pagination: PostPagination,
) -> PostPage:
    validated_pagination = validate_pagination(pagination)
    statement, _ = apply_filters_to_select(session, base_select, filters)
    if statement is None:
        return PostPage(posts=[], next_cursor=None, has_more=False)

    statement = apply_sort_and_cursor(statement, validated_pagination)
    statement = statement.limit(validated_pagination.limit + 1)

    rows = list(session.exec(statement).all())
    has_more = len(rows) > validated_pagination.limit
    posts = rows[: validated_pagination.limit]
    next_cursor = encode_cursor(posts[-1]) if has_more and posts else None

    return PostPage(posts=posts, next_cursor=next_cursor, has_more=has_more)
