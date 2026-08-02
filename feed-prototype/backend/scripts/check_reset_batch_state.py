"""Batch state reset CLI check (v1.2.5).

Validates the pure parts of `reset_batch_state`: which states may be reset,
reading `batch.external_id` out of a manifest, target resolution from
`--batch-id`/`--batch-dir`/`--batch-root`, and the CLI flag rules. Runs with no
DB and no S3 — `reset_batches` itself is exercised live against Postgres.

Usage (from feed-prototype/backend):

    python -m scripts.check_reset_batch_state
"""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
from pathlib import Path

from scripts.reset_batch_state import (
    ResetError,
    parse_args,
    plan_reset,
    read_batch_id,
    resolve_targets,
)

MANIFEST = "feed_posts.json"


def write_batch(root: Path, dirname: str, batch_external_id: str | None, *, raw: str | None = None) -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    if raw is not None:
        (d / MANIFEST).write_text(raw, encoding="utf-8")
        return d
    body = {"batch": {"external_id": batch_external_id}} if batch_external_id is not None else {"batch": {}}
    (d / MANIFEST).write_text(json.dumps(body), encoding="utf-8")
    return d


def expect_error(fn, needle: str) -> None:
    try:
        fn()
    except ResetError as exc:
        assert needle in str(exc), f"expected {needle!r} in error, got: {exc}"
        return
    raise AssertionError(f"expected ResetError containing {needle!r}")


def expect_exit(fn) -> None:
    stderr = io.StringIO()
    try:
        with contextlib.redirect_stderr(stderr):
            fn()
    except SystemExit as exc:
        assert exc.code == 2, f"expected SystemExit(2), got {exc.code}"
        return
    raise AssertionError("expected SystemExit from argparse")


def check_plan_reset_states() -> None:
    # A NULL ingest_state means the row belongs to the filesystem/HTTP import
    # path — the worker ignores it, so the reset must not touch it either.
    assert plan_reset(None, force=False)[0] is False
    assert "not an S3-managed batch" in plan_reset(None, force=False)[1]

    assert plan_reset("pending", force=False) == (False, "already pending")
    assert plan_reset("completed", force=False) == (True, "completed -> pending")
    assert plan_reset("failed", force=False) == (True, "failed -> pending")
    assert plan_reset("ignored", force=False) == (True, "ignored -> pending")


def check_processing_needs_force() -> None:
    """Resetting a live claim would let two workers import the same batch."""
    blocked, reason = plan_reset("processing", force=False)
    assert blocked is False
    assert "--force" in reason
    assert plan_reset("processing", force=True) == (True, "processing -> pending")

    # --force must not override the NULL rule: that row is not ours to touch.
    assert plan_reset(None, force=True)[0] is False


def check_read_batch_id() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = write_batch(Path(tmp), "dirname_differs", "id-from-manifest")
        assert read_batch_id(d, MANIFEST) == "id-from-manifest"


def check_read_batch_id_errors() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "no_manifest").mkdir()
        expect_error(lambda: read_batch_id(root / "no_manifest", MANIFEST), "manifest not found")

        bad_json = write_batch(root, "bad_json", None, raw="{not json")
        expect_error(lambda: read_batch_id(bad_json, MANIFEST), "not valid JSON")

        no_id = write_batch(root, "no_id", None)
        expect_error(lambda: read_batch_id(no_id, MANIFEST), "no batch.external_id")

        blank = write_batch(root, "blank_id", "   ")
        expect_error(lambda: read_batch_id(blank, MANIFEST), "no batch.external_id")


def check_resolve_from_batch_ids() -> None:
    args = parse_args(["--batch-id", "b1", "--batch-id", "b2", "--batch-id", "b1"])
    assert resolve_targets(args, MANIFEST).batch_ids == ["b1", "b2"], "repeatable, order-preserving, de-duplicated"


def check_resolve_from_batch_dir() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        d = write_batch(Path(tmp), "some_folder_name", "the-real-id")
        args = parse_args(["--batch-dir", str(d)])
        assert resolve_targets(args, MANIFEST).batch_ids == ["the-real-id"]


def check_resolve_from_batch_root() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_batch(root, "a_batch", "id-a")
        write_batch(root / "wrapper", "b_batch", "id-b")  # nested one level deeper
        (root / "not_a_batch").mkdir()

        args = parse_args(["--batch-root", str(root)])
        resolved = resolve_targets(args, MANIFEST)
        assert sorted(resolved.batch_ids) == ["id-a", "id-b"]
        assert resolved.unreadable == [] and resolved.collisions == {}


def check_resolve_root_errors() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        empty = Path(tmp) / "empty"
        empty.mkdir()
        expect_error(
            lambda: resolve_targets(parse_args(["--batch-root", str(empty)]), MANIFEST),
            f"no {MANIFEST} found",
        )
        expect_error(
            lambda: resolve_targets(parse_args(["--batch-root", str(Path(tmp) / "missing")]), MANIFEST),
            "--batch-root is not a directory",
        )


def check_resolve_root_tolerates_bad_manifest() -> None:
    """One unreadable manifest must not throw away the whole run.

    The republish loop is "upload --batch-root, then reset --batch-root". If the
    upload tolerates a bad batch but the reset aborts, the upload succeeds and
    nothing is re-imported — the correction silently never lands.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_batch(root, "good_a", "id-a")
        write_batch(root, "good_b", "id-b")
        write_batch(root, "broken", None, raw="{not json")

        resolved = resolve_targets(parse_args(["--batch-root", str(root)]), MANIFEST)
        assert sorted(resolved.batch_ids) == ["id-a", "id-b"], "good batches still resolve"
        assert len(resolved.unreadable) == 1, "the bad one is reported, not raised"
        assert resolved.unreadable[0][0].name == "broken"


def check_resolve_root_detects_collisions() -> None:
    """Two directories sharing a batch id share one tracking row and one prefix."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_batch(root, "folder_one", "same-id")
        write_batch(root, "folder_two", "same-id")
        write_batch(root, "folder_three", "unique-id")

        resolved = resolve_targets(parse_args(["--batch-root", str(root)]), MANIFEST)
        assert set(resolved.collisions) == {"same-id"}
        assert len(resolved.collisions["same-id"]) == 2
        assert sorted(d.name for d in resolved.collisions["same-id"]) == ["folder_one", "folder_two"]


def check_cli_target_flags() -> None:
    assert parse_args(["--batch-id", "x"]).batch_id == ["x"]
    assert parse_args(["--batch-dir", "./d"]).batch_dir == "./d"
    assert parse_args(["--batch-root", "./r"]).batch_root == "./r"
    assert parse_args(["--batch-id", "x", "--force"]).force is True
    assert parse_args(["--batch-id", "x"]).dry_run is False

    expect_exit(lambda: parse_args([]))  # one target is required
    expect_exit(lambda: parse_args(["--batch-id", "x", "--batch-dir", "./d"]))  # mutually exclusive
    expect_exit(lambda: parse_args(["--batch-dir", "./d", "--batch-root", "./r"]))


CHECKS = [
    ("plan_reset per state", check_plan_reset_states),
    ("processing requires --force", check_processing_needs_force),
    ("read batch id from manifest", check_read_batch_id),
    ("manifest read errors", check_read_batch_id_errors),
    ("resolve --batch-id (repeat + dedup)", check_resolve_from_batch_ids),
    ("resolve --batch-dir", check_resolve_from_batch_dir),
    ("resolve --batch-root (flat + nested)", check_resolve_from_batch_root),
    ("resolve --batch-root errors", check_resolve_root_errors),
    ("resolve --batch-root tolerates bad manifest", check_resolve_root_tolerates_bad_manifest),
    ("resolve --batch-root detects id collisions", check_resolve_root_detects_collisions),
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
    print(f"\ncheck_reset_batch_state: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
