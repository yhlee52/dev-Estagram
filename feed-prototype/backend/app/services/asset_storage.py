"""Optional managed-storage copy for imported asset files (v0.3.3, opt-in).

Enabled by `Settings.manage_asset_storage`. When on, importing a package whose
asset `url` is a *relative local path* (not an already-served `/assets/...` URL
and not a remote `scheme://` URL) copies the referenced file — resolved relative
to the package directory — into the managed storage tree (already served by the
frontend) and rewrites the stored url to the managed url.

Stability contract (see `docs/V0_3_3_ASSET_STORAGE_SCOPE.md`):
- Already-served and remote urls are left untouched (format freeze / backward
  compat). No new package fields; the decision keys off the existing url string.
- Copy is best-effort: a missing source, a path escaping the package dir, or any
  copy error never fails the import — the original url is kept and a warning is
  logged.
- Destinations are deterministic, so re-importing the same asset overwrites
  rather than accumulating.
"""

from __future__ import annotations

import logging
import re
import shutil
from pathlib import Path

from app.core.config import Settings

logger = logging.getLogger(__name__)


def is_already_served_url(url: str) -> bool:
    """True if url is a browser URL we must leave untouched.

    Covers absolute browser paths (`/assets/...`, protocol-relative `//host/...`)
    and any remote scheme (`http://`, `https://`, ...). Relative local paths
    (`assets/foo.png`, `./foo.png`) return False and become copy candidates.
    """
    return url.startswith("/") or bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url))


def resolve_local_source(url: str, source_dir: Path) -> Path | None:
    """Resolve a relative local asset path against the package directory.

    Returns the file path when `url` is a relative local reference pointing at an
    existing file *inside* `source_dir`. Returns None (keep original url) for an
    already-served/remote URL, a path escaping the package dir, or a missing file.
    """
    if is_already_served_url(url):
        return None

    base = source_dir.resolve()
    candidate = (base / url).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        logger.warning("Asset source path escapes the package dir, skipping copy: %s", url)
        return None

    if not candidate.is_file():
        logger.warning("Asset source file not found, keeping original url: %s", url)
        return None

    return candidate


def _sanitize_segment(value: str) -> str:
    segment = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-._")
    return segment or "asset"


def copy_into_managed(
    source: Path,
    *,
    batch_external_id: str,
    asset_key: str,
    settings: Settings,
) -> str:
    """Copy `source` into managed storage and return the served url.

    Destination is `<managed_assets_dir>/<batch>/<asset_key><ext>`, derived
    deterministically so a re-import overwrites the same file. The source
    extension is preserved for correct mime handling in the browser.
    """
    batch_segment = _sanitize_segment(batch_external_id)
    key_segment = _sanitize_segment(asset_key)
    # Preserve the source extension, but avoid doubling it when the key already
    # carries one (e.g. when asset_key falls back to a url like "assets/img.svg").
    suffix = source.suffix
    if suffix and key_segment.lower().endswith(suffix.lower()):
        file_name = key_segment
    else:
        file_name = f"{key_segment}{suffix}"

    dest_dir = settings.managed_assets_dir / batch_segment
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest_dir / file_name)

    prefix = settings.managed_assets_url_prefix.rstrip("/")
    return f"{prefix}/{batch_segment}/{file_name}"


def managed_url_for_asset(
    *,
    url: str,
    external_id: str | None,
    batch_external_id: str,
    source_dir: Path,
    settings: Settings,
) -> str:
    """Return the url to store for one asset, copying into managed storage if it
    applies. Falls back to the original url for any non-applicable case or copy
    error (the import is never failed by managed-storage copy)."""
    source = resolve_local_source(url, source_dir)
    if source is None:
        return url

    # external_id is the stable key when present; otherwise the relative url keeps
    # distinct sources from colliding in managed storage.
    asset_key = external_id or url
    try:
        new_url = copy_into_managed(
            source,
            batch_external_id=batch_external_id,
            asset_key=asset_key,
            settings=settings,
        )
    except Exception as exc:  # noqa: BLE001 - copy is best-effort bookkeeping
        logger.warning("Managed asset copy failed, keeping original url %s: %s", url, exc)
        return url

    logger.info("Copied asset into managed storage: %s -> %s", source, new_url)
    return new_url
