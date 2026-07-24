"""S3 ingestion discovery/validation regression check (v1.2.0).

Exercises the read/verify half of S3 ingestion — `_READY.json` parsing,
`app.services.s3_discovery`, and the object-store key helpers — against an
in-memory fake object store. Runs with **no MinIO, no boto3, and no database**,
so it belongs to the base unit suite (per V1_2_0 scope §검증).

A separate, optional block uses botocore Stubber / boto3 config to confirm
path-style vs. AWS-endpoint client construction when boto3 happens to be
installed; it is skipped cleanly otherwise.

Usage (from feed-prototype/backend):

    python -m scripts.check_s3_ingest
"""

from __future__ import annotations

import hashlib
import json
import sys
from typing import Any, Iterator

from app.schemas.s3_ready import (
    BatchValidationError,
    is_remote_or_absolute,
    is_safe_relative_key,
    parse_ready_marker,
)
from app.services.s3_discovery import (
    discover_ready_batches,
    resolve_asset_object_key,
    validate_batch,
)
from app.services.s3_storage import (
    ObjectNotFound,
    S3IngestConfig,
    S3ObjectInfo,
    S3ObjectStore,
    join_key,
)


# --- fake object store --------------------------------------------------------


class FakeObjectStore:
    """In-memory read-only ObjectStore backed by {key: bytes}."""

    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes) -> None:
        self._objects[key] = data

    def remove(self, key: str) -> None:
        self._objects.pop(key, None)

    def list_objects(self, prefix: str) -> Iterator[S3ObjectInfo]:
        for key in sorted(self._objects):
            if key.startswith(prefix):
                body = self._objects[key]
                yield S3ObjectInfo(
                    key=key,
                    etag=hashlib.md5(body).hexdigest(),  # noqa: S324 - fake etag only
                    size=len(body),
                )

    def get_bytes(self, key: str) -> bytes:
        try:
            return self._objects[key]
        except KeyError as exc:
            raise ObjectNotFound(key) from exc

    def object_exists(self, key: str) -> bool:
        return key in self._objects

    def head_object(self, key: str) -> S3ObjectInfo | None:
        if key not in self._objects:
            return None
        body = self._objects[key]
        return S3ObjectInfo(key=key, etag=hashlib.md5(body).hexdigest(), size=len(body))  # noqa: S324

    def generate_presigned_url(self, key: str, *, expires_in: int = 3600) -> str:
        return f"https://fake.example/{key}?expires={expires_in}"


CONFIG = S3IngestConfig(
    bucket="estagram",
    root_prefix="estagram",
    batches_prefix="batches",
    manifest_filename="feed_posts.json",
    ready_filename="_READY.json",
)


def _manifest(batch_id: str, *, assets: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "batch": {"external_id": batch_id, "source": "check"},
        "accounts": [
            {
                "external_id": f"acct-{batch_id}",
                "handle": f"h_{batch_id}",
                "display_name": "Check Account",
            }
        ],
        "posts": [
            {
                "external_id": f"post-{batch_id}",
                "account_external_id": f"acct-{batch_id}",
                "title": "Check post",
                "text": "body",
                "assets": assets,
            }
        ],
    }


def seed_valid_batch(
    store: FakeObjectStore,
    batch_id: str,
    *,
    assets: list[dict[str, Any]] | None = None,
    asset_object_names: list[str] | None = None,
    include_ready: bool = True,
    ready_overrides: dict[str, Any] | None = None,
    manifest_bytes_override: bytes | None = None,
) -> bytes:
    """Seed a batch (assets + manifest + optional _READY.json). Returns the
    manifest bytes actually stored (for checksum tests)."""
    if assets is None:
        assets = [{"type": "image", "url": "assets/image_001.png", "sort_order": 1}]
    if asset_object_names is None:
        asset_object_names = ["assets/image_001.png"]

    for rel in asset_object_names:
        store.put(CONFIG.key_in_batch(batch_id, rel), b"\x89PNG-fake-bytes")

    manifest_bytes = manifest_bytes_override
    if manifest_bytes is None:
        manifest_bytes = json.dumps(_manifest(batch_id, assets=assets)).encode("utf-8")
    store.put(CONFIG.key_in_batch(batch_id, CONFIG.manifest_filename), manifest_bytes)

    if include_ready:
        marker: dict[str, Any] = {
            "schema_version": "1.0",
            "batch_external_id": batch_id,
            "manifest_key": CONFIG.manifest_filename,
            "ready_at": "2026-01-09T22:30:00+09:00",
        }
        if ready_overrides:
            marker.update(ready_overrides)
        store.put(CONFIG.ready_key(batch_id), json.dumps(marker).encode("utf-8"))

    return manifest_bytes


# --- checks -------------------------------------------------------------------


def expect_validation_error(fn, code: str) -> None:
    try:
        fn()
    except BatchValidationError as exc:
        if exc.code != code:
            raise AssertionError(f"expected code {code!r}, got {exc.code!r}: {exc}") from exc
        return
    raise AssertionError(f"expected BatchValidationError[{code}], but none was raised")


def check_key_helpers() -> None:
    assert join_key("estagram", "batches", "b1") == "estagram/batches/b1"
    assert join_key("estagram/", "/batches/", "b1") == "estagram/batches/b1"
    assert join_key("", "batches", "b1") == "batches/b1"
    assert CONFIG.ready_key("b1") == "estagram/batches/b1/_READY.json"
    assert CONFIG.key_in_batch("b1", "assets/x.png") == "estagram/batches/b1/assets/x.png"


def check_path_safety() -> None:
    assert is_safe_relative_key("assets/img.png")
    assert is_safe_relative_key("./img.png")
    assert not is_safe_relative_key("../img.png")
    assert not is_safe_relative_key("a/../../b")
    assert not is_safe_relative_key("/abs/path")
    assert not is_safe_relative_key("")
    assert is_remote_or_absolute("http://x/y")
    assert is_remote_or_absolute("https://x/y")
    assert is_remote_or_absolute("s3://bucket/key")
    assert is_remote_or_absolute("//host/key")
    assert is_remote_or_absolute("/assets/x.png")
    assert is_remote_or_absolute(r"C:\x\y")
    assert not is_remote_or_absolute("assets/x.png")


def check_asset_key_resolution() -> None:
    assert (
        resolve_asset_object_key(CONFIG, "b1", "assets/image_001.png")
        == "estagram/batches/b1/assets/image_001.png"
    )
    assert resolve_asset_object_key(CONFIG, "b1", "https://x/y.png") is None
    assert resolve_asset_object_key(CONFIG, "b1", "/assets/y.png") is None
    expect_validation_error(
        lambda: resolve_asset_object_key(CONFIG, "b1", "../escape.png"),
        "asset_key_invalid",
    )


def check_valid_batch() -> None:
    store = FakeObjectStore()
    seed_valid_batch(store, "batch_ok")
    discovered = discover_ready_batches(store, CONFIG)
    assert len(discovered) == 1, discovered
    assert discovered[0].batch_external_id == "batch_ok"
    assert discovered[0].ready_key == "estagram/batches/batch_ok/_READY.json"
    assert discovered[0].object_prefix == "estagram/batches/batch_ok"

    validated = validate_batch(store, CONFIG, discovered[0])
    assert validated.payload.batch.external_id == "batch_ok"
    assert validated.manifest_key == "estagram/batches/batch_ok/feed_posts.json"
    assert validated.asset_object_keys == ["estagram/batches/batch_ok/assets/image_001.png"]


def check_discovery_ignores_non_markers() -> None:
    store = FakeObjectStore()
    seed_valid_batch(store, "batch_a")
    seed_valid_batch(store, "batch_b")
    # A nested _READY.json and a stray asset must not be discovered as batches.
    store.put("estagram/batches/batch_a/sub/_READY.json", b"{}")
    store.put("estagram/batches/loose_asset.png", b"x")
    # A batch with no _READY.json is not discovered.
    seed_valid_batch(store, "batch_no_ready", include_ready=False)

    discovered = discover_ready_batches(store, CONFIG)
    ids = [b.batch_external_id for b in discovered]
    assert ids == ["batch_a", "batch_b"], ids  # sorted, top-level only


def check_pagination_many_batches() -> None:
    store = FakeObjectStore()
    for i in range(25):
        seed_valid_batch(store, f"batch_{i:03d}")
    discovered = discover_ready_batches(store, CONFIG)
    assert len(discovered) == 25
    # every one validates
    for batch in discovered:
        validate_batch(store, CONFIG, batch)


def check_missing_required_field() -> None:
    raw = {"schema_version": "1.0", "batch_external_id": "b1"}  # no manifest_key
    expect_validation_error(
        lambda: parse_ready_marker(raw, expected_batch_external_id="b1"),
        "invalid_ready_marker",
    )


def check_bad_schema_version() -> None:
    raw = {
        "schema_version": "9.9",
        "batch_external_id": "b1",
        "manifest_key": "feed_posts.json",
    }
    expect_validation_error(
        lambda: parse_ready_marker(raw, expected_batch_external_id="b1"),
        "unsupported_schema_version",
    )


def check_batch_id_mismatch() -> None:
    raw = {
        "schema_version": "1.0",
        "batch_external_id": "claims_other",
        "manifest_key": "feed_posts.json",
    }
    expect_validation_error(
        lambda: parse_ready_marker(raw, expected_batch_external_id="b1"),
        "batch_id_mismatch",
    )


def check_manifest_key_traversal() -> None:
    for bad in ["../feed_posts.json", "/etc/passwd", "a/../../b.json"]:
        raw = {
            "schema_version": "1.0",
            "batch_external_id": "b1",
            "manifest_key": bad,
        }
        expect_validation_error(
            lambda raw=raw: parse_ready_marker(raw, expected_batch_external_id="b1"),
            "manifest_key_invalid",
        )


def check_invalid_ready_json() -> None:
    store = FakeObjectStore()
    seed_valid_batch(store, "batch_badready")
    store.put(CONFIG.ready_key("batch_badready"), b"{not json")
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "invalid_ready_json"
    )


def check_manifest_missing() -> None:
    store = FakeObjectStore()
    seed_valid_batch(store, "batch_nomani")
    store.remove(CONFIG.key_in_batch("batch_nomani", CONFIG.manifest_filename))
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "manifest_missing"
    )


def check_malformed_manifest() -> None:
    store = FakeObjectStore()
    seed_valid_batch(store, "batch_malmani", manifest_bytes_override=b"{oops")
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "invalid_manifest_json"
    )


def check_manifest_schema_invalid() -> None:
    store = FakeObjectStore()
    # Post missing required account_external_id.
    bad = {
        "batch": {"external_id": "batch_schema"},
        "posts": [{"external_id": "p1", "title": "t"}],
    }
    seed_valid_batch(
        store, "batch_schema", manifest_bytes_override=json.dumps(bad).encode("utf-8")
    )
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "manifest_schema_invalid"
    )


def check_asset_missing() -> None:
    store = FakeObjectStore()
    # Declare two assets but only upload one object.
    seed_valid_batch(
        store,
        "batch_noasset",
        assets=[
            {"type": "image", "url": "assets/image_001.png", "sort_order": 1},
            {"type": "image", "url": "assets/image_002.png", "sort_order": 2},
        ],
        asset_object_names=["assets/image_001.png"],
    )
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "asset_missing"
    )


def check_checksum() -> None:
    store = FakeObjectStore()
    manifest_bytes = seed_valid_batch(store, "batch_sum_ok")
    good = hashlib.sha256(manifest_bytes).hexdigest()
    store.put(
        CONFIG.ready_key("batch_sum_ok"),
        json.dumps(
            {
                "schema_version": "1.0",
                "batch_external_id": "batch_sum_ok",
                "manifest_key": "feed_posts.json",
                "manifest_sha256": good,
            }
        ).encode("utf-8"),
    )
    discovered = discover_ready_batches(store, CONFIG)
    validate_batch(store, CONFIG, discovered[0])  # matches → ok

    store.put(
        CONFIG.ready_key("batch_sum_ok"),
        json.dumps(
            {
                "schema_version": "1.0",
                "batch_external_id": "batch_sum_ok",
                "manifest_key": "feed_posts.json",
                "manifest_sha256": "deadbeef",
            }
        ).encode("utf-8"),
    )
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "checksum_mismatch"
    )


def check_asset_count() -> None:
    store = FakeObjectStore()
    # One relative image (an object) + one remote link (not an object) => count 1.
    seed_valid_batch(
        store,
        "batch_count",
        assets=[
            {"type": "image", "url": "assets/image_001.png", "sort_order": 1},
            {"type": "link", "url": "https://example.com/ref", "sort_order": 2},
        ],
        asset_object_names=["assets/image_001.png"],
        ready_overrides={"asset_count": 1},
    )
    discovered = discover_ready_batches(store, CONFIG)
    validated = validate_batch(store, CONFIG, discovered[0])
    assert validated.asset_object_keys == ["estagram/batches/batch_count/assets/image_001.png"]

    store.put(
        CONFIG.ready_key("batch_count"),
        json.dumps(
            {
                "schema_version": "1.0",
                "batch_external_id": "batch_count",
                "manifest_key": "feed_posts.json",
                "asset_count": 5,
            }
        ).encode("utf-8"),
    )
    discovered = discover_ready_batches(store, CONFIG)
    expect_validation_error(
        lambda: validate_batch(store, CONFIG, discovered[0]), "asset_count_mismatch"
    )


def check_secret_not_leaked() -> None:
    from pydantic import SecretStr

    assert "supersecret" not in repr(SecretStr("supersecret"))
    # The store repr must not expose the underlying client (which holds creds).
    store = S3ObjectStore(bucket="b", client={"aws_secret_access_key": "supersecret"})
    assert "supersecret" not in repr(store)
    assert repr(store) == "S3ObjectStore(bucket='b')"


def check_boto3_client_config_optional() -> None:
    """If boto3 is installed, confirm path-style vs AWS-endpoint construction.
    Skipped cleanly when boto3 is absent (fake-store tests already cover logic)."""
    try:
        import boto3  # noqa: F401
    except ModuleNotFoundError:
        print("  [skip] boto3 not installed; client-config check skipped")
        return

    from app.services.s3_storage import build_s3_client

    minio = build_s3_client(
        S3IngestConfig(
            bucket="estagram",
            endpoint_url="http://localhost:9000",
            access_key_id="k",
            secret_access_key="s",
            region="us-east-1",
            force_path_style=True,
        )
    )
    assert minio.meta.config.s3["addressing_style"] == "path"
    assert minio.meta.endpoint_url == "http://localhost:9000"

    aws = build_s3_client(
        S3IngestConfig(bucket="estagram", region="ap-northeast-2", force_path_style=False)
    )
    assert aws.meta.config.s3["addressing_style"] == "auto"
    assert "amazonaws.com" in aws.meta.endpoint_url


CHECKS = [
    ("key helpers", check_key_helpers),
    ("path safety", check_path_safety),
    ("asset key resolution", check_asset_key_resolution),
    ("valid batch discover+validate", check_valid_batch),
    ("discovery ignores non-markers / no-ready", check_discovery_ignores_non_markers),
    ("pagination over many batches", check_pagination_many_batches),
    ("_READY missing required field", check_missing_required_field),
    ("_READY bad schema version", check_bad_schema_version),
    ("_READY batch id mismatch", check_batch_id_mismatch),
    ("manifest_key traversal/absolute", check_manifest_key_traversal),
    ("invalid _READY json", check_invalid_ready_json),
    ("manifest missing", check_manifest_missing),
    ("malformed manifest json", check_malformed_manifest),
    ("manifest schema invalid", check_manifest_schema_invalid),
    ("asset missing", check_asset_missing),
    ("manifest checksum match/mismatch", check_checksum),
    ("asset_count match/mismatch", check_asset_count),
    ("secret not leaked in repr", check_secret_not_leaked),
    ("boto3 client config (optional)", check_boto3_client_config_optional),
]


def main() -> int:
    passed = 0
    failed = 0
    for name, fn in CHECKS:
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 - report and continue
            failed += 1
            print(f"[FAIL] {name}: {type(exc).__name__}: {exc}")
        else:
            passed += 1
            print(f"[ok]   {name}")

    print(f"\ncheck_s3_ingest: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
