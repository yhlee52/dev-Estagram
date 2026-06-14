"""Directory-batch ingestion for the external_posts working tree (v0.3.2).

Drives the long-standing `data/external_posts/{incoming,archive,failed}` folder
convention: scan `incoming/` for packages, import each by reusing `run_import`,
then move the package to `archive/` (success) or `failed/` (failure). A simple
polling `--watch` loop repeats this on an interval (no external dependencies).

Scope notes:
- Only this `incoming/`-driven path moves files. The single-file CLI
  (`import_external_posts --input`) and HTTP import never move anything.
- `examples/` is never touched (golden samples are protected).
- dry_run has no side effects: no DB writes (run_import contract) and no moves.
- DB is the source of truth; the file move is best-effort bookkeeping. An import
  can succeed (batch recorded) while its move fails — the data is still correct.
- asset file managed-storage copy is out of scope here (v0.3.3).

Usage (from `feed-prototype/backend`, with DATABASE_URL set):

    python -m app.services.process_incoming                 # one pass
    python -m app.services.process_incoming --dry-run       # validate only
    python -m app.services.process_incoming --watch --interval 10
"""

from __future__ import annotations

import argparse
import shutil
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings
from app.services.import_external_posts import ImportErrorWithMessage, run_import


@dataclass
class Package:
    """One ingestible unit found in incoming/.

    `unit_path` is what gets moved (a `.json` file, or a directory containing
    `feed_posts.json`). `json_path` is the import input fed to run_import.
    """

    unit_path: Path
    json_path: Path


@dataclass
class PackageOutcome:
    name: str
    status: str  # success | failed | skipped | would-import | would-fail
    error: str | None = None
    moved_to: str | None = None


@dataclass
class ProcessResult:
    outcomes: list[PackageOutcome] = field(default_factory=list)

    def count(self, status: str) -> int:
        return sum(1 for outcome in self.outcomes if outcome.status == status)


def discover_packages(incoming_dir: Path) -> tuple[list[Package], list[Path]]:
    """Find package units directly under incoming/, plus non-package entries.

    A package is either a top-level `*.json` file or a subdirectory containing
    `feed_posts.json`. Anything else is returned as skipped. Order is by name
    for deterministic processing.
    """
    if not incoming_dir.exists():
        return [], []

    packages: list[Package] = []
    skipped: list[Path] = []
    for entry in sorted(incoming_dir.iterdir(), key=lambda path: path.name):
        if entry.is_file():
            if entry.suffix.lower() == ".json":
                packages.append(Package(unit_path=entry, json_path=entry))
            else:
                skipped.append(entry)
        elif entry.is_dir():
            feed_json = entry / "feed_posts.json"
            if feed_json.is_file():
                packages.append(Package(unit_path=entry, json_path=feed_json))
            else:
                skipped.append(entry)
    return packages, skipped


def _collision_safe_target(dest_dir: Path, name: str) -> Path:
    """Pick a destination path under dest_dir that does not overwrite anything."""
    target = dest_dir / name
    if not target.exists():
        return target

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stem = Path(name).stem if Path(name).suffix else name
    suffix = Path(name).suffix
    target = dest_dir / f"{stem}-{timestamp}{suffix}"
    while target.exists():
        target = dest_dir / f"{stem}-{timestamp}-{uuid4().hex[:6]}{suffix}"
    return target


def move_package(unit_path: Path, dest_dir: Path) -> Path:
    """Move a package unit into dest_dir without overwriting existing entries."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = _collision_safe_target(dest_dir, unit_path.name)
    shutil.move(str(unit_path), str(target))
    return target


def process_once(
    *,
    base_dir: Path,
    dry_run: bool,
    database_url: str | None = None,
) -> ProcessResult:
    """Process every package in incoming/ once. No printing (callers decide)."""
    incoming_dir = base_dir / "incoming"
    archive_dir = base_dir / "archive"
    failed_dir = base_dir / "failed"

    packages, skipped_entries = discover_packages(incoming_dir)
    result = ProcessResult()

    for package in packages:
        name = package.unit_path.name
        try:
            run_import(
                input_path=package.json_path,
                dry_run=dry_run,
                database_url=database_url,
                print_result=False,
            )
        except ImportErrorWithMessage as exc:
            result.outcomes.append(_handle_failure(package, failed_dir, str(exc), dry_run))
            continue
        except Exception as exc:  # noqa: BLE001 - one bad package must not stop the rest
            message = f"{type(exc).__name__}: {exc}"
            result.outcomes.append(_handle_failure(package, failed_dir, message, dry_run))
            continue

        if dry_run:
            result.outcomes.append(PackageOutcome(name=name, status="would-import"))
        else:
            result.outcomes.append(_move_outcome(package, archive_dir, "success"))

    for entry in skipped_entries:
        result.outcomes.append(
            PackageOutcome(
                name=entry.name,
                status="skipped",
                error="not a package (no .json file or feed_posts.json)",
            )
        )

    return result


def _handle_failure(
    package: Package,
    failed_dir: Path,
    message: str,
    dry_run: bool,
) -> PackageOutcome:
    if dry_run:
        return PackageOutcome(name=package.unit_path.name, status="would-fail", error=message)
    outcome = _move_outcome(package, failed_dir, "failed")
    outcome.error = message
    return outcome


def _move_outcome(package: Package, dest_dir: Path, status: str) -> PackageOutcome:
    """Move a processed package, keeping status even if the move fails.

    The DB is the source of truth: a successful import stays successful even if
    the best-effort file move fails. We just note the move error.
    """
    name = package.unit_path.name
    try:
        moved = move_package(package.unit_path, dest_dir)
        return PackageOutcome(name=name, status=status, moved_to=str(moved))
    except Exception as exc:  # noqa: BLE001 - move is best-effort bookkeeping
        return PackageOutcome(
            name=name,
            status=status,
            error=f"{status} but move to {dest_dir.name}/ failed: {type(exc).__name__}: {exc}",
        )


def print_process_result(result: ProcessResult, *, dry_run: bool) -> None:
    mode = "dry-run " if dry_run else ""
    print(f"process_incoming {mode}summary")
    print(f"- packages: {len(result.outcomes)}")
    if dry_run:
        print(f"- would import: {result.count('would-import')}")
        print(f"- would fail: {result.count('would-fail')}")
    else:
        print(f"- success: {result.count('success')}")
        print(f"- failed: {result.count('failed')}")
    print(f"- skipped: {result.count('skipped')}")
    for outcome in result.outcomes:
        line = f"  [{outcome.status}] {outcome.name}"
        if outcome.moved_to is not None:
            line += f" -> {outcome.moved_to}"
        if outcome.error is not None:
            line += f" ({outcome.error})"
        print(line)


def watch(
    *,
    base_dir: Path,
    interval: int,
    dry_run: bool,
    database_url: str | None = None,
) -> None:
    incoming_dir = base_dir / "incoming"
    print(f"Watching {incoming_dir} every {interval}s. Press Ctrl-C to stop.")
    try:
        while True:
            result = process_once(base_dir=base_dir, dry_run=dry_run, database_url=database_url)
            if result.outcomes:
                print_process_result(result, dry_run=dry_run)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nStopped watching.")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process external post packages dropped in incoming/ (v0.3.2)."
    )
    parser.add_argument(
        "--base-dir",
        default=None,
        help="external_posts root (default: settings.external_posts_dir). "
        "incoming/archive/failed are derived from this.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize without DB writes or file moves.",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Poll incoming/ on an interval instead of a single pass.",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=10,
        help="Polling interval in seconds for --watch (default: 10).",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional database URL override. Defaults to backend .env or DATABASE_URL.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    base_dir = Path(args.base_dir) if args.base_dir is not None else get_settings().external_posts_dir

    if args.watch:
        watch(
            base_dir=base_dir,
            interval=args.interval,
            dry_run=args.dry_run,
            database_url=args.database_url,
        )
        return 0

    result = process_once(
        base_dir=base_dir,
        dry_run=args.dry_run,
        database_url=args.database_url,
    )
    if not result.outcomes:
        print(f"No packages found in {base_dir / 'incoming'}")
        return 0
    print_process_result(result, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
