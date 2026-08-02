"""Producer upload CLI check (v1.2.3).

Validates `build_upload_plan` (manifest parse, asset resolution/existence, ready
marker) and the strict asset -> manifest -> _READY upload ordering, using temp
dirs and a fake client. Runs with no boto3, no MinIO, no DB.

Usage (from feed-prototype/backend):

    python -m scripts.check_upload_post_batch
"""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
from pathlib import Path
from typing import Any

from app.services.s3_storage import S3IngestConfig
from scripts.upload_post_batch import (
    BatchAlreadyUploadedError,
    UploadError,
    build_upload_plan,
    discover_batch_dirs,
    parse_args,
    upload_plan,
)


CONFIG = S3IngestConfig(bucket="estagram", root_prefix="estagram", batches_prefix="batches")


def make_batch(root: Path, batch_id: str, *, assets, asset_files, batch_external_id=None):
    d = root / batch_id
    (d / "assets").mkdir(parents=True, exist_ok=True)
    for name, content in asset_files.items():
        (d / "assets" / name).write_bytes(content)
    manifest = {
        "batch": {"external_id": batch_external_id or batch_id, "source": "producer-check"},
        "accounts": [{"external_id": f"acct-{batch_id}", "handle": f"h_{batch_id}", "display_name": "P"}],
        "posts": [
            {
                "external_id": f"post-{batch_id}",
                "account_external_id": f"acct-{batch_id}",
                "title": "t",
                "assets": assets,
            }
        ],
    }
    (d / "feed_posts.json").write_text(json.dumps(manifest), encoding="utf-8")
    return d


def expect_error(fn, needle: str) -> None:
    try:
        fn()
    except UploadError as exc:
        assert needle in str(exc), f"expected {needle!r} in error, got: {exc}"
        return
    raise AssertionError(f"expected UploadError containing {needle!r}")


def expect_exit(fn) -> None:
    """argparse rejects bad flag combinations by raising SystemExit(2)."""
    stderr = io.StringIO()
    try:
        with contextlib.redirect_stderr(stderr):
            fn()
    except SystemExit as exc:
        assert exc.code == 2, f"expected SystemExit(2), got {exc.code}"
        return
    raise AssertionError("expected SystemExit from argparse")


class FakeClient:
    def __init__(self, existing_keys: set[str] | None = None) -> None:
        self.keys: list[str] = []
        self.existing_keys = existing_keys or set()

    def put_object(self, *, Bucket: str, Key: str, Body: Any, ContentType: str) -> None:  # noqa: N803
        self.keys.append(Key)

    def head_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:  # noqa: N803
        from botocore.exceptions import ClientError

        if Key in self.existing_keys:
            return {}
        raise ClientError({"Error": {"Code": "404"}}, "HeadObject")


def check_valid_plan() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_ok",
            assets=[{"type": "image", "url": "assets/image_001.png", "sort_order": 1}],
            asset_files={"image_001.png": b"PNGDATA"},
        )
        plan = build_upload_plan(d, CONFIG)
        assert plan.batch_id == "batch_ok"
        assert len(plan.assets) == 1
        assert plan.assets[0].object_key == "estagram/batches/batch_ok/assets/image_001.png"
        assert plan.assets[0].content_type == "image/png"
        assert plan.manifest.object_key == "estagram/batches/batch_ok/feed_posts.json"
        assert plan.ready_key == "estagram/batches/batch_ok/_READY.json"
        assert plan.ready_marker["asset_count"] == 1
        assert plan.ready_marker["batch_external_id"] == "batch_ok"
        assert len(plan.ready_marker["manifest_sha256"]) == 64


def check_dedup_and_occurrences() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_dup",
            assets=[
                {"type": "table", "url": "assets/summary.csv", "sort_order": 1},
                {"type": "table", "url": "assets/summary.csv", "sort_order": 2},
                {"type": "link", "url": "https://example.com/ref", "sort_order": 3},
            ],
            asset_files={"summary.csv": b"a,b\n1,2\n"},
        )
        plan = build_upload_plan(d, CONFIG)
        # one unique object uploaded, but two batch-relative occurrences counted
        assert len(plan.assets) == 1
        assert plan.asset_occurrences == 2
        assert plan.ready_marker["asset_count"] == 2  # matches worker's occurrence count


def check_missing_asset() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_miss",
            assets=[{"type": "image", "url": "assets/nope.png", "sort_order": 1}],
            asset_files={},  # file not created
        )
        expect_error(lambda: build_upload_plan(d, CONFIG), "asset file not found")


def check_batch_id_mismatch() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "dirname",
            assets=[{"type": "image", "url": "assets/x.png", "sort_order": 1}],
            asset_files={"x.png": b"x"},
            batch_external_id="different_in_manifest",
        )
        expect_error(lambda: build_upload_plan(d, CONFIG, batch_id="dirname"), "does not match manifest")


def check_traversal_rejected() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_trav",
            assets=[{"type": "image", "url": "../escape.png", "sort_order": 1}],
            asset_files={},
        )
        expect_error(lambda: build_upload_plan(d, CONFIG), "asset.url")


def check_manifest_missing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp) / "empty"
        d.mkdir()
        expect_error(lambda: build_upload_plan(d, CONFIG), "manifest not found")


def check_upload_order() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_order",
            assets=[
                {"type": "image", "url": "assets/a.png", "sort_order": 1},
                {"type": "image", "url": "assets/b.png", "sort_order": 2},
            ],
            asset_files={"a.png": b"a", "b.png": b"b"},
        )
        plan = build_upload_plan(d, CONFIG)
        client = FakeClient()
        upload_plan(client, "estagram", plan, overwrite=True, dry_run=False)
        # assets first (any order), manifest, then _READY.json strictly last
        assert client.keys[-1] == "estagram/batches/batch_order/_READY.json"
        assert client.keys[-2] == "estagram/batches/batch_order/feed_posts.json"
        assert set(client.keys[:2]) == {
            "estagram/batches/batch_order/assets/a.png",
            "estagram/batches/batch_order/assets/b.png",
        }


def check_discover_batch_dirs() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        flat = make_batch(
            root,
            "batch_flat",
            assets=[{"type": "image", "url": "assets/x.png", "sort_order": 1}],
            asset_files={"x.png": b"x"},
        )
        # a batch nested one level deeper must still be found
        nested_parent = root / "wrapper"
        nested_parent.mkdir()
        nested = make_batch(
            nested_parent,
            "batch_nested",
            assets=[{"type": "image", "url": "assets/y.png", "sort_order": 1}],
            asset_files={"y.png": b"y"},
        )
        # a directory with no manifest is not a batch
        (root / "not_a_batch").mkdir()

        found = discover_batch_dirs(root, "feed_posts.json")
        assert found == sorted([flat, nested]), f"unexpected discovery: {found}"


def check_discover_errors() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        empty = Path(tmp) / "empty"
        empty.mkdir()
        expect_error(lambda: discover_batch_dirs(empty, "feed_posts.json"), "no feed_posts.json found")
        expect_error(
            lambda: discover_batch_dirs(Path(tmp) / "missing", "feed_posts.json"),
            "--batch-root is not a directory",
        )


def check_already_uploaded_is_distinct_error() -> None:
    """--batch-root counts an existing batch as skipped, so it needs its own type."""
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_dup_upload",
            assets=[{"type": "image", "url": "assets/x.png", "sort_order": 1}],
            asset_files={"x.png": b"x"},
        )
        plan = build_upload_plan(d, CONFIG)
        client = FakeClient(existing_keys={plan.ready_key})
        try:
            upload_plan(client, "estagram", plan, overwrite=False, dry_run=False)
        except BatchAlreadyUploadedError:
            pass
        else:
            raise AssertionError("expected BatchAlreadyUploadedError")
        assert client.keys == [], "nothing should be uploaded when the batch already exists"

        # --overwrite still replaces it
        upload_plan(client, "estagram", plan, overwrite=True, dry_run=False)
        assert client.keys[-1] == plan.ready_key


def check_quiet_upload_still_ordered() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = make_batch(
            Path(tmp),
            "batch_quiet",
            assets=[{"type": "image", "url": "assets/a.png", "sort_order": 1}],
            asset_files={"a.png": b"a"},
        )
        plan = build_upload_plan(d, CONFIG)
        client = FakeClient()
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            upload_plan(client, "estagram", plan, overwrite=True, dry_run=False, verbose=False)
        assert out.getvalue() == "", f"verbose=False should print nothing, got: {out.getvalue()!r}"
        assert client.keys[-1] == "estagram/batches/batch_quiet/_READY.json"


def check_cli_target_flags() -> None:
    single = parse_args(["--batch-dir", "./b"])
    assert single.batch_dir == "./b" and single.batch_root is None

    bulk = parse_args(["--batch-root", "./parent"])
    assert bulk.batch_root == "./parent" and bulk.batch_dir is None

    expect_exit(lambda: parse_args([]))  # one target is required
    expect_exit(lambda: parse_args(["--batch-dir", "./b", "--batch-root", "./p"]))  # mutually exclusive
    expect_exit(lambda: parse_args(["--batch-root", "./p", "--batch-id", "x"]))  # ambiguous


CHECKS = [
    ("valid plan", check_valid_plan),
    ("dedup + occurrence count", check_dedup_and_occurrences),
    ("missing asset file", check_missing_asset),
    ("batch id mismatch", check_batch_id_mismatch),
    ("path traversal rejected", check_traversal_rejected),
    ("manifest missing", check_manifest_missing),
    ("upload order assets->manifest->ready", check_upload_order),
    ("batch-root discovery (flat + nested)", check_discover_batch_dirs),
    ("batch-root discovery errors", check_discover_errors),
    ("already-uploaded raises distinct error", check_already_uploaded_is_distinct_error),
    ("quiet upload keeps ordering", check_quiet_upload_still_ordered),
    ("cli target flags", check_cli_target_flags),
]


def main() -> int:
    passed = failed = 0
    for name, fn in CHECKS:
        try:
            fn()
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[FAIL] {name}: {type(exc).__name__}: {exc}")
        else:
            passed += 1
            print(f"[ok]   {name}")
    print(f"\ncheck_upload_post_batch: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
