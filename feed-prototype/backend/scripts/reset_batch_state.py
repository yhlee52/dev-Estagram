"""Operator reset of S3 batch ingest state, so a corrected batch re-imports (v1.2.5).

A `completed` batch is never re-processed: the watch worker decides from
`import_batch.ingest_state`, not from S3, and `find_or_create_pending` does not
compare the manifest etag. So re-uploading a corrected batch under the same id
does nothing on its own — the fix loop is "upload with --overwrite, then reset
the tracking row to pending", which is what this script automates.

Usage (from `feed-prototype/backend`, with DATABASE_URL set):

    python -m scripts.reset_batch_state --batch-id my_batch_001
    python -m scripts.reset_batch_state --batch-dir C:\\path\\to\\my_batch_001
    python -m scripts.reset_batch_state --batch-root C:\\path\\to\\batches --dry-run

`--batch-dir`/`--batch-root` read `batch.external_id` out of the manifest, so the
same path you passed to `upload_post_batch` works here — no need to know the id.
`--batch-id` can be repeated.

Only S3-managed rows are touched. A row whose `ingest_state` is NULL belongs to
the filesystem/HTTP import path and is left alone, and a row still `processing`
is refused unless `--force` (resetting a live claim would let two workers import
the same batch concurrently).

This only clears DB state. It never touches S3 objects — re-upload the corrected
batch yourself with `upload_post_batch --overwrite` first.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.session import create_session
from app.models.import_batch import ImportBatch

STATE_PENDING = "pending"
STATE_PROCESSING = "processing"


class ResetError(Exception):
    pass


@dataclass(frozen=True)
class ResetOutcome:
    batch_id: str
    action: str  # "reset" | "skipped" | "missing"
    detail: str = ""


def read_batch_id(batch_dir: Path, manifest_filename: str) -> str:
    """Pull `batch.external_id` out of a batch directory's manifest."""
    manifest_path = batch_dir / manifest_filename
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ResetError(f"manifest not found: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise ResetError(f"manifest is not valid JSON: {manifest_path}: {exc}") from exc

    batch_id = (payload.get("batch") or {}).get("external_id")
    if not isinstance(batch_id, str) or not batch_id.strip():
        raise ResetError(f"manifest has no batch.external_id: {manifest_path}")
    return batch_id.strip()


@dataclass(frozen=True)
class ResolvedTargets:
    batch_ids: list[str]
    unreadable: list[tuple[Path, str]]  # manifests that could not be parsed
    collisions: dict[str, list[Path]]  # batch id -> directories declaring it


def resolve_targets(args: argparse.Namespace, manifest_filename: str) -> ResolvedTargets:
    """Turn whichever target flag was given into batch ids, plus what went wrong.

    A single unreadable manifest under `--batch-root` must not throw away the
    whole run — it is reported alongside the batches that did resolve, matching
    how `upload_post_batch --batch-root` tolerates one bad batch. Collisions are
    reported separately because those abort: two directories sharing a batch id
    mean the tree itself is wrong, and resetting "one of them" is meaningless.
    """
    if args.batch_id:
        return ResolvedTargets(list(dict.fromkeys(args.batch_id)), [], {})

    if args.batch_dir:
        return ResolvedTargets([read_batch_id(Path(args.batch_dir), manifest_filename)], [], {})

    root = Path(args.batch_root)
    if not root.is_dir():
        raise ResetError(f"--batch-root is not a directory: {root}")
    batch_dirs = sorted({m.parent for m in root.rglob(manifest_filename) if m.is_file()})
    if not batch_dirs:
        raise ResetError(f"no {manifest_filename} found anywhere under {root}")

    batch_ids: list[str] = []
    unreadable: list[tuple[Path, str]] = []
    by_id: dict[str, list[Path]] = {}
    for batch_dir in batch_dirs:
        try:
            batch_id = read_batch_id(batch_dir, manifest_filename)
        except ResetError as exc:
            unreadable.append((batch_dir, " ".join(str(exc).split())))
            continue
        by_id.setdefault(batch_id, []).append(batch_dir)
        batch_ids.append(batch_id)

    collisions = {bid: dirs for bid, dirs in by_id.items() if len(dirs) > 1}
    return ResolvedTargets(list(dict.fromkeys(batch_ids)), unreadable, collisions)


def format_collisions(collisions: dict[str, list[Path]]) -> str:
    lines = [
        f"{len(collisions)} batch id(s) are declared by more than one directory. They share "
        "one object prefix and one tracking row, so resetting them individually is not "
        "possible. Nothing was reset:"
    ]
    for batch_id, dirs in sorted(collisions.items()):
        lines.append(f"  {batch_id}")
        for batch_dir in dirs:
            lines.append(f"    - {batch_dir}")
    lines.append("Give each directory its own batch.external_id.")
    return "\n".join(lines)


def plan_reset(ingest_state: str | None, *, force: bool) -> tuple[bool, str]:
    """Decide whether a row may be reset, from its state alone. Pure (no DB).

    Returns (should_reset, reason). Mirrors the worker's own rule that a NULL
    `ingest_state` means "not an S3 batch".
    """
    if ingest_state is None:
        return False, "not an S3-managed batch (ingest_state is NULL)"
    if ingest_state == STATE_PENDING:
        return False, "already pending"
    if ingest_state == STATE_PROCESSING and not force:
        return False, "currently processing — use --force if the worker is stopped"
    return True, f"{ingest_state} -> {STATE_PENDING}"


def reset_batches(
    session: Session,
    batch_ids: list[str],
    *,
    force: bool,
    dry_run: bool,
) -> list[ResetOutcome]:
    outcomes: list[ResetOutcome] = []
    for batch_id in batch_ids:
        record = session.exec(
            select(ImportBatch).where(ImportBatch.external_id == batch_id)
        ).first()
        if record is None:
            outcomes.append(
                ResetOutcome(batch_id, "missing", "no import_batch row (nothing imported yet)")
            )
            continue

        should_reset, reason = plan_reset(record.ingest_state, force=force)
        if not should_reset:
            outcomes.append(ResetOutcome(batch_id, "skipped", reason))
            continue

        if not dry_run:
            record.ingest_state = STATE_PENDING
            # Clear the previous attempt so a corrected batch starts clean and a
            # stale failure is not shown against a row that is about to re-run.
            record.processing_started_at = None
            record.attempt_count = 0
            record.error_code = None
            record.error_message = None
            session.add(record)
        outcomes.append(ResetOutcome(batch_id, "reset", reason))

    if not dry_run:
        session.commit()
    return outcomes


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset S3 batch ingest state to pending so the worker re-imports it."
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument(
        "--batch-id",
        action="append",
        default=None,
        help="Batch external id. Repeatable.",
    )
    target.add_argument("--batch-dir", default=None, help="Batch directory; reads its manifest id.")
    target.add_argument(
        "--batch-root",
        default=None,
        help="Parent directory; resets every batch found underneath it.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Also reset a row stuck in `processing` (only when the worker is stopped).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would change, change nothing.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        manifest_filename = get_settings().s3_manifest_filename
        targets = resolve_targets(args, manifest_filename)
        if targets.collisions:
            print(f"reset failed: {format_collisions(targets.collisions)}", file=sys.stderr)
            return 1
        session = create_session()
        try:
            outcomes = reset_batches(
                session, targets.batch_ids, force=args.force, dry_run=args.dry_run
            )
        finally:
            session.close()
    except ResetError as exc:
        print(f"reset failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"reset failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    marker = "[dry-run] " if args.dry_run else ""
    for outcome in outcomes:
        print(f"  {marker}{outcome.action:8} {outcome.batch_id}  ({outcome.detail})")

    counts = {action: sum(1 for o in outcomes if o.action == action) for action in ("reset", "skipped", "missing")}
    verb = "would reset" if args.dry_run else "reset"
    total = len(outcomes) + len(targets.unreadable)
    summary = f"\n{verb}={counts['reset']} skipped={counts['skipped']} missing={counts['missing']}"
    if targets.unreadable:
        summary += f" unreadable={len(targets.unreadable)}"
    print(f"{summary} of {total}")

    if targets.unreadable:
        print("unreadable manifests:", file=sys.stderr)
        for batch_dir, reason in targets.unreadable:
            print(f"  {batch_dir}: {reason}", file=sys.stderr)
    if counts["reset"] and not args.dry_run:
        print("next poll of the watch worker will re-import them.")
    return 1 if targets.unreadable else 0


if __name__ == "__main__":
    raise SystemExit(main())
