"""Golden sample regression check (v0.1.0 Read at Scale).

Runs `--dry-run` import over every enshrined external post package under
`data/external_posts/examples/`. These packages are real generated-format
samples kept in the repo as a regression net: if the import code or the frozen
external package format ever drifts, this check fails before release.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_golden_samples

Exit code is non-zero if any golden sample fails its dry-run.
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.services.import_external_posts import ImportErrorWithMessage, run_import


BACKEND_DIR = Path(__file__).resolve().parents[1]
EXAMPLES_DIR = BACKEND_DIR.parent / "data" / "external_posts" / "examples"


def discover_golden_samples() -> list[Path]:
    """Every example package JSON is treated as a golden sample."""
    samples = sorted(EXAMPLES_DIR.rglob("feed_posts.json"))
    top_level = EXAMPLES_DIR / "feed_import_sample.json"
    if top_level.exists():
        samples.append(top_level)
    return samples


def main() -> int:
    samples = discover_golden_samples()
    if not samples:
        print(f"No golden sample packages found under {EXAMPLES_DIR}", file=sys.stderr)
        return 1

    failures: list[tuple[Path, str]] = []
    for sample in samples:
        rel = sample.relative_to(EXAMPLES_DIR.parent)
        print(f"\n=== dry-run: {rel} ===")
        try:
            run_import(input_path=sample, dry_run=True)
        except ImportErrorWithMessage as exc:
            failures.append((sample, str(exc)))
            print(f"FAILED: {rel}\n{exc}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001 - surface any unexpected failure
            failures.append((sample, f"{type(exc).__name__}: {exc}"))
            print(f"FAILED: {rel}\n{type(exc).__name__}: {exc}", file=sys.stderr)

    print(f"\nGolden sample dry-run: {len(samples) - len(failures)}/{len(samples)} passed")
    if failures:
        print("Failed samples:", file=sys.stderr)
        for sample, message in failures:
            print(f"- {sample.relative_to(EXAMPLES_DIR.parent)}: {message}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
