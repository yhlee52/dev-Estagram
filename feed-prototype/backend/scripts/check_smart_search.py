"""Smart post search regression; only runs in a disposable profile-check DB."""

import os
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url
from sqlmodel import select

from app.db.session import create_session
from app.main import app
from app.models.post import Post
from app.models.account import Account
from app.models.comment import Comment
from app.models.post_account_ref import PostAccountRef
from app.services.mentions import find_mentioned_handles
from app.services.post_account_refs import sync_post_mentions
from app.services.post_filters import PostFilters, apply_filters_to_select
from app.services.seed import seed_database
from app.schemas.external_import import ExternalImportPayload
from app.services.import_external_posts import import_payload


def main() -> None:
    url = os.environ.get("PROFILE_UX_TEST_DATABASE_URL", "")
    if not (make_url(url).database or "").startswith("feed_profile_check_"):
        raise RuntimeError("Smart search checks require a disposable database")
    seed_database()
    with create_session() as session:
        refs = [(ref.post_id, ref.account_id, ref.kind) for ref in session.exec(select(PostAccountRef)).all()]
    assert ("demo-post-weekly-chart", "demo-account-ari", "mention") in refs, refs
    with create_session() as session:
        statement, _ = apply_filters_to_select(session, select(Post), PostFilters(people=(("demo-account-ari", "related"),)))
        direct_ids = {post.id for post in session.exec(statement).all()}
    assert "demo-post-weekly-chart" in direct_ids, sorted(direct_ids)
    assert find_mentioned_handles("@ann @anna @anna.notes x@ann.com 한글@ann @mika.project의") == {"ann", "anna", "anna.notes", "mika.project"}
    client = TestClient(app)
    related = client.get("/api/posts", params={"person": "related:demo-account-ari"})
    assert related.status_code == 200, related.text
    ids = {item["id"] for item in related.json()["items"]}
    assert "demo-post-morning-walk" in ids and "demo-post-weekly-chart" in ids, sorted(ids)
    authored = client.get("/api/posts", params={"person": "authored:demo-account-ari"}).json()["items"]
    assert all(item["account_id"] == "demo-account-ari" for item in authored)
    mention = client.get("/api/posts", params={"person": "mentioned_tagged:demo-account-ari"}).json()["items"]
    assert "demo-post-weekly-chart" in {item["id"] for item in mention}
    assert "demo-post-morning-walk" not in {item["id"] for item in mention}
    assert client.get("/api/posts", params={"place": "동네 공원"}).json()["items"][0]["id"] == "demo-post-morning-walk"
    assert client.get("/api/places", params={"prefix": "동네"}).json()["items"]
    assert client.get("/api/tags", params={"prefix": "산"}).json()["items"][0]["tag"] == "산책"
    assert client.get("/api/posts", params={"scope": "feed"}).status_code == 401
    assert client.get("/api/posts", params={"bookmarked_only": "true", "user_id": "demo-user-ari"}).status_code == 401
    assert client.get("/api/posts", params=[("tag", "산책"), ("tag", "산책")]).status_code == 400
    assert client.get("/api/posts", params={"person": "related:no-such-account"}).status_code == 400
    assert client.post("/api/posts", json={"title": "로그인 전", "text": ""}).status_code == 401

    with create_session() as session:
        session.add(Post(id="comment-only", account_id="demo-account-mika", title="댓글에만 등장", text="평문 아리", created_at=datetime.now(timezone.utc)))
        session.flush()
        session.add(Comment(id="comment-only-mention", post_id="comment-only", author_user_id="demo-user-mika", text="@ari.notes", created_at=datetime.now(timezone.utc)))
        session.commit()
    assert "comment-only" not in {item["id"] for item in client.get("/api/posts", params={"person": "related:demo-account-ari"}).json()["items"]}

    now = datetime.now(timezone.utc)
    with create_session() as session:
        for index in range(30):
            session.add(Post(id=f"search-no-{index}", account_id="demo-account-mika", title="다른 글", text="해당 없음", created_at=now + timedelta(minutes=index)))
        for index in range(25):
            post = Post(id=f"search-yes-{index}", account_id="demo-account-mika", title="관련 글", text="@ari.notes 확인해 주세요", created_at=now - timedelta(minutes=index + 1))
            session.add(post)
            session.flush()
            sync_post_mentions(session, post)
        session.commit()
    first = client.get("/api/posts", params={"person": "mentioned_tagged:demo-account-ari", "limit": 20})
    assert first.status_code == 200, first.text
    page = first.json()
    assert len(page["items"]) == 20 and page["has_more"] and page["next_cursor"]
    assert len({item["id"] for item in page["items"]}) == 20
    second = client.get("/api/posts", params={"person": "mentioned_tagged:demo-account-ari", "limit": 20, "cursor": page["next_cursor"]})
    assert second.status_code == 200
    assert not ({item["id"] for item in page["items"]} & {item["id"] for item in second.json()["items"]})

    assert client.post("/api/auth/login", json={"login": "mika", "password": "mika"}).status_code == 200
    assert client.get("/api/posts", params={"scope": "feed"}).status_code == 200
    assert client.get("/api/posts", params={"bookmarked_only": "true", "user_id": "demo-user-ari"}).status_code == 403
    assert client.patch("/api/posts/demo-post-morning-walk", json={"tagged_account_ids": ["demo-account-mika"]}).status_code == 403
    assert client.post("/api/posts", json={"title": "중복", "tagged_account_ids": ["demo-account-ari", "demo-account-ari"]}).status_code == 422
    assert client.post("/api/posts", json={"title": "없는 계정", "tagged_account_ids": ["missing"]}).status_code == 422
    created = client.post("/api/posts", json={"title": "아리 태그", "text": "@ari.notes와 함께", "tags": ["여행", "사진"], "metadata_json": {"location": "서울숲"}, "tagged_account_ids": ["demo-account-ari"]})
    assert created.status_code == 201, created.text
    post_id = created.json()["post"]["id"]
    mixed = client.get("/api/posts", params=[("person", "related:demo-account-ari"), ("tag", "여행"), ("place", "서울숲")])
    assert mixed.status_code == 200 and {item["id"] for item in mixed.json()["items"]} == {post_id}
    both = client.get("/api/posts", params=[("person", "related:demo-account-ari"), ("person", "authored:demo-account-mika"), ("tag", "여행"), ("tag", "사진"), ("place", "서울숲"), ("keyword", "아리")])
    assert both.status_code == 200 and {item["id"] for item in both.json()["items"]} == {post_id}
    assert post_id not in {item["id"] for item in client.get("/api/posts", params=[("person", "related:demo-account-ari"), ("account_id", "demo-account-ari")]).json()["items"]}
    reasons = mixed.json()["items"][0]["search_matches"][0]["reasons"]
    assert reasons == ["mention", "tag"]
    assert mixed.json()["items"][0]["search_matches"][0]["account_handle"] == "ari.notes"
    assert {item["id"] for item in client.get("/api/posts", params=[("person", "related:demo-account-ari"), ("tag", "여행"), ("place", "서울숲"), ("keyword", "아리")]).json()["items"]} == {post_id}
    assert post_id not in {item["id"] for item in client.get("/api/posts", params={"tag": "여행기"}).json()["items"]}
    assert post_id not in {item["id"] for item in client.get("/api/posts", params={"place": "서울 숲"}).json()["items"]}
    assert client.patch(f"/api/posts/{post_id}", json={"text": "멘션 제거", "tagged_account_ids": []}).status_code == 200
    assert post_id not in {item["id"] for item in client.get("/api/posts", params={"person": "related:demo-account-ari"}).json()["items"]}
    assert client.delete(f"/api/posts/{post_id}").status_code == 204
    with create_session() as session:
        assert not session.exec(select(PostAccountRef).where(PostAccountRef.post_id == post_id)).all()
    assert client.post("/api/auth/login", json={"login": "ari", "password": "ari"}).status_code == 200
    self_tag = client.post("/api/posts", json={"title": "직접 작성과 태그", "text": "", "tagged_account_ids": ["demo-account-ari"]})
    assert self_tag.status_code == 201, self_tag.text
    self_tag_id = self_tag.json()["post"]["id"]
    matched_self = next(item for item in client.get("/api/posts", params={"person": "related:demo-account-ari", "limit": 100}).json()["items"] if item["id"] == self_tag_id)
    assert matched_self["search_matches"][0]["reasons"] == ["author", "tag"]
    assert client.delete(f"/api/posts/{self_tag_id}").status_code == 204

    def payload(handle: str, *, tagged: list[str] | None = None, owner: str = "external-b", include_post: bool = True) -> ExternalImportPayload:
        post = {"external_id": "smart-post", "account_external_id": owner, "title": "가져온 글", "text": "@external.a 기록", "created_at": "2026-01-01T10:00:00"}
        if tagged is not None:
            post["tagged_account_external_ids"] = tagged
        return ExternalImportPayload.model_validate({
            "batch": {"external_id": "smart-batch"},
            "accounts": [
                {"external_id": "external-a", "handle": handle, "display_name": "동명이인 A"},
                {"external_id": "external-b", "handle": "external.b", "display_name": "동명이인 B"},
            ],
            "posts": [post] if include_post else [],
        })

    with create_session() as session:
        import_payload(session, payload("external.a", tagged=["external-a"]), dry_run=False)
        session.commit()
        imported = session.exec(select(Post).where(Post.external_id == "smart-post")).one()
        imported_id = imported.id
        account_a = session.exec(select(PostAccountRef.account_id).where(PostAccountRef.post_id == imported_id, PostAccountRef.kind == "tag")).one()
        assert {ref.kind for ref in session.exec(select(PostAccountRef).where(PostAccountRef.post_id == imported_id)).all()} == {"mention", "tag"}
        import_payload(session, payload("external.a"), dry_run=False)
        session.commit()
        assert session.exec(select(PostAccountRef).where(PostAccountRef.post_id == imported_id, PostAccountRef.kind == "tag")).one().account_id == account_a
        import_payload(session, payload("external.renamed", owner="external-a"), dry_run=False)
        session.commit()
        assert {ref.kind for ref in session.exec(select(PostAccountRef).where(PostAccountRef.post_id == imported_id)).all()} == {"tag"}
        assert session.get(Post, imported_id).account_id == account_a
        import_payload(session, payload("external.renamed", tagged=[]), dry_run=False)
        session.commit()
        assert not session.exec(select(PostAccountRef).where(PostAccountRef.post_id == imported_id)).all()
        import_payload(session, payload("external.renamed", include_post=False), dry_run=False)
        session.commit()
        assert session.get(Post, imported_id) is None

    with create_session() as session:
        late_post = Post(id="late-account-post", account_id="demo-account-mika", title="늦은 등록", text="@late.account 확인", created_at=datetime.now(timezone.utc))
        session.add(late_post)
        session.flush()
        sync_post_mentions(session, late_post)
        assert not session.exec(select(PostAccountRef).where(PostAccountRef.post_id == late_post.id)).all()
        session.commit()
        import_payload(session, ExternalImportPayload.model_validate({
            "batch": {"external_id": "late-account-batch"},
            "accounts": [{"external_id": "late-account", "handle": "late.account", "display_name": "늦은 계정"}],
            "posts": [],
        }), dry_run=False)
        session.commit()
        late_account = session.exec(select(Account).where(Account.external_id == "late-account")).one()
        assert session.exec(select(PostAccountRef).where(PostAccountRef.post_id == late_post.id)).one().account_id == late_account.id
        late_account.deactivated_at = datetime.now(timezone.utc)
        session.add(late_account)
        session.commit()
        assert "late-account-post" in {item["id"] for item in client.get("/api/posts", params={"person": f"related:{late_account.id}"}).json()["items"]}
        assert all(item["account"]["id"] != late_account.id for item in client.get("/api/accounts/search", params={"keyword": "late.account"}).json()["items"])
    print("Smart search regression passed")


if __name__ == "__main__":
    main()
