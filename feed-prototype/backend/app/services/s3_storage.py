"""Read-only S3-compatible object store abstraction (v1.2.0).

Wraps the *read* surface the ingestion pipeline needs — list, get, head, exists,
presign — behind an `ObjectStore` Protocol. The concrete `S3ObjectStore` uses
boto3 and works against both local MinIO and a company S3 endpoint; only the
config differs (endpoint, path-style, credentials).

Immutable-source contract (v1.2.x theme): this layer has NO rename, move, copy,
or delete. Objects uploaded to S3/MinIO are kept exactly as-is; batch processing
state lives in PostgreSQL, never in object names or locations.

boto3 is imported lazily inside `build_s3_client`, so importing this module (and
running the fake-store unit tests) needs neither boto3 nor a live endpoint.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterator, Protocol, runtime_checkable

from app.core.config import Settings


def join_key(*parts: str) -> str:
    """Join object-key parts with single '/'s, dropping empty parts.

    Normalizes leading/trailing slashes so an empty root prefix (`""`) or a
    prefix given as `estagram/` both produce clean keys.
    """
    cleaned: list[str] = []
    for part in parts:
        trimmed = part.strip().strip("/")
        if trimmed:
            cleaned.append(trimmed)
    return "/".join(cleaned)


@dataclass(frozen=True)
class S3ObjectInfo:
    """Minimal object metadata returned by list/head."""

    key: str
    etag: str | None = None
    size: int | None = None
    last_modified: datetime | None = None


class ObjectNotFound(Exception):
    """Raised by `get_bytes` when the key does not exist."""

    def __init__(self, key: str) -> None:
        self.key = key
        super().__init__(f"Object not found: {key}")


@runtime_checkable
class ObjectStore(Protocol):
    """Read-only object-store surface. Implemented by `S3ObjectStore` and by the
    fake store used in tests. Deliberately has no write/rename/move/delete."""

    def list_objects(self, prefix: str) -> Iterator[S3ObjectInfo]: ...

    def get_bytes(self, key: str) -> bytes: ...

    def object_exists(self, key: str) -> bool: ...

    def head_object(self, key: str) -> S3ObjectInfo | None: ...

    def generate_presigned_url(self, key: str, *, expires_in: int = 3600) -> str: ...


def read_json(store: ObjectStore, key: str) -> Any:
    """Fetch and JSON-decode an object. Raises `ObjectNotFound` if missing and
    `json.JSONDecodeError` on malformed content (callers map these to codes)."""
    return json.loads(store.get_bytes(key).decode("utf-8"))


@dataclass(frozen=True)
class S3IngestConfig:
    """Resolved S3 ingestion settings + object-layout key helpers.

    Kept separate from `Settings` (a plain frozen dataclass) so discovery and the
    object store are testable without constructing pydantic Settings or touching
    env/DB. `from_settings` bridges the two.
    """

    bucket: str
    root_prefix: str = "estagram"
    batches_prefix: str = "batches"
    manifest_filename: str = "feed_posts.json"
    ready_filename: str = "_READY.json"
    endpoint_url: str | None = None
    access_key_id: str | None = None
    secret_access_key: str | None = None
    region: str = "ap-northeast-2"
    force_path_style: bool = False
    presign_expires_seconds: int = 3600

    @classmethod
    def from_settings(cls, settings: Settings) -> "S3IngestConfig":
        if not settings.s3_bucket:
            raise ValueError(
                "S3_BUCKET is required when INGEST_STORAGE_BACKEND=s3 (set it in .env)."
            )
        secret = settings.s3_secret_access_key
        return cls(
            bucket=settings.s3_bucket,
            root_prefix=settings.s3_root_prefix,
            batches_prefix=settings.s3_batches_prefix,
            manifest_filename=settings.s3_manifest_filename,
            ready_filename=settings.s3_ready_filename,
            endpoint_url=settings.s3_endpoint_url or None,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=secret.get_secret_value() if secret is not None else None,
            region=settings.s3_region,
            force_path_style=settings.s3_force_path_style,
        )

    # --- object-layout key helpers -------------------------------------------
    def batches_root(self) -> str:
        return join_key(self.root_prefix, self.batches_prefix)

    def batch_prefix(self, batch_external_id: str) -> str:
        return join_key(self.batches_root(), batch_external_id)

    def ready_key(self, batch_external_id: str) -> str:
        return join_key(self.batch_prefix(batch_external_id), self.ready_filename)

    def key_in_batch(self, batch_external_id: str, relative_key: str) -> str:
        return join_key(self.batch_prefix(batch_external_id), relative_key)


def build_s3_client(config: S3IngestConfig) -> Any:
    """Create a boto3 S3 client from `config` (lazy boto3 import).

    `endpoint_url=None` lets the SDK resolve the real AWS S3 endpoint from the
    region; MinIO/company endpoints set it explicitly. Path-style addressing is
    required by MinIO and many S3-compatible stores.
    """
    import boto3  # lazy: only needed for a real endpoint, not for tests
    from botocore.config import Config as BotoConfig

    boto_config = BotoConfig(
        signature_version="s3v4",
        s3={"addressing_style": "path" if config.force_path_style else "auto"},
    )
    return boto3.client(
        "s3",
        endpoint_url=config.endpoint_url,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        region_name=config.region,
        config=boto_config,
    )


class S3ObjectStore:
    """boto3-backed read-only `ObjectStore`."""

    def __init__(self, *, bucket: str, client: Any) -> None:
        self._bucket = bucket
        self._client = client

    @classmethod
    def from_config(cls, config: S3IngestConfig) -> "S3ObjectStore":
        return cls(bucket=config.bucket, client=build_s3_client(config))

    def __repr__(self) -> str:  # never leak the client (which holds credentials)
        return f"S3ObjectStore(bucket={self._bucket!r})"

    def list_objects(self, prefix: str) -> Iterator[S3ObjectInfo]:
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                yield S3ObjectInfo(
                    key=obj["Key"],
                    etag=(obj.get("ETag") or "").strip('"') or None,
                    size=obj.get("Size"),
                    last_modified=obj.get("LastModified"),
                )

    def get_bytes(self, key: str) -> bytes:
        from botocore.exceptions import ClientError

        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
        except ClientError as exc:
            if _is_not_found(exc):
                raise ObjectNotFound(key) from exc
            raise
        return response["Body"].read()

    def object_exists(self, key: str) -> bool:
        return self.head_object(key) is not None

    def head_object(self, key: str) -> S3ObjectInfo | None:
        from botocore.exceptions import ClientError

        try:
            response = self._client.head_object(Bucket=self._bucket, Key=key)
        except ClientError as exc:
            if _is_not_found(exc):
                return None
            raise
        return S3ObjectInfo(
            key=key,
            etag=(response.get("ETag") or "").strip('"') or None,
            size=response.get("ContentLength"),
            last_modified=response.get("LastModified"),
        )

    def generate_presigned_url(self, key: str, *, expires_in: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )


def _is_not_found(exc: Any) -> bool:
    error = getattr(exc, "response", {}).get("Error", {})
    code = str(error.get("Code", ""))
    return code in {"404", "NoSuchKey", "NotFound"}
