from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "feed-prototype-backend"
    app_env: str = "local"
    database_url: str
    # Optional shared-token protection for the HTTP import endpoint (v0.3.0).
    # When unset, the endpoint follows the local CLI trust model (no check).
    # This is not real auth; the backend is assumed to bind to localhost.
    import_api_token: str | None = None
    # Root of the external_posts working tree (v0.3.2). The directory-batch
    # processor derives incoming/archive/failed from this. Defaults to the repo's
    # feed-prototype/data/external_posts.
    external_posts_dir: Path = BACKEND_DIR.parent / "data" / "external_posts"
    # Disk package assets are copied under the same local data root and served
    # by FastAPI. HTTP imports have no source files and cannot copy assets.
    manage_asset_storage: bool = True
    managed_assets_dir: Path | None = None
    managed_assets_url_prefix: str = "/assets/managed"
    local_asset_base_url: str = "http://127.0.0.1:8000"

    # Session cookie / CORS hardening (v1.0.0). Both default to the localhost
    # dev posture (cookie not secure, frontend dev server origins allowed) and
    # must be set explicitly for any non-localhost deployment: secure=True
    # requires the backend to be served over HTTPS, and allow_origins must list
    # the deployed frontend's exact scheme+host+port.
    session_cookie_secure: bool = False
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_allow_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def resolved_managed_assets_dir(self) -> Path:
        return self.managed_assets_dir or self.external_posts_dir / "assets"


@lru_cache
def get_settings() -> Settings:
    return Settings()
