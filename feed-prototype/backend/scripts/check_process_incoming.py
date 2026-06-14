"""Directory-batch ingestion regression check (v0.3.2).

Exercises `app.services.process_incoming` end-to-end against a real DB using a
throwaway external_posts tree (temp incoming/archive/failed), then deletes
everything it created. Complements the dry-run-only `check_golden_samples.py`
and `check_http_import.py`, and the HTTP-path `check_batch_history.py`.

Covers:
1. a valid single-file package is imported and moved incoming/ -> archive/
   (batch status success).
2. a directory-form package (feed_posts.json + assets/) is handled the same way.
3. a failing package (duplicate external_id) is moved to failed/ and recorded as
   a failed batch, while a valid package in the same pass still succeeds.
4. dry-run changes nothing: no DB rows, package stays in incoming/.
5. a name collision in archive/ does not overwrite (timestamp-suffixed move).
6. non-package entries (stray file, dir without feed_posts.json) are skipped and
   left in place.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_process_incoming

This WRITES to the DB and then deletes the rows it created (unique ids). Exit
code is non-zero if any check fails.
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from uuid import uuid4

from sqlmodel import select

from app.db.session import create_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import generated_user_id
from app.services.process_incoming import process_once


SUFFIX = uuid4().hex[:8]

# External ids this check creates (tracked for cleanup).
ACCT_EXT = f"check-pi-acct-{SUFFIX}"
POSTS = {
    "single": f"check-pi-post-single-{SUFFIX}",
    "dir": f"check-pi-post-dir-{SUFFIX}",
    "fail": f"check-pi-post-fail-{SUFFIX}",
    "ok_with_fail": f"check-pi-post-okwf-{SUFFIX}",
    "dry": f"check-pi-post-dry-{SUFFIX}",
    "collide": f"check-pi-post-collide-{SUFFIX}",
}
BATCHES = {
    "single": f"check-pi-batch-single-{SUFFIX}",
    "dir": f"check-pi-batch-dir-{SUFFIX}",
    "fail": f"check-pi-batch-fail-{SUFFIX}",
    "ok_with_fail": f"check-pi-batch-okwf-{SUFFIX}",
    "dry": f"check-pi-batch-dry-{SUFFIX}",
    "collide": f"check-pi-batch-collide-{SUFFIX}",
}


def payload(*, batch_external_id: str, post_external_id: str, duplicate: bool = False) -> dict:
    posts = [
        {
            "external_id": post_external_id,
            "account_external_id": ACCT_EXT,
            "title": "Check process_incoming post",
            "text": "regression",
        }
    ]
    if duplicate:
        # Duplicate post.external_id -> ImportErrorWithMessage at import time.
        posts.append(dict(posts[0], title="Duplicate"))
    return {
        "batch": {"external_id": batch_external_id, "source": "check_process_incoming"},
        "accounts": [
            {
                "external_id": ACCT_EXT,
                "handle": f"checkpi{SUFFIX}",
                "display_name": "Check process_incoming",
            }
        ],
        "posts": posts,
    }


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def make_tree(root: Path) -> dict[str, Path]:
    dirs = {name: root / name for name in ("incoming", "archive", "failed")}
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def batch_status(external_id: str) -> str | None:
    with create_session() as session:
        batch = session.exec(
            select(ImportBatch).where(ImportBatch.external_id == external_id)
        ).first()
        return batch.status if batch is not None else None


def post_exists(external_id: str) -> bool:
    with create_session() as session:
        return (
            session.exec(select(Post).where(Post.external_id == external_id)).first()
            is not None
        )


def run_checks() -> list[str]:
    failures: list[str] = []

    def check(condition: bool, message: str) -> None:
        if condition:
            print(f"OK: {message}")
        else:
            failures.append(message)
            print(f"FAILED: {message}", file=sys.stderr)

    # 1) valid single-file package -> imported, moved to archive/.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dirs = make_tree(root)
        pkg = dirs["incoming"] / "single.json"
        write_json(pkg, payload(batch_external_id=BATCHES["single"], post_external_id=POSTS["single"]))

        result = process_once(base_dir=root, dry_run=False)
        check(result.count("success") == 1, "single-file package reported success")
        check(not pkg.exists(), "single-file package left incoming/")
        check(any(dirs["archive"].iterdir()), "single-file package moved into archive/")
        check(post_exists(POSTS["single"]), "single-file package post is in the DB")
        check(batch_status(BATCHES["single"]) == "success", "single-file batch status is success")

    # 2) directory-form package (feed_posts.json) -> handled the same way.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dirs = make_tree(root)
        pkg_dir = dirs["incoming"] / "dirpkg"
        write_json(pkg_dir / "feed_posts.json", payload(batch_external_id=BATCHES["dir"], post_external_id=POSTS["dir"]))
        (pkg_dir / "assets").mkdir(parents=True, exist_ok=True)

        result = process_once(base_dir=root, dry_run=False)
        check(result.count("success") == 1, "directory package reported success")
        check(not pkg_dir.exists(), "directory package left incoming/")
        check((dirs["archive"] / "dirpkg").exists(), "directory package moved into archive/")
        check(batch_status(BATCHES["dir"]) == "success", "directory batch status is success")

    # 3) failing package -> failed/, while a valid one in the same pass succeeds.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dirs = make_tree(root)
        bad = dirs["incoming"] / "bad.json"
        good = dirs["incoming"] / "good.json"
        write_json(bad, payload(batch_external_id=BATCHES["fail"], post_external_id=POSTS["fail"], duplicate=True))
        write_json(good, payload(batch_external_id=BATCHES["ok_with_fail"], post_external_id=POSTS["ok_with_fail"]))

        result = process_once(base_dir=root, dry_run=False)
        check(result.count("failed") == 1, "failing package reported failed")
        check(result.count("success") == 1, "valid package in same pass still succeeded")
        check(not bad.exists() and any(dirs["failed"].iterdir()), "failing package moved into failed/")
        check(not good.exists(), "valid package left incoming/")
        check(batch_status(BATCHES["fail"]) == "failed", "failing batch status is failed")
        check(not post_exists(POSTS["fail"]), "failing package wrote no post (rolled back)")
        check(post_exists(POSTS["ok_with_fail"]), "valid package post is in the DB")

    # 4) dry-run changes nothing.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dirs = make_tree(root)
        pkg = dirs["incoming"] / "dry.json"
        write_json(pkg, payload(batch_external_id=BATCHES["dry"], post_external_id=POSTS["dry"]))

        result = process_once(base_dir=root, dry_run=True)
        check(result.count("would-import") == 1, "dry-run reports would-import")
        check(pkg.exists(), "dry-run leaves package in incoming/")
        check(not any(dirs["archive"].iterdir()), "dry-run moves nothing to archive/")
        check(batch_status(BATCHES["dry"]) is None, "dry-run writes no batch row")
        check(not post_exists(POSTS["dry"]), "dry-run writes no post")

    # 5) name collision in archive/ does not overwrite.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dirs = make_tree(root)
        pkg = dirs["incoming"] / "collide.json"
        write_json(pkg, payload(batch_external_id=BATCHES["collide"], post_external_id=POSTS["collide"]))
        decoy = dirs["archive"] / "collide.json"
        decoy.write_text("existing", encoding="utf-8")

        result = process_once(base_dir=root, dry_run=False)
        check(result.count("success") == 1, "colliding package still imported")
        check(decoy.read_text(encoding="utf-8") == "existing", "existing archive file not overwritten")
        check(
            len(list(dirs["archive"].iterdir())) == 2,
            "colliding package moved alongside existing (timestamp-suffixed)",
        )

    # 6) non-package entries are skipped and left in place.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dirs = make_tree(root)
        stray = dirs["incoming"] / "notes.txt"
        stray.write_text("not a package", encoding="utf-8")
        empty_dir = dirs["incoming"] / "emptydir"
        empty_dir.mkdir()

        result = process_once(base_dir=root, dry_run=False)
        check(result.count("skipped") == 2, "stray file and dir-without-feed_posts skipped")
        check(stray.exists() and empty_dir.exists(), "skipped entries left in incoming/")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for external_id in POSTS.values():
            for post in session.exec(select(Post).where(Post.external_id == external_id)).all():
                for asset in session.exec(
                    select(PostAsset).where(PostAsset.post_id == post.id)
                ).all():
                    session.delete(asset)
                session.delete(post)

        account = session.exec(select(Account).where(Account.external_id == ACCT_EXT)).first()
        if account is not None:
            session.delete(account)

        user = session.get(User, generated_user_id(ACCT_EXT))
        if user is not None:
            session.delete(user)

        for external_id in BATCHES.values():
            batch = session.exec(
                select(ImportBatch).where(ImportBatch.external_id == external_id)
            ).first()
            if batch is not None:
                session.delete(batch)

        session.commit()


def main() -> int:
    try:
        failures = run_checks()
    finally:
        cleanup()

    if failures:
        print("\nprocess_incoming check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nprocess_incoming check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
