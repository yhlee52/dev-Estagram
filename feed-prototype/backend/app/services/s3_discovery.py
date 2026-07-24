"""S3 batch discovery + validation (v1.2.0).

Finds batches by listing `_READY.json` markers under `{root}/{batches}/*/`, then
validates each batch end-to-end *without touching the DB*: parse the marker,
confirm the manifest exists and parses as the frozen `feed_posts.json` format,
resolve every batch-relative asset to an object key and confirm it exists, and
check the optional checksum / asset_count.

This is the read/verify half of ingestion. Creating the PostgreSQL tracking
record and calling `import_payload` is v1.2.1; this module intentionally stops at
"here is a validated batch ready to import". A batch that has no `_READY.json` is
simply never discovered (the producer has not finished uploading it).

Immutable-source contract: nothing here writes, renames, moves, or deletes an
object. The same marker reappearing every poll is expected.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime

from pydantic import ValidationError

from app.schemas.external_import import ExternalImportPayload
from app.schemas.s3_ready import (
    BatchValidationError,
    ReadyMarker,
    ensure_safe_relative_key,
    is_remote_or_absolute,
    parse_ready_marker,
)
from app.services.s3_storage import (
    ObjectNotFound,
    ObjectStore,
    S3IngestConfig,
    read_json,
)


@dataclass(frozen=True)
class DiscoveredBatch:
    """A `_READY.json` marker found in the object store (pre-validation)."""

    batch_external_id: str
    ready_key: str
    object_prefix: str
    ready_etag: str | None = None
    ready_last_modified: datetime | None = None


@dataclass(frozen=True)
class ValidatedBatch:
    """A fully validated batch ready to be imported (v1.2.1 consumes this)."""

    discovered: DiscoveredBatch
    marker: ReadyMarker
    manifest_key: str
    manifest_etag: str | None
    payload: ExternalImportPayload
    asset_object_keys: list[str] = field(default_factory=list)


def discover_ready_batches(
    store: ObjectStore, config: S3IngestConfig
) -> list[DiscoveredBatch]:
    """List batches that have a top-level `_READY.json` marker.

    Only markers exactly one level under the batches root count
    (`{batches_root}/{batch_id}/_READY.json`); a `_READY.json` nested deeper is
    ignored. Pagination is handled by `store.list_objects`. Ordered by batch id
    for deterministic processing.
    """
    batches_root = config.batches_root()
    prefix = batches_root + "/" if batches_root else ""
    ready_suffix = "/" + config.ready_filename
    root_len = len(prefix)

    discovered: list[DiscoveredBatch] = []
    for obj in store.list_objects(prefix):
        if not obj.key.endswith(ready_suffix):
            continue
        # Strip the batches-root prefix and the trailing "/_READY.json"; what
        # remains must be a single path segment = the batch id.
        middle = obj.key[root_len : -len(ready_suffix)]
        if not middle or "/" in middle:
            continue
        discovered.append(
            DiscoveredBatch(
                batch_external_id=middle,
                ready_key=obj.key,
                object_prefix=config.batch_prefix(middle),
                ready_etag=obj.etag,
                ready_last_modified=obj.last_modified,
            )
        )

    discovered.sort(key=lambda batch: batch.batch_external_id)
    return discovered


def resolve_asset_object_key(
    config: S3IngestConfig, batch_external_id: str, url: str
) -> str | None:
    """Resolve a manifest asset `url` to a batch object key, or None if it is not
    a batch object.

    Batch-relative references (`assets/img.png`) resolve to
    `{root}/batches/{batch}/assets/img.png`. Remote/absolute references
    (`http(s)://`, `//host`, `/assets/...`, `s3://`, `C:\\...`) return None — they
    are not objects in this batch and are left untouched (e.g. link assets). An
    unsafe relative reference (`../`) raises `BatchValidationError`.
    """
    if is_remote_or_absolute(url):
        return None
    safe = ensure_safe_relative_key(url, field="asset.url", code="asset_key_invalid")
    return config.key_in_batch(batch_external_id, safe)


def validate_batch(
    store: ObjectStore, config: S3IngestConfig, discovered: DiscoveredBatch
) -> ValidatedBatch:
    """Validate a discovered batch end-to-end. Raises `BatchValidationError`
    (with a stable `code`) on the first failure; returns a `ValidatedBatch` on
    success. Performs no DB writes and no object mutations."""
    # 1. Read + parse the _READY.json marker.
    try:
        raw_marker = read_json(store, discovered.ready_key)
    except ObjectNotFound as exc:
        raise BatchValidationError(
            "ready_missing", f"_READY.json disappeared: {discovered.ready_key}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise BatchValidationError(
            "invalid_ready_json", f"_READY.json is not valid JSON: {exc.msg}"
        ) from exc

    marker = parse_ready_marker(
        raw_marker, expected_batch_external_id=discovered.batch_external_id
    )

    # 2. Resolve + confirm the manifest object.
    manifest_key = config.key_in_batch(discovered.batch_external_id, marker.manifest_key)
    manifest_info = store.head_object(manifest_key)
    if manifest_info is None:
        raise BatchValidationError(
            "manifest_missing", f"manifest object does not exist: {manifest_key}"
        )

    # 3. Read the manifest, verify optional checksum, parse against the frozen
    #    external package schema.
    manifest_bytes = store.get_bytes(manifest_key)
    if marker.manifest_sha256:
        actual = hashlib.sha256(manifest_bytes).hexdigest()
        if actual.lower() != marker.manifest_sha256.strip().lower():
            raise BatchValidationError(
                "checksum_mismatch",
                "manifest sha256 does not match _READY.json manifest_sha256",
            )

    try:
        raw_manifest = json.loads(manifest_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise BatchValidationError(
            "invalid_manifest_json", f"manifest is not valid JSON: {exc.msg}"
        ) from exc

    try:
        payload = ExternalImportPayload.model_validate(raw_manifest)
    except ValidationError as exc:
        raise BatchValidationError(
            "manifest_schema_invalid",
            f"manifest failed schema validation: {exc.error_count()} error(s)",
        ) from exc

    # 4. Resolve every batch-relative asset to an object key and confirm it
    #    exists. Remote/absolute asset refs (e.g. link assets) are skipped.
    asset_object_keys: list[str] = []
    for post in payload.posts:
        for asset in post.assets:
            key = resolve_asset_object_key(
                config, discovered.batch_external_id, asset.url
            )
            if key is None:
                continue
            if not store.object_exists(key):
                raise BatchValidationError(
                    "asset_missing", f"declared asset object does not exist: {key}"
                )
            asset_object_keys.append(key)

    # 5. Optional asset_count must match the number of declared batch objects.
    if marker.asset_count is not None and marker.asset_count != len(asset_object_keys):
        raise BatchValidationError(
            "asset_count_mismatch",
            f"_READY.json asset_count={marker.asset_count} but "
            f"{len(asset_object_keys)} batch asset object(s) were declared",
        )

    return ValidatedBatch(
        discovered=discovered,
        marker=marker,
        manifest_key=manifest_key,
        manifest_etag=manifest_info.etag,
        payload=payload,
        asset_object_keys=asset_object_keys,
    )
