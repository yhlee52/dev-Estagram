from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


ASSET_TYPES = {"image", "plot", "table", "file", "link"}


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
    url: str | None = None
    src: str
    mime_type: str | None = None
    sort_order: int | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class PostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    title: str
    text: str
    tags: list[str] = Field(default_factory=list)
    metadata_json: dict[str, Any] | None = None
    imported_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PostAssetCreate(BaseModel):
    type: str
    url: str
    title: str | None = None
    description: str | None = None
    sort_order: int | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized_value = value.strip().lower()
        if normalized_value not in ASSET_TYPES:
            allowed_types = ", ".join(sorted(ASSET_TYPES))
            raise ValueError(f"Asset type must be one of: {allowed_types}.")

        return normalized_value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        normalized_value = value.strip()
        if not normalized_value:
            raise ValueError("Asset url is required.")

        return normalized_value

    @field_validator("title", "description")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class PostCreate(BaseModel):
    user_id: str | int
    title: str = Field(max_length=200)
    text: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list)
    metadata_json: dict[str, Any] | None = None
    assets: list[PostAssetCreate] = Field(default_factory=list)

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, value: str | int) -> str:
        normalized_value = str(value).strip()
        if not normalized_value:
            raise ValueError("User id is required.")

        return normalized_value

    @field_validator("title", "text")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        return [tag.strip() for tag in value if tag.strip()]

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value:
            raise ValueError("Title is required.")

        return value


class PostUpdate(BaseModel):
    user_id: str | int
    title: str | None = Field(default=None, max_length=200)
    text: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = None
    metadata_json: dict[str, Any] | None = None
    assets: list[PostAssetCreate] | None = None

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, value: str | int) -> str:
        normalized_value = str(value).strip()
        if not normalized_value:
            raise ValueError("User id is required.")

        return normalized_value

    @field_validator("title", "text")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip()

    @field_validator("title")
    @classmethod
    def validate_optional_title(cls, value: str | None) -> str | None:
        if value is not None and not value:
            raise ValueError("Title cannot be empty.")

        return value

    @field_validator("tags")
    @classmethod
    def validate_optional_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None

        return [tag.strip() for tag in value if tag.strip()]


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
