"""Producer upload CLI check (v1.2.3).

Validates `build_upload_plan` (manifest parse, asset resolution/existence, ready
marker) and the strict asset -> manifest -> _READY upload ordering, using temp
dirs and a fake client. Runs with no boto3, no MinIO, no DB.

Usage (from feed-prototype/backend):

    python -m scripts.check_upload_post_batch
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

from app.services.s3_storage import S3IngestConfig
from scripts.upload_post_batch import UploadError, build_upload_plan, upload_plan


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


class FakeClient:
    def __init__(self) -> None:
        self.keys: list[str] = []

    def put_object(self, *, Bucket: str, Key: str, Body: Any, ContentType: str) -> None:  # noqa: N803
        self.keys.append(Key)


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


CHECKS = [
    ("valid plan", check_valid_plan),
    ("dedup + occurrence count", check_dedup_and_occurrences),
    ("missing asset file", check_missing_asset),
    ("batch id mismatch", check_batch_id_mismatch),
    ("path traversal rejected", check_traversal_rejected),
    ("manifest missing", check_manifest_missing),
    ("upload order assets->manifest->ready", check_upload_order),
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
