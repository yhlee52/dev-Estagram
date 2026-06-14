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
    # Asset managed-storage copy (v0.3.3, opt-in). When enabled, importing a
    # package via the CLI / process_incoming copies assets referenced by a
    # *relative local path* (resolved next to the package) into
    # `managed_assets_dir` — a subtree the frontend already serves — and rewrites
    # the stored url to `managed_assets_url_prefix`. Already-served (`/assets/...`)
    # and remote (`http(s)://`) urls are left untouched. Default off keeps
    # behavior byte-for-byte identical to v0.3.2. HTTP import never copies (no
    # package files on disk). The dir and url prefix are the filesystem and
    # browser views of the same location; change them together.
    manage_asset_storage: bool = False
    managed_assets_dir: Path = BACKEND_DIR.parent / "public" / "assets" / "managed"
    managed_assets_url_prefix: str = "/assets/managed"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
