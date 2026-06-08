from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_user_handle(handle: str) -> str:
    return handle.strip().lower()


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized_value = value.strip()
    return normalized_value or None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    handle: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    handle: str
    display_name: str | None = None
    bio: str | None = None

    @field_validator("handle")
    @classmethod
    def validate_handle(cls, value: str) -> str:
        return normalize_user_handle(value)

    @field_validator("display_name", "bio")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    handle: str
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None
    kind: str
    created_at: datetime
    updated_at: datetime


class UserRegistrationResponse(BaseModel):
    user: UserRead
    account: AccountRead


class PostAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    post_id: str
    type: str
    title: str | None = None
    description: str | None = None
    src: str
    mime_type: str | None = None
    sort_order: int
    metadata_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class PostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    title: str
    text: str
    metadata_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class PostWithAssets(PostRead):
    assets: list[PostAssetRead] = Field(default_factory=list)


class FollowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    follower_user_id: str
    following_account_id: str
    created_at: datetime


class FollowWithAccount(BaseModel):
    follow: FollowRead
    account: AccountRead


class UserFollowsResponse(BaseModel):
    user_id: str
    following_account_ids: list[str]
    follows: list[FollowWithAccount]


class FeedItem(BaseModel):
    post: PostRead
    account: AccountRead
    assets: list[PostAssetRead]


class FeedResponse(BaseModel):
    user: UserRead
    items: list[FeedItem]
