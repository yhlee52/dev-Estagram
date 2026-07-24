from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
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

    # Session cookie / CORS hardening (v1.0.0). Both default to the localhost
    # dev posture (cookie not secure, frontend dev server origins allowed) and
    # must be set explicitly for any non-localhost deployment: secure=True
    # requires the backend to be served over HTTPS, and allow_origins must list
    # the deployed frontend's exact scheme+host+port.
    session_cookie_secure: bool = False
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # External post ingestion backend selector (v1.2.0). "filesystem" keeps the
    # existing incoming/ directory watch (v0.3.x) as the only ingestion path;
    # "s3" enables the S3-compatible object-storage discovery added in v1.2.x.
    # The two backends share the same domain importer; only discovery and asset
    # access differ.
    ingest_storage_backend: str = "filesystem"

    # S3-compatible object storage (v1.2.0). Same boto3 code targets local MinIO
    # (home dev) and a company S3 endpoint; only these env values differ. Leave
    # `s3_endpoint_url` unset for real AWS S3 (SDK resolves the endpoint from the
    # region); set it to the MinIO/company URL otherwise. Secrets live only in
    # `.env` (see .env.example placeholders), never committed. `s3_secret_access_key`
    # is a SecretStr so it is masked in logs/repr.
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: SecretStr | None = None
    s3_region: str = "ap-northeast-2"
    s3_bucket: str | None = None
    s3_root_prefix: str = "estagram"
    # MinIO and many S3-compatible stores need path-style addressing
    # (http://host/bucket/key) instead of virtual-hosted-style. AWS S3 uses False.
    s3_force_path_style: bool = False

    # Object layout knobs (v1.2.0). Reasonable defaults, overridable per env.
    s3_batches_prefix: str = "batches"
    s3_manifest_filename: str = "feed_posts.json"
    s3_ready_filename: str = "_READY.json"

    # Absolute base URL the API prepends when emitting the asset proxy URL for
    # S3-backed assets (v1.2.4). The frontend uses the stored asset url directly
    # as an <img src>/link without prepending its API base, so this must be the
    # backend's own externally reachable origin. Defaults to the local dev
    # backend; set it for any non-localhost deployment.
    asset_proxy_base_url: str = "http://127.0.0.1:8000"

    # Watch worker knobs (declared here in v1.2.0; consumed by the worker in
    # v1.2.2). Kept as config-only now to avoid a later config-only migration.
    s3_watch_enabled: bool = False
    s3_watch_interval_seconds: int = 10
    s3_watch_batch_limit: int = 20
    s3_processing_timeout_seconds: int = 1800
    s3_failed_retry_enabled: bool = False
    s3_failed_max_attempts: int = 3

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_allow_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
