"""Producer upload CLI: push a batch directory to S3/MinIO (v1.2.3).

Uploads a local batch directory to object storage in the exact order the worker
requires — every asset first, then the manifest, then `_READY.json` LAST — so a
half-uploaded batch is never discoverable. The batch prefix, manifest name, and
ready marker match what `s3_discovery`/`s3_ingest` expect.

The uploaded objects are the immutable source of truth for their binaries; the
backend never mutates them. Re-uploading an existing batch id is refused unless
`--overwrite` is given (and even then the backend does not auto-reprocess a
completed batch — reset its state or use a new revision id like `batch_x_v2`).

Credentials come from the environment (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)
or an AWS profile (`--profile`), never from plain CLI flags.

Example (home MinIO; S3_* already in env or backend/.env):

    python -m scripts.upload_post_batch --batch-dir ./batch_20260109_001

Layout expected under --batch-dir:

    batch_20260109_001/
      feed_posts.json            # the frozen manifest (batch.external_id inside)
      assets/
        image_001.png            # referenced by feed_posts.json as "assets/image_001.png"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.schemas.external_import import ExternalImportPayload
from app.schemas.s3_ready import (
    BatchValidationError,
    ensure_safe_relative_key,
    is_remote_or_absolute,
)
from app.services.s3_storage import S3IngestConfig, build_s3_client


class UploadError(Exception):
    pass


@dataclass(frozen=True)
class UploadItem:
    local_path: Path
    object_key: str
    content_type: str


@dataclass
class UploadPlan:
    batch_id: str
    manifest: UploadItem
    assets: list[UploadItem] = field(default_factory=list)  # unique objects to upload
    ready_key: str = ""
    ready_marker: dict[str, Any] = field(default_factory=dict)
    asset_occurrences: int = 0  # manifest asset refs that resolve to batch objects


def _content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def build_upload_plan(
    batch_dir: Path,
    config: S3IngestConfig,
    *,
    batch_id: str | None = None,
    ready_at: datetime | None = None,
) -> UploadPlan:
    """Validate the local batch and compute exactly what to upload.

    Pure (no network): parses the manifest, resolves batch-relative assets to
    object keys, confirms each local file exists, and builds the `_READY.json`
    marker (manifest sha256 + asset_count). Remote/absolute asset refs (e.g. link
    assets) are left out of the upload. Raises UploadError on any problem so the
    caller never uploads a broken batch.
    """
    if not batch_dir.is_dir():
        raise UploadError(f"--batch-dir is not a directory: {batch_dir}")

    manifest_path = batch_dir / config.manifest_filename
    if not manifest_path.is_file():
        raise UploadError(f"manifest not found: {manifest_path}")

    manifest_bytes = manifest_path.read_bytes()
    try:
        payload = ExternalImportPayload.model_validate_json(manifest_bytes)
    except ValidationError as exc:
        raise UploadError(f"manifest failed schema validation:\n{exc}") from exc

    resolved_batch_id = batch_id or payload.batch.external_id
    if resolved_batch_id != payload.batch.external_id:
        raise UploadError(
            f"--batch-id {resolved_batch_id!r} does not match manifest batch.external_id "
            f"{payload.batch.external_id!r}. The prefix and manifest must agree."
        )

    seen: dict[str, UploadItem] = {}
    occurrences = 0
    for post in payload.posts:
        for asset in post.assets:
            if is_remote_or_absolute(asset.url):
                continue  # link / already-served asset, not a batch object
            try:
                safe = ensure_safe_relative_key(asset.url, field="asset.url", code="asset_key_invalid")
            except BatchValidationError as exc:
                raise UploadError(str(exc)) from exc
            occurrences += 1
            object_key = config.key_in_batch(resolved_batch_id, safe)
            if object_key in seen:
                continue
            local = (batch_dir / safe).resolve()
            if not local.is_file():
                raise UploadError(f"declared asset file not found: {batch_dir / safe}")
            seen[object_key] = UploadItem(local, object_key, _content_type(local))

    manifest_item = UploadItem(
        manifest_path,
        config.key_in_batch(resolved_batch_id, config.manifest_filename),
        "application/json",
    )

    at = ready_at or datetime.now().astimezone()
    ready_marker = {
        "schema_version": "1.0",
        "batch_external_id": resolved_batch_id,
        "manifest_key": config.manifest_filename,
        "ready_at": at.isoformat(),
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "asset_count": occurrences,
    }

    return UploadPlan(
        batch_id=resolved_batch_id,
        manifest=manifest_item,
        assets=list(seen.values()),
        ready_key=config.ready_key(resolved_batch_id),
        ready_marker=ready_marker,
        asset_occurrences=occurrences,
    )


def _object_exists(client: Any, bucket: str, key: str) -> bool:
    from botocore.exceptions import ClientError

    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise


def upload_plan(
    client: Any,
    bucket: str,
    plan: UploadPlan,
    *,
    overwrite: bool,
    dry_run: bool,
) -> None:
    """Upload assets, then the manifest, then `_READY.json` last."""
    if not overwrite and _object_exists(client, bucket, plan.ready_key):
        raise UploadError(
            f"batch already uploaded (found {plan.ready_key}). Use --overwrite to replace, "
            "but note the backend will not auto-reprocess a completed batch — reset its "
            "state or use a new revision id (e.g. <id>_v2)."
        )

    print(f"batch: {plan.batch_id}  bucket: {bucket}")
    print(f"assets: {len(plan.assets)} object(s), {plan.asset_occurrences} manifest ref(s)")

    for item in plan.assets:
        _put(client, bucket, item.object_key, item.local_path.read_bytes(), item.content_type, dry_run, "asset")
    _put(client, bucket, plan.manifest.object_key, plan.manifest.local_path.read_bytes(), "application/json", dry_run, "manifest")
    # _READY.json strictly last.
    ready_bytes = json.dumps(plan.ready_marker, indent=2).encode("utf-8")
    _put(client, bucket, plan.ready_key, ready_bytes, "application/json", dry_run, "ready")

    print("dry-run: nothing uploaded" if dry_run else "upload complete")


def _put(client: Any, bucket: str, key: str, data: bytes, content_type: str, dry_run: bool, kind: str) -> None:
    marker = "[dry-run] " if dry_run else ""
    print(f"  {marker}{kind:8} -> {key} ({len(data)} bytes, {content_type})")
    if not dry_run:
        client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)


def _config_from_args(args: argparse.Namespace) -> S3IngestConfig:
    bucket = args.bucket or os.environ.get("S3_BUCKET")
    if not bucket:
        raise UploadError("bucket is required (pass --bucket or set S3_BUCKET).")
    force_path_style = _env_bool(os.environ.get("S3_FORCE_PATH_STYLE"))
    return S3IngestConfig(
        bucket=bucket,
        root_prefix=args.root_prefix or os.environ.get("S3_ROOT_PREFIX", "estagram"),
        batches_prefix=os.environ.get("S3_BATCHES_PREFIX", "batches"),
        manifest_filename=args.manifest_filename or os.environ.get("S3_MANIFEST_FILENAME", "feed_posts.json"),
        ready_filename=os.environ.get("S3_READY_FILENAME", "_READY.json"),
        endpoint_url=args.endpoint_url or os.environ.get("S3_ENDPOINT_URL") or None,
        access_key_id=os.environ.get("S3_ACCESS_KEY_ID"),
        secret_access_key=os.environ.get("S3_SECRET_ACCESS_KEY"),
        region=os.environ.get("S3_REGION", "ap-northeast-2"),
        force_path_style=force_path_style,
    )


def _env_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _build_client(config: S3IngestConfig, profile: str | None) -> Any:
    if profile:
        import boto3
        from botocore.config import Config as BotoConfig

        session = boto3.Session(profile_name=profile)
        return session.client(
            "s3",
            endpoint_url=config.endpoint_url,
            region_name=config.region,
            config=BotoConfig(
                signature_version="s3v4",
                s3={"addressing_style": "path" if config.force_path_style else "auto"},
            ),
        )
    return build_s3_client(config)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a post batch directory to S3/MinIO (v1.2.3).")
    parser.add_argument("--batch-dir", required=True, help="Local batch directory to upload.")
    parser.add_argument("--batch-id", default=None, help="Batch id / prefix name (default: manifest batch.external_id).")
    parser.add_argument("--endpoint-url", default=None, help="S3 endpoint (default: S3_ENDPOINT_URL).")
    parser.add_argument("--bucket", default=None, help="Target bucket (default: S3_BUCKET).")
    parser.add_argument("--root-prefix", default=None, help="Root prefix (default: S3_ROOT_PREFIX or 'estagram').")
    parser.add_argument("--manifest-filename", default=None, help="Manifest filename (default: S3_MANIFEST_FILENAME).")
    parser.add_argument("--profile", default=None, help="AWS profile for credentials (instead of S3_ACCESS_KEY_ID/SECRET).")
    parser.add_argument("--overwrite", action="store_true", help="Re-upload even if the batch already exists.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the plan without uploading.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        config = _config_from_args(args)
        plan = build_upload_plan(Path(args.batch_dir), config, batch_id=args.batch_id)
        client = _build_client(config, args.profile) if not args.dry_run else None
        if args.dry_run:
            # Print the plan without needing a client/endpoint.
            print(f"batch: {plan.batch_id}  bucket: {config.bucket}")
            print(f"assets: {len(plan.assets)} object(s), {plan.asset_occurrences} manifest ref(s)")
            for item in plan.assets:
                print(f"  [dry-run] asset    -> {item.object_key} ({item.content_type})")
            print(f"  [dry-run] manifest -> {plan.manifest.object_key}")
            print(f"  [dry-run] ready    -> {plan.ready_key}")
            print("dry-run: nothing uploaded")
        else:
            upload_plan(client, config.bucket, plan, overwrite=args.overwrite, dry_run=False)
    except UploadError as exc:
        print(f"upload failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"upload failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
