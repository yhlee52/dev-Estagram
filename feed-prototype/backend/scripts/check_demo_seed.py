"""Validate the local personas in the disposable profile regression database."""

import os
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlmodel import select

from app.db.session import create_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.auth import UserCredential
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.like import PostLike
from app.models.message import DirectMessage
from app.models.post import Post
from app.models.profile_pin import ProfilePin
from app.models.user import User
from app.services.auth import set_user_password, verify_password
from app.services.seed import ACCOUNTS, ASSETS, POSTS, USERS, seed_database


def main() -> None:
    database_url = os.environ.get("PROFILE_UX_TEST_DATABASE_URL", "")
    if not (make_url(database_url).database or "").startswith("feed_profile_check_"):
        raise RuntimeError("Demo seed check requires an isolated profile regression database")

    first = seed_database()
    assert first["users"] == len(USERS) and first["accounts"] == len(ACCOUNTS)
    assert first["posts"] == len(POSTS) and first["post_assets"] == len(ASSETS)
    assert first["profile_pins"] == 5
    assert first["comments"] == 3 and first["post_likes"] == 3
    assert first["bookmarks"] == 2 and first["direct_messages"] == 2

    public_dir = Path(__file__).resolve().parents[2] / "public"
    with create_session() as session:
        for account in session.exec(select(Account).where(Account.id.in_([a["id"] for a in ACCOUNTS]))):
            assert account.cover_url and (public_dir / account.cover_url.lstrip("/")).is_file()
            assert account.profile_links
        for asset in session.exec(select(PostAsset).where(PostAsset.id.in_([a["id"] for a in ASSETS]))):
            if asset.url and asset.url.startswith("/assets/"):
                assert (public_dir / asset.url.lstrip("/")).is_file(), asset.url
        assert session.exec(select(ProfilePin)).all()
        assert session.exec(select(Comment)).all()
        assert session.exec(select(PostLike)).all()
        assert session.exec(select(Bookmark)).all()
        assert session.exec(select(DirectMessage)).all()
        ari = session.get(Account, "demo-account-ari")
        ari.bio = "내가 고친 소개"
        session.add(ari)
        walk = session.get(Post, "demo-post-morning-walk")
        original_created_at = walk.created_at
        walk.title = "내가 고친 제목"
        session.add(walk)
        pin = session.exec(select(ProfilePin).where(ProfilePin.account_id == ari.id)).first()
        session.delete(pin)
        set_user_password(session, "demo-user-ari", "changed-password")
        session.commit()

    second = seed_database()
    assert second["refreshed"] == 0 and second["profile_pins"] == 0
    with create_session() as session:
        assert session.get(Account, "demo-account-ari").bio == "내가 고친 소개"
        assert session.get(Post, "demo-post-morning-walk").title == "내가 고친 제목"
        assert len(session.exec(select(ProfilePin).where(ProfilePin.account_id == "demo-account-ari")).all()) == 1

    refreshed = seed_database(refresh_demo=True)
    assert refreshed["refreshed"] >= 2 and refreshed["profile_pins"] == 5
    with create_session() as session:
        assert session.get(Account, "demo-account-ari").bio == ACCOUNTS[0]["bio"]
        walk = session.get(Post, "demo-post-morning-walk")
        assert walk.title == POSTS[0]["title"] and walk.created_at == original_created_at
        assert verify_password("changed-password", session.get(UserCredential, "demo-user-ari").password_hash)
        assert session.get(User, "demo-user-ari").handle == "ari"
        assert len(session.exec(select(ProfilePin).where(ProfilePin.account_id == "demo-account-ari")).all()) == 2
    print("Demo seed regression passed")


if __name__ == "__main__":
    main()
