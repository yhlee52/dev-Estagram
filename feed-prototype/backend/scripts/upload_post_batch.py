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

`--batch-root` uploads every batch under a parent directory in one run, finding
batch directories by searching recursively for the manifest filename (so nested
layouts work too). Each batch is still uploaded in the same strict order, and one
bad batch never aborts the run: the batch is reported as failed and the rest
continue, with an `uploaded / skipped / failed` summary at the end. Batches that
are already in the bucket count as `skipped`, not `failed`, so an interrupted run
can simply be re-run to upload only what is missing.

    python -m scripts.upload_post_batch --batch-root ./post_batches --dry-run
    python -m scripts.upload_post_batch --batch-root ./post_batches
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


class BatchAlreadyUploadedError(UploadError):
    """The batch's `_READY.json` is already in the bucket and --overwrite was not given.

    A distinct type so `--batch-root` can count an existing batch as `skipped`
    instead of `failed` — that is what makes an interrupted bulk run resumable.
    """


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


def discover_batch_dirs(batch_root: Path, manifest_filename: str) -> list[Path]:
    """Find every batch directory under `batch_root`, deepest-first-safe and sorted.

    A directory counts as a batch when it directly contains the manifest file. The
    search is recursive so a parent holding batches at mixed depths still works.
    Pure (no network, no parsing) — validation happens per batch in build_upload_plan.
    """
    if not batch_root.is_dir():
        raise UploadError(f"--batch-root is not a directory: {batch_root}")

    batch_dirs = sorted(
        {manifest.parent for manifest in batch_root.rglob(manifest_filename) if manifest.is_file()}
    )
    if not batch_dirs:
        raise UploadError(f"no {manifest_filename} found anywhere under {batch_root}")
    return batch_dirs


def peek_batch_id(batch_dir: Path, manifest_filename: str) -> str | None:
    """Read `batch.external_id` cheaply, or None if the manifest is unusable.

    Deliberately forgiving: a manifest this cannot read is still reported per
    batch by `build_upload_plan`, which produces the real error message. This
    exists only to spot id collisions before anything is uploaded.
    """
    try:
        payload = json.loads((batch_dir / manifest_filename).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    batch_id = (payload.get("batch") or {}).get("external_id") if isinstance(payload, dict) else None
    return batch_id.strip() if isinstance(batch_id, str) and batch_id.strip() else None


def find_batch_id_collisions(
    batch_dirs: list[Path], manifest_filename: str
) -> dict[str, list[Path]]:
    """Group directories that declare the same `batch.external_id`.

    The batch id *is* the object prefix, so two directories sharing one id write
    over each other: without --overwrite the later ones look like an ordinary
    "already uploaded" skip, and with --overwrite the last one silently wins.
    Neither is recoverable after the fact, so `--batch-root` refuses to start.
    """
    by_id: dict[str, list[Path]] = {}
    for batch_dir in batch_dirs:
        batch_id = peek_batch_id(batch_dir, manifest_filename)
        if batch_id is not None:
            by_id.setdefault(batch_id, []).append(batch_dir)
    return {batch_id: dirs for batch_id, dirs in by_id.items() if len(dirs) > 1}


def format_collisions(collisions: dict[str, list[Path]]) -> str:
    lines = [
        f"{len(collisions)} batch id(s) are declared by more than one directory. Every "
        "directory sharing an id uploads to the same prefix and overwrites the others, "
        "so nothing was uploaded:"
    ]
    for batch_id, dirs in sorted(collisions.items()):
        lines.append(f"  {batch_id}")
        for batch_dir in dirs:
            lines.append(f"    - {batch_dir}")
    lines.append(
        "Give each directory its own batch.external_id, or upload them individually "
        "with --batch-dir."
    )
    return "\n".join(lines)


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
    verbose: bool = True,
) -> None:
    """Upload assets, then the manifest, then `_READY.json` last.

    `verbose=False` silences the per-object log so `--batch-root` can print one
    line per batch instead of one line per object.
    """
    if not overwrite and _object_exists(client, bucket, plan.ready_key):
        raise BatchAlreadyUploadedError(
            f"batch already uploaded (found {plan.ready_key}). Use --overwrite to replace, "
            "but note the backend will not auto-reprocess a completed batch — reset its "
            "state or use a new revision id (e.g. <id>_v2)."
        )

    if verbose:
        print(f"batch: {plan.batch_id}  bucket: {bucket}")
        print(f"assets: {len(plan.assets)} object(s), {plan.asset_occurrences} manifest ref(s)")

    for item in plan.assets:
        _put(client, bucket, item.object_key, item.local_path.read_bytes(), item.content_type, dry_run, "asset", verbose)
    _put(client, bucket, plan.manifest.object_key, plan.manifest.local_path.read_bytes(), "application/json", dry_run, "manifest", verbose)
    # _READY.json strictly last.
    ready_bytes = json.dumps(plan.ready_marker, indent=2).encode("utf-8")
    _put(client, bucket, plan.ready_key, ready_bytes, "application/json", dry_run, "ready", verbose)

    if verbose:
        print("dry-run: nothing uploaded" if dry_run else "upload complete")


def _put(
    client: Any,
    bucket: str,
    key: str,
    data: bytes,
    content_type: str,
    dry_run: bool,
    kind: str,
    verbose: bool = True,
) -> None:
    if verbose:
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
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--batch-dir", default=None, help="Local batch directory to upload.")
    target.add_argument(
        "--batch-root",
        default=None,
        help="Parent directory: upload every batch found underneath it (recursive).",
    )
    parser.add_argument("--batch-id", default=None, help="Batch id / prefix name (default: manifest batch.external_id).")
    parser.add_argument("--endpoint-url", default=None, help="S3 endpoint (default: S3_ENDPOINT_URL).")
    parser.add_argument("--bucket", default=None, help="Target bucket (default: S3_BUCKET).")
    parser.add_argument("--root-prefix", default=None, help="Root prefix (default: S3_ROOT_PREFIX or 'estagram').")
    parser.add_argument("--manifest-filename", default=None, help="Manifest filename (default: S3_MANIFEST_FILENAME).")
    parser.add_argument("--profile", default=None, help="AWS profile for credentials (instead of S3_ACCESS_KEY_ID/SECRET).")
    parser.add_argument("--overwrite", action="store_true", help="Re-upload even if the batch already exists.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the plan without uploading.")
    args = parser.parse_args(argv)
    if args.batch_root and args.batch_id:
        parser.error("--batch-id applies to a single batch; it cannot be combined with --batch-root.")
    return args


def _run_single(batch_dir: Path, config: S3IngestConfig, args: argparse.Namespace) -> int:
    """Upload one batch. Any problem raises, so the caller exits non-zero."""
    plan = build_upload_plan(batch_dir, config, batch_id=args.batch_id)
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
        client = _build_client(config, args.profile)
        upload_plan(client, config.bucket, plan, overwrite=args.overwrite, dry_run=False)
    return 0


def _run_batch_root(batch_root: Path, config: S3IngestConfig, args: argparse.Namespace) -> int:
    """Upload every batch under `batch_root`, never aborting on a single bad batch.

    Discovery problems (bad root, nothing found) still raise — there is nothing to
    do. Per-batch problems are caught and tallied so batch 3 of 200 failing does
    not throw away the other 197.
    """
    batch_dirs = discover_batch_dirs(batch_root, config.manifest_filename)
    total = len(batch_dirs)
    print(f"batch-root: {batch_root}")
    print(f"discovered: {total} batch director{'y' if total == 1 else 'ies'}  bucket: {config.bucket}")

    # Refuse before uploading anything: a collision destroys data silently, and
    # --dry-run must catch it too, which is the whole point of running one.
    collisions = find_batch_id_collisions(batch_dirs, config.manifest_filename)
    if collisions:
        raise UploadError(format_collisions(collisions))

    client = None if args.dry_run else _build_client(config, args.profile)
    uploaded: list[str] = []
    skipped: list[str] = []
    failed: list[tuple[Path, str]] = []

    for index, batch_dir in enumerate(batch_dirs, start=1):
        label = f"[{index}/{total}] {batch_dir.name}"
        try:
            plan = build_upload_plan(batch_dir, config)
            if args.dry_run:
                print(f"{label}: ok       batch={plan.batch_id}  {len(plan.assets)} object(s)")
                uploaded.append(plan.batch_id)
                continue
            upload_plan(client, config.bucket, plan, overwrite=args.overwrite, dry_run=False, verbose=False)
            print(f"{label}: uploaded batch={plan.batch_id}  {len(plan.assets)} object(s)")
            uploaded.append(plan.batch_id)
        except BatchAlreadyUploadedError:
            print(f"{label}: skipped  already in bucket")
            skipped.append(batch_dir.name)
        except UploadError as exc:
            reason = " ".join(str(exc).split())
            print(f"{label}: FAILED   {reason}", file=sys.stderr)
            failed.append((batch_dir, reason))
        except Exception as exc:  # noqa: BLE001
            reason = f"{type(exc).__name__}: {exc}"
            print(f"{label}: FAILED   {reason}", file=sys.stderr)
            failed.append((batch_dir, reason))

    verb = "validated" if args.dry_run else "uploaded"
    print(f"\nsummary: {verb}={len(uploaded)} skipped={len(skipped)} failed={len(failed)} of {total}")
    if failed:
        print("failed batches:", file=sys.stderr)
        for batch_dir, reason in failed:
            print(f"  {batch_dir}: {reason}", file=sys.stderr)
    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        config = _config_from_args(args)
        if args.batch_root:
            return _run_batch_root(Path(args.batch_root), config, args)
        return _run_single(Path(args.batch_dir), config, args)
    except UploadError as exc:
        print(f"upload failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"upload failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
