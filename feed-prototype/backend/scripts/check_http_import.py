"""HTTP import regression check (v0.3.0 HTTP Import API).

Exercises `POST /api/imports` in-process via FastAPI TestClient:

1. Every enshrined golden sample under `data/external_posts/examples/` must
   pass an HTTP dry-run (status 200, no DB writes). This complements
   `check_golden_samples.py`, which covers the same logic through the CLI
   `run_import`. Since the route reuses `import_payload`, this asserts the HTTP
   layer (routing, body validation, transaction, response shape) does not drift.
2. A few HTTP-specific behaviors: schema-invalid body -> 422, payload-level
   semantic error (duplicate external_id) -> 400.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_http_import

Runs only dry-runs and rejected requests, so it never writes to the DB.
Exit code is non-zero if any check fails. Token protection (X-Import-Token) is
config-dependent and verified manually; see V0_3_0_HTTP_IMPORT_SCOPE.md.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


BACKEND_DIR = Path(__file__).resolve().parents[1]
EXAMPLES_DIR = BACKEND_DIR.parent / "data" / "external_posts" / "examples"


def discover_golden_samples() -> list[Path]:
    samples = sorted(EXAMPLES_DIR.rglob("feed_posts.json"))
    top_level = EXAMPLES_DIR / "feed_import_sample.json"
    if top_level.exists():
        samples.append(top_level)
    return samples


def check_golden_dry_runs(client: TestClient) -> list[str]:
    failures: list[str] = []
    samples = discover_golden_samples()
    if not samples:
        return [f"No golden sample packages found under {EXAMPLES_DIR}"]

    for sample in samples:
        rel = sample.relative_to(EXAMPLES_DIR.parent)
        print(f"\n=== HTTP dry-run: {rel} ===")
        payload = json.loads(sample.read_text(encoding="utf-8"))
        response = client.post("/api/imports?dry_run=true", json=payload)
        if response.status_code != 200:
            failures.append(f"{rel}: expected 200, got {response.status_code} {response.text}")
            print(f"FAILED: {rel} -> {response.status_code}", file=sys.stderr)
            continue
        body = response.json()
        if body.get("dry_run") is not True:
            failures.append(f"{rel}: response dry_run was not true: {body}")
        print(
            f"OK: {rel} -> posts create {body.get('posts_created')}, "
            f"update {body.get('posts_updated')}"
        )
    return failures


def check_http_behaviors(client: TestClient) -> list[str]:
    failures: list[str] = []

    # Schema-invalid body (missing required batch) -> 422 from FastAPI.
    print("\n=== HTTP behavior: schema-invalid body -> 422 ===")
    response = client.post("/api/imports?dry_run=true", json={"posts": []})
    if response.status_code != 422:
        failures.append(f"invalid body: expected 422, got {response.status_code} {response.text}")
        print(f"FAILED: expected 422, got {response.status_code}", file=sys.stderr)
    else:
        print("OK: 422")

    # Payload-level semantic error (duplicate post.external_id) -> 400.
    print("\n=== HTTP behavior: duplicate external_id -> 400 ===")
    duplicate_payload = {
        "batch": {"external_id": "regression-duplicate-check"},
        "accounts": [
            {
                "external_id": "acct-dup",
                "handle": "dup",
                "display_name": "Dup Account",
            }
        ],
        "posts": [
            {
                "external_id": "post-dup",
                "account_external_id": "acct-dup",
                "title": "First",
            },
            {
                "external_id": "post-dup",
                "account_external_id": "acct-dup",
                "title": "Second",
            },
        ],
    }
    response = client.post("/api/imports?dry_run=true", json=duplicate_payload)
    if response.status_code != 400:
        failures.append(f"duplicate id: expected 400, got {response.status_code} {response.text}")
        print(f"FAILED: expected 400, got {response.status_code}", file=sys.stderr)
    else:
        print("OK: 400")

    return failures


def main() -> int:
    with TestClient(app) as client:
        failures = check_golden_dry_runs(client)
        failures += check_http_behaviors(client)

    if failures:
        print("\nHTTP import check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nHTTP import check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
