"""Managed asset storage copy regression check (v0.3.3).

Exercises `app.services.asset_storage` through the import path against a real DB,
toggling `Settings.manage_asset_storage` via the environment and pointing
`managed_assets_dir` at a throwaway temp dir each scenario. Cleans up the DB rows
it creates (unique ids) and restores the environment.

Covers:
1. toggle ON + relative local asset -> file copied into managed dir, DB url
   rewritten to `<prefix>/...`; re-import overwrites (no accumulation).
2. toggle ON + already-served (`/assets/...`) and remote (`http(s)://`) urls ->
   not copied, url unchanged.
3. toggle OFF + relative local asset -> not copied, relative url stored as-is.
4. dry-run + toggle ON -> no file written, no DB rows.
5. missing source / path escaping the package dir -> import still succeeds, the
   original url is kept (copy is best-effort).
6. HTTP path (asset_source_dir=None) + toggle ON -> not copied.

Usage (from `feed-prototype/backend`, with DATABASE_URL pointing at a dev/test DB):

    python -m scripts.check_managed_asset_copy

This WRITES to the DB and then deletes the rows it created. Exit code is non-zero
if any check fails.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from pathlib import Path
from uuid import uuid4

from sqlmodel import select

from app.core.config import get_settings
from app.db.session import create_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.models.user import User
from app.services.import_external_posts import (
    generated_user_id,
    import_payload,
    load_payload,
    run_import,
)


SUFFIX = uuid4().hex[:8]
SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'

ACCT_EXT = f"check-mac-acct-{SUFFIX}"
POSTS = {key: f"check-mac-post-{key}-{SUFFIX}" for key in
         ("local", "served", "off", "dry", "fallback", "http")}
BATCHES = {key: f"check-mac-batch-{key}-{SUFFIX}" for key in POSTS}


def _seg(value: str) -> str:
    """Mirror asset_storage._sanitize_segment for expected-url assertions."""
    segment = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-._")
    return segment or "asset"


def configure(*, manage: bool, managed_dir: Path) -> None:
    """Point settings at a temp managed dir and (re)set the toggle."""
    os.environ["MANAGE_ASSET_STORAGE"] = "true" if manage else "false"
    os.environ["MANAGED_ASSETS_DIR"] = str(managed_dir)
    get_settings.cache_clear()


def restore_env() -> None:
    os.environ.pop("MANAGE_ASSET_STORAGE", None)
    os.environ.pop("MANAGED_ASSETS_DIR", None)
    get_settings.cache_clear()


def write_package(
    pkg_dir: Path,
    *,
    batch: str,
    post: str,
    assets: list[dict],
    asset_files: dict[str, str] | None = None,
) -> Path:
    data = {
        "batch": {"external_id": batch, "source": "check_managed_asset_copy"},
        "accounts": [
            {
                "external_id": ACCT_EXT,
                "handle": f"checkmac{SUFFIX}",
                "display_name": "Check managed asset copy",
            }
        ],
        "posts": [
            {
                "external_id": post,
                "account_external_id": ACCT_EXT,
                "title": "Managed copy check",
                "text": "regression",
                "assets": assets,
            }
        ],
    }
    pkg_dir.mkdir(parents=True, exist_ok=True)
    feed_json = pkg_dir / "feed_posts.json"
    feed_json.write_text(json.dumps(data), encoding="utf-8")
    for rel, content in (asset_files or {}).items():
        target = pkg_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return feed_json


def stored_asset_urls(post_external_id: str) -> list[str]:
    with create_session() as session:
        post = session.exec(
            select(Post).where(Post.external_id == post_external_id)
        ).first()
        if post is None:
            return []
        assets = session.exec(
            select(PostAsset).where(PostAsset.post_id == post.id)
        ).all()
        return [asset.url for asset in assets]


def managed_files(managed_dir: Path) -> list[Path]:
    return [path for path in managed_dir.rglob("*") if path.is_file()]


def run_checks() -> list[str]:
    failures: list[str] = []

    def check(condition: bool, message: str) -> None:
        if condition:
            print(f"OK: {message}")
        else:
            failures.append(message)
            print(f"FAILED: {message}", file=sys.stderr)

    # 1) toggle ON + relative local asset -> copied + url rewritten; re-import
    #    overwrites (no accumulation).
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        managed = root / "managed"
        configure(manage=True, managed_dir=managed)
        feed_json = write_package(
            root / "pkg",
            batch=BATCHES["local"],
            post=POSTS["local"],
            assets=[
                {
                    "external_id": f"asset-local-{SUFFIX}",
                    "type": "image",
                    "url": "assets/img.svg",
                    "sort_order": 1,
                }
            ],
            asset_files={"assets/img.svg": SVG},
        )
        run_import(input_path=feed_json, dry_run=False, print_result=False)

        urls = stored_asset_urls(POSTS["local"])
        expected = (
            f"/assets/managed/{_seg(BATCHES['local'])}/asset-local-{SUFFIX}.svg"
        )
        check(urls == [expected],
              "relative local asset url rewritten to deterministic /assets/managed/...")
        files_after_first = managed_files(managed)
        check(len(files_after_first) == 1, "exactly one file copied into managed dir")

        # Re-import the same package: deterministic destination overwrites.
        run_import(input_path=feed_json, dry_run=False, print_result=False)
        files_after_second = managed_files(managed)
        check(len(files_after_second) == 1, "re-import overwrites (no accumulation)")
        check(stored_asset_urls(POSTS["local"]) == urls, "re-import keeps the same url")

    # 2) toggle ON + already-served / remote urls -> untouched.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        managed = root / "managed"
        configure(manage=True, managed_dir=managed)
        feed_json = write_package(
            root / "pkg",
            batch=BATCHES["served"],
            post=POSTS["served"],
            assets=[
                {"type": "image", "url": "/assets/generated/x.png", "sort_order": 1},
                {"type": "image", "url": "https://example.com/y.png", "sort_order": 2},
            ],
        )
        run_import(input_path=feed_json, dry_run=False, print_result=False)
        urls = set(stored_asset_urls(POSTS["served"]))
        check(
            urls == {"/assets/generated/x.png", "https://example.com/y.png"},
            "served /assets/... and remote http(s):// urls left unchanged",
        )
        check(managed_files(managed) == [], "no file copied for served/remote urls")

    # 3) toggle OFF + relative local asset -> stored as-is.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        managed = root / "managed"
        configure(manage=False, managed_dir=managed)
        feed_json = write_package(
            root / "pkg",
            batch=BATCHES["off"],
            post=POSTS["off"],
            assets=[{"type": "image", "url": "assets/img.svg", "sort_order": 1}],
            asset_files={"assets/img.svg": SVG},
        )
        run_import(input_path=feed_json, dry_run=False, print_result=False)
        check(stored_asset_urls(POSTS["off"]) == ["assets/img.svg"],
              "toggle OFF leaves the relative url unchanged")
        check(managed_files(managed) == [], "toggle OFF copies nothing")

    # 4) dry-run + toggle ON -> nothing written.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        managed = root / "managed"
        configure(manage=True, managed_dir=managed)
        feed_json = write_package(
            root / "pkg",
            batch=BATCHES["dry"],
            post=POSTS["dry"],
            assets=[{"type": "image", "url": "assets/img.svg", "sort_order": 1}],
            asset_files={"assets/img.svg": SVG},
        )
        run_import(input_path=feed_json, dry_run=True, print_result=False)
        check(stored_asset_urls(POSTS["dry"]) == [], "dry-run writes no post/asset rows")
        check(managed_files(managed) == [], "dry-run copies no file even with toggle ON")

    # 5) missing source / path escape -> import succeeds, original url kept.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        managed = root / "managed"
        configure(manage=True, managed_dir=managed)
        feed_json = write_package(
            root / "pkg",
            batch=BATCHES["fallback"],
            post=POSTS["fallback"],
            assets=[
                {"type": "image", "url": "assets/missing.svg", "sort_order": 1},
                {"type": "image", "url": "../escape.svg", "sort_order": 2},
            ],
        )
        # Place a file outside the package dir to prove the escape is refused.
        (root / "escape.svg").write_text(SVG, encoding="utf-8")
        run_import(input_path=feed_json, dry_run=False, print_result=False)
        urls = set(stored_asset_urls(POSTS["fallback"]))
        check(urls == {"assets/missing.svg", "../escape.svg"},
              "missing source and escaping path keep their original url")
        check(managed_files(managed) == [], "no file copied for missing/escaping sources")

    # 6) HTTP path (asset_source_dir=None) + toggle ON -> not copied.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        managed = root / "managed"
        configure(manage=True, managed_dir=managed)
        feed_json = write_package(
            root / "pkg",
            batch=BATCHES["http"],
            post=POSTS["http"],
            assets=[{"type": "image", "url": "assets/img.svg", "sort_order": 1}],
            asset_files={"assets/img.svg": SVG},
        )
        payload = load_payload(feed_json)
        with create_session() as session:
            import_payload(session, payload, dry_run=False, asset_source_dir=None)
            session.commit()
        check(stored_asset_urls(POSTS["http"]) == ["assets/img.svg"],
              "HTTP path (asset_source_dir=None) does not copy")
        check(managed_files(managed) == [], "HTTP path copies no file")

    return failures


def cleanup() -> None:
    """Delete everything the check created (best-effort)."""
    with create_session() as session:
        for external_id in POSTS.values():
            for post in session.exec(
                select(Post).where(Post.external_id == external_id)
            ).all():
                for asset in session.exec(
                    select(PostAsset).where(PostAsset.post_id == post.id)
                ).all():
                    session.delete(asset)
                session.delete(post)

        account = session.exec(
            select(Account).where(Account.external_id == ACCT_EXT)
        ).first()
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
        restore_env()

    if failures:
        print("\nmanaged asset copy check FAILED:", file=sys.stderr)
        for message in failures:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("\nmanaged asset copy check: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
