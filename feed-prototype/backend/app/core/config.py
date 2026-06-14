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

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
