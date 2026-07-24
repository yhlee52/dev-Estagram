"""Asset URL serialization check (v1.2.4).

Verifies that S3-backed assets serialize to the absolute proxy URL while local /
remote-url assets are left untouched. Pure — no DB, no MinIO, no boto3 (a
`base_url` is injected so `get_settings()` is not needed).

Usage (from feed-prototype/backend):

    python -m scripts.check_asset_url
"""

from __future__ import annotations

from app.models.asset import PostAsset
from app.services.asset_url import s3_asset_proxy_url, serialize_asset


BASE = "http://127.0.0.1:8000"


def check_proxy_url_pure() -> None:
    assert (
        s3_asset_proxy_url(asset_id="a1", storage_backend="s3", object_key="k/x.png", base_url=BASE)
        == "http://127.0.0.1:8000/api/assets/a1"
    )
    # trailing slash on base is normalized
    assert (
        s3_asset_proxy_url(asset_id="a1", storage_backend="s3", object_key="k/x.png", base_url=BASE + "/")
        == "http://127.0.0.1:8000/api/assets/a1"
    )
    # not object-storage backed -> None
    assert s3_asset_proxy_url(asset_id="a1", storage_backend=None, object_key=None, base_url=BASE) is None
    assert s3_asset_proxy_url(asset_id="a1", storage_backend="s3", object_key=None, base_url=BASE) is None
    assert s3_asset_proxy_url(asset_id="a1", storage_backend="filesystem", object_key="k", base_url=BASE) is None


def check_serialize_s3_asset() -> None:
    asset = PostAsset(
        id="asset-1",
        post_id="post-1",
        type="table",
        src="estagram/batches/b/assets/summary.csv",  # placeholder object key from v1.2.1
        url=None,
        storage_backend="s3",
        object_key="estagram/batches/b/assets/summary.csv",
    )
    read = serialize_asset(asset, base_url=BASE)
    assert read.url == "http://127.0.0.1:8000/api/assets/asset-1"
    assert read.src == "http://127.0.0.1:8000/api/assets/asset-1"
    # identity fields are not leaked into the read model
    assert not hasattr(read, "object_key")


def check_serialize_non_s3_asset_untouched() -> None:
    asset = PostAsset(
        id="asset-2",
        post_id="post-1",
        type="image",
        src="/assets/generated/x.png",
        url="/assets/generated/x.png",
    )
    read = serialize_asset(asset, base_url=BASE)
    assert read.url == "/assets/generated/x.png"
    assert read.src == "/assets/generated/x.png"

    remote = PostAsset(id="asset-3", post_id="post-1", type="link", src="https://x/y", url="https://x/y")
    read = serialize_asset(remote, base_url=BASE)
    assert read.url == "https://x/y"


CHECKS = [
    ("s3_asset_proxy_url pure", check_proxy_url_pure),
    ("serialize s3 asset -> proxy url", check_serialize_s3_asset),
    ("serialize non-s3 asset untouched", check_serialize_non_s3_asset_untouched),
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
    print(f"\ncheck_asset_url: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
