from datetime import datetime
import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.feed import ASSET_TYPES, normalize_optional_text


def normalize_required_text(value: str, field_name: str) -> str:
    normalized_value = value.strip()
    if not normalized_value:
        raise ValueError(f"{field_name} is required.")

    return normalized_value


class ExternalImportBatch(BaseModel):
    external_id: str
    source: str | None = None
    created_at: datetime | None = None

    @field_validator("external_id")
    @classmethod
    def validate_external_id(cls, value: str) -> str:
        return normalize_required_text(value, "batch.external_id")

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class ExternalImportAccount(BaseModel):
    external_id: str
    handle: str
    display_name: str
    bio: str | None = None
    avatar_url: str | None = None

    @field_validator("external_id")
    @classmethod
    def validate_external_id(cls, value: str) -> str:
        return normalize_required_text(value, "account.external_id")

    @field_validator("handle")
    @classmethod
    def validate_handle(cls, value: str) -> str:
        return normalize_required_text(value, "account.handle")

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        return normalize_required_text(value, "account.display_name")

    @field_validator("bio", "avatar_url")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class ExternalImportAsset(BaseModel):
    external_id: str | None = None
    type: str
    url: str
    title: str | None = None
    description: str | None = None

    @field_validator("external_id", "title", "description")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

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
        normalized_value = normalize_required_text(value, "asset.url")
        if re.match(r"^[a-zA-Z]:[\\/]", normalized_value):
            raise ValueError(
                "asset.url must be browser-accessible; do not use a Windows absolute path."
            )

        return normalized_value


class ExternalImportPost(BaseModel):
    external_id: str
    account_external_id: str
    title: str = Field(max_length=200)
    text: str = Field(default="", max_length=5000)
    created_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)
    metadata_json: dict[str, Any] | None = None
    assets: list[ExternalImportAsset] = Field(default_factory=list)

    @field_validator("external_id")
    @classmethod
    def validate_external_id(cls, value: str) -> str:
        return normalize_required_text(value, "post.external_id")

    @field_validator("account_external_id")
    @classmethod
    def validate_account_external_id(cls, value: str) -> str:
        return normalize_required_text(value, "post.account_external_id")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return normalize_required_text(value, "post.title")

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        return [tag.strip() for tag in value if tag.strip()]


class ExternalImportPayload(BaseModel):
    batch: ExternalImportBatch
    accounts: list[ExternalImportAccount] = Field(default_factory=list)
    posts: list[ExternalImportPost] = Field(default_factory=list)
