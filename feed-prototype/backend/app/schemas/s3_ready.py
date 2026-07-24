"""`_READY.json` marker schema, validation, and path-safety helpers (v1.2.0).

`_READY.json` is the *completion signal* a producer uploads last, after all
assets and the manifest. It is NOT a status store: the worker never mutates or
moves it, and the same marker being seen on every poll is normal — processing
state lives in PostgreSQL (v1.2.1+), not in this file.

This module is dependency-free (pydantic + stdlib only): it never imports the
storage or discovery layers, so `app.services.*` can import from here without a
cycle, and the validators run in unit tests without boto3, MinIO, or a DB.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ValidationError, field_validator


# Supported `_READY.json` schema versions. Bump when the marker format changes;
# an unknown version is rejected rather than guessed.
SUPPORTED_READY_SCHEMA_VERSIONS: frozenset[str] = frozenset({"1.0"})

_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")
_WINDOWS_ABS_RE = re.compile(r"^[a-zA-Z]:[\\/]")


class BatchValidationError(Exception):
    """A batch failed validation. Carries a stable `code` for tracking/logging.

    Defined here (not in a service module) so both `parse_ready_marker` and the
    discovery layer can raise the same typed error without an import cycle. The
    `code` is intended to land in the ingestion tracking record's `error_code`
    column (v1.2.1); the message is human-facing and must not contain secrets.
    """

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")


def is_remote_or_absolute(reference: str) -> bool:
    """True if a manifest/asset reference points outside the batch prefix.

    Blocks anything that must not be resolved as a batch-relative object key:
    absolute browser paths (`/x`), protocol-relative (`//host/x`), any scheme
    (`http://`, `s3://`, ...), and Windows absolute paths (`C:\\x`). Batch-relative
    references (`assets/img.png`, `./img.png`) return False.
    """
    value = reference.strip()
    if not value:
        return False
    if value.startswith("/"):
        return True
    if value.startswith("\\"):
        return True
    if _SCHEME_RE.match(value):
        return True
    if _WINDOWS_ABS_RE.match(value):
        return True
    return False


def is_safe_relative_key(reference: str) -> bool:
    """True if `reference` is a safe batch-relative path (no traversal/absolute).

    Rejects empty strings, absolute/remote references, backslashes, and any `..`
    segment. A lone `.` segment is allowed (harmless). Callers resolve the return
    against the batch prefix to build the object key.
    """
    value = reference.strip()
    if not value:
        return False
    if is_remote_or_absolute(value):
        return False
    if "\\" in value:
        return False
    segments = value.split("/")
    for segment in segments:
        if segment == "..":
            return False
    return True


def ensure_safe_relative_key(reference: str, *, field: str, code: str) -> str:
    """Return the trimmed reference if safe-relative, else raise BatchValidationError."""
    value = reference.strip()
    if not is_safe_relative_key(value):
        raise BatchValidationError(
            code,
            f"{field} must be a batch-relative path without '..' or an absolute/remote "
            f"reference: {reference!r}",
        )
    return value


class ReadyMarkerProducer(BaseModel):
    name: str | None = None
    version: str | None = None


class ReadyMarker(BaseModel):
    """Parsed `_READY.json`. Required: schema_version, batch_external_id,
    manifest_key. Optional: ready_at, producer, manifest_sha256, asset_count."""

    schema_version: str
    batch_external_id: str
    manifest_key: str
    ready_at: datetime | None = None
    producer: ReadyMarkerProducer | None = None
    manifest_sha256: str | None = None
    asset_count: int | None = None

    @field_validator("schema_version", "batch_external_id", "manifest_key")
    @classmethod
    def _require_non_empty(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value is required")
        return normalized


def parse_ready_marker(raw: Any, *, expected_batch_external_id: str) -> ReadyMarker:
    """Validate a decoded `_READY.json` object into a `ReadyMarker`.

    `expected_batch_external_id` is the batch prefix folder name; the marker's
    `batch_external_id` must match it (the object layout is authoritative, the
    marker cannot claim to be a different batch). Raises `BatchValidationError`
    with a stable code on any failure. JSON decoding is the caller's job.
    """
    try:
        marker = ReadyMarker.model_validate(raw)
    except ValidationError as exc:
        raise BatchValidationError(
            "invalid_ready_marker",
            f"_READY.json failed schema validation: {exc.error_count()} error(s)",
        ) from exc

    if marker.schema_version not in SUPPORTED_READY_SCHEMA_VERSIONS:
        supported = ", ".join(sorted(SUPPORTED_READY_SCHEMA_VERSIONS))
        raise BatchValidationError(
            "unsupported_schema_version",
            f"_READY.json schema_version {marker.schema_version!r} is not supported "
            f"(supported: {supported})",
        )

    if marker.batch_external_id != expected_batch_external_id:
        raise BatchValidationError(
            "batch_id_mismatch",
            f"_READY.json batch_external_id {marker.batch_external_id!r} does not match "
            f"the batch prefix {expected_batch_external_id!r}",
        )

    # manifest_key must resolve inside the batch prefix (no absolute/traversal).
    ensure_safe_relative_key(marker.manifest_key, field="manifest_key", code="manifest_key_invalid")

    if marker.asset_count is not None and marker.asset_count < 0:
        raise BatchValidationError(
            "invalid_asset_count",
            f"_READY.json asset_count must be non-negative: {marker.asset_count}",
        )

    return marker
