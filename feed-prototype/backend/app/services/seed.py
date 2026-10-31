import argparse
from datetime import datetime, timedelta, timezone
from typing import TypeVar

from sqlalchemy import delete
from sqlmodel import Session, SQLModel, select

from app.db.session import create_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.like import PostLike
from app.models.message import DirectMessage, MessageRoom, MessageRoomMember
from app.models.post import Post
from app.models.profile_pin import ProfilePin
from app.models.user import User
from app.services.auth import ensure_user_password
from app.services.post_account_refs import sync_post_mentions


ModelT = TypeVar("ModelT", bound=SQLModel)


USERS = [
    {
        "id": "demo-user-ari",
        "handle": "ari",
        "display_name": "아리",
        "avatar_url": "/assets/demo/avatar-ari.svg",
        "bio": "동네 산책과 일상의 작은 발견을 기록합니다.",
        "password": "ari",
    },
    {
        "id": "demo-user-mika",
        "handle": "mika",
        "display_name": "미카",
        "avatar_url": "/assets/demo/avatar-mika.svg",
        "bio": "프로젝트 진행 상황과 읽은 자료를 정리합니다.",
        "password": "mika",
    },
    {
        "id": "demo-user-nova",
        "handle": "nova",
        "display_name": "노바 요약봇",
        "avatar_url": "/assets/demo/avatar-nova.svg",
        "bio": "테스트용 요약 글을 자동으로 올리는 계정입니다.",
        "password": "nova",
    },
]

ACCOUNTS = [
    {
        "id": "demo-account-ari",
        "user_id": "demo-user-ari",
        "handle": "ari.notes",
        "display_name": "아리의 기록",
        "bio": "걷다가 발견한 풍경과 주말 계획을 모읍니다.\n사진과 짧은 글로 오늘의 장면을 남겨요.",
        "avatar_url": "/assets/demo/avatar-ari.svg",
        "cover_url": "/assets/demo/cover-ari.svg",
        "profile_links": [{"label": "프로젝트 저장소", "url": "https://github.com/yhlee52/dev-Estagram"}],
        "kind": "person",
        "profile_source": "user",
    },
    {
        "id": "demo-account-mika",
        "user_id": "demo-user-mika",
        "handle": "mika.project",
        "display_name": "미카의 프로젝트 노트",
        "bio": "작은 프로젝트의 진행 상황을 그래프와 표로 정리합니다.\n기록을 모아 다음 주의 우선순위를 결정해요.",
        "avatar_url": "/assets/demo/avatar-mika.svg",
        "cover_url": "/assets/demo/cover-mika.svg",
        "profile_links": [
            {"label": "저장소", "url": "https://github.com/yhlee52/dev-Estagram"},
            {"label": "사용 가이드", "url": "https://github.com/yhlee52/dev-Estagram/blob/main/feed-prototype/README.md"},
        ],
        "kind": "project",
        "profile_source": "user",
    },
    {
        "id": "demo-account-nova",
        "user_id": "demo-user-nova",
        "handle": "nova.digest",
        "display_name": "노바의 요약 피드",
        "bio": "테스트 데이터를 읽기 쉽게 요약하는 로컬 봇입니다.\n실제 외부 서비스나 자동 수집과 연결되지는 않습니다.",
        "avatar_url": "/assets/demo/avatar-nova.svg",
        "cover_url": "/assets/demo/cover-nova.svg",
        "profile_links": [{"label": "데이터 형식", "url": "https://github.com/yhlee52/dev-Estagram/blob/main/feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md"}],
        "kind": "bot",
        "profile_source": "user",
    },
]

POSTS = [
    {
        "id": "demo-post-morning-walk",
        "account_id": "demo-account-ari",
        "title": "오늘의 산책 사진",
        "text": "퇴근길 공원에서 빛이 예뻐 잠깐 멈췄어요. 사진 한 장으로 남겨 둡니다. #산책 #사진",
        "tags": ["산책", "사진", "일상"],
        "metadata_json": {"기분": "차분함", "장소": "동네 공원", "location": "동네 공원"},
        "age_days": 1,
    },
    {
        "id": "demo-post-weekly-chart",
        "account_id": "demo-account-mika",
        "title": "이번 주 프로젝트 진행 그래프",
        "text": "작은 작업을 꾸준히 마무리하고 있습니다. 다음 주에는 사용성 점검에 집중할 예정이에요. @ari.notes 의견도 궁금합니다. #프로젝트",
        "tags": ["프로젝트", "진행상황", "그래프"],
        "metadata_json": {"상태": "진행 중", "주차": 24},
        "age_days": 2,
    },
    {
        "id": "demo-post-summary-table",
        "account_id": "demo-account-mika",
        "title": "다음 주 작업표",
        "text": "할 일과 현재 상태를 표로 정리했습니다. 필요한 항목을 빠르게 찾아볼 수 있어요. #계획",
        "tags": ["프로젝트", "계획", "표"],
        "metadata_json": {"분류": "계획", "상태": "검토 중"},
        "age_days": 4,
    },
    {
        "id": "demo-post-daily-digest",
        "account_id": "demo-account-nova",
        "title": "오늘의 로컬 피드 요약",
        "text": "오늘은 산책 사진과 프로젝트 기록이 올라왔습니다. @mika.project의 그래프도 확인해 보세요. #요약",
        "tags": ["요약", "자동생성"],
        "metadata_json": {"source": "demo", "generated": True},
        "age_days": 0,
    },
    {
        "id": "demo-post-html-note",
        "account_id": "demo-account-nova",
        "title": "자료 링크 모음",
        "text": "로컬 피드의 사용법을 다시 찾아보기 쉽게 링크로 남깁니다. #자료",
        "tags": ["자료", "링크"],
        "metadata_json": {"형식": "링크"},
        "age_days": 5,
    },
    {
        "id": "demo-post-weekend-plan",
        "account_id": "demo-account-ari",
        "title": "이번 주말 계획",
        "text": "오전에는 카페에서 책을 읽고, 오후에는 새로 생긴 산책길을 걸어 보려고 해요. #주말 #계획",
        "tags": ["주말", "계획", "일상"],
        "metadata_json": {"장소": "동네", "location": "동네", "예상 시간": "오후"},
        "age_days": 0,
    },
    {
        "id": "demo-post-cafe-note",
        "account_id": "demo-account-ari",
        "title": "골목 카페에서 발견한 작은 쉼표",
        "text": "창가 자리에서 한 시간 쉬었습니다. 커피 향이 좋아서 다음에도 들르고 싶어요. #카페 #일상",
        "tags": ["카페", "일상", "사진"],
        "metadata_json": {"장소": "골목 카페", "location": "골목 카페", "기분": "여유"},
        "age_days": 3,
    },
    {
        "id": "demo-post-retrospective",
        "account_id": "demo-account-mika",
        "title": "프로젝트 회고: 작게 나누니 쉬워졌어요",
        "text": "작업을 한 번에 끝내려 하기보다 작은 단위로 나눠 보니 진행 상황이 더 잘 보였습니다. #회고",
        "tags": ["프로젝트", "회고"],
        "metadata_json": {"상태": "완료", "분류": "회고"},
        "age_days": 0,
    },
    {
        "id": "demo-post-local-tips",
        "account_id": "demo-account-nova",
        "title": "로컬 테스트 안내",
        "text": "게시글·계정 검색과 프로필 탭을 둘러보세요. 고정 글은 프로필 맨 위에 보입니다. #도움말",
        "tags": ["도움말", "요약"],
        "metadata_json": {"source": "demo", "generated": True},
        "age_days": 1,
    },
]

ASSETS = [
    {
        "id": "demo-asset-walk-image",
        "post_id": "demo-post-morning-walk",
        "type": "image",
        "title": "공원 산책 풍경",
        "description": "산책길을 그린 로컬 데모 이미지",
        "url": "/assets/demo/walk.svg",
        "src": "/assets/demo/walk.svg",
        "mime_type": "image/svg+xml",
        "sort_order": 0,
        "metadata_json": {"width": 1200, "height": 800},
    },
    {
        "id": "demo-asset-progress-chart",
        "post_id": "demo-post-weekly-chart",
        "type": "plot",
        "title": "주간 진행 그래프",
        "description": "완료한 작업 수의 변화를 보여주는 로컬 데모 그래프",
        "url": "/assets/demo/progress.svg",
        "src": "/assets/demo/progress.svg",
        "mime_type": "image/svg+xml",
        "sort_order": 0,
        "metadata_json": {"chart_type": "line"},
    },
    {
        "id": "demo-asset-summary-table",
        "post_id": "demo-post-summary-table",
        "type": "table",
        "title": "주간 작업표",
        "description": "이번 주 할 일과 상태를 정리한 CSV 표",
        "url": "/assets/demo/project-plan.csv",
        "src": "/assets/demo/project-plan.csv",
        "mime_type": "text/csv",
        "sort_order": 0,
        "metadata_json": {"columns": ["할 일", "상태"]},
    },
    {
        "id": "demo-asset-digest-json",
        "post_id": "demo-post-daily-digest",
        "type": "file",
        "title": "요약 데이터",
        "description": "로컬 테스트용 JSON 파일",
        "url": "/assets/demo/digest.json",
        "src": "/assets/demo/digest.json",
        "mime_type": "application/json",
        "sort_order": 0,
        "metadata_json": {"schema": "demo.digest.v1"},
    },
    {
        "id": "demo-asset-html-note",
        "post_id": "demo-post-html-note",
        "type": "link",
        "title": "로컬 실행 가이드",
        "description": "프로젝트의 로컬 실행 방법을 확인할 수 있습니다.",
        "url": "https://github.com/yhlee52/dev-Estagram/blob/main/feed-prototype/docs/QUICK_RUN_GUIDE_LOCAL.md",
        "src": "https://github.com/yhlee52/dev-Estagram/blob/main/feed-prototype/docs/QUICK_RUN_GUIDE_LOCAL.md",
        "mime_type": "text/html",
        "sort_order": 0,
        "metadata_json": {"trusted": False},
    },
    {
        "id": "demo-asset-cafe-image", "post_id": "demo-post-cafe-note", "type": "image",
        "title": "카페 창가", "description": "창가의 커피와 책을 그린 로컬 데모 이미지",
        "url": "/assets/demo/cafe.svg", "src": "/assets/demo/cafe.svg",
        "mime_type": "image/svg+xml", "sort_order": 0, "metadata_json": None,
    },
]

FOLLOWS = [
    {
        "id": "demo-follow-ari-mika",
        "follower_user_id": "demo-user-ari",
        "following_account_id": "demo-account-mika",
    },
    {
        "id": "demo-follow-ari-nova",
        "follower_user_id": "demo-user-ari",
        "following_account_id": "demo-account-nova",
    },
    {
        "id": "demo-follow-mika-ari",
        "follower_user_id": "demo-user-mika",
        "following_account_id": "demo-account-ari",
    },
    {
        "id": "demo-follow-nova-mika",
        "follower_user_id": "demo-user-nova",
        "following_account_id": "demo-account-mika",
    },
]

PINS = {
    "demo-account-ari": ["demo-post-morning-walk", "demo-post-cafe-note"],
    "demo-account-mika": ["demo-post-weekly-chart", "demo-post-summary-table"],
    "demo-account-nova": ["demo-post-daily-digest"],
}

COMMENTS = [
    {"id": "demo-comment-ari-chart", "post_id": "demo-post-weekly-chart", "author_user_id": "demo-user-ari", "text": "그래프가 한눈에 들어오네요! 다음 주 결과도 기대할게요."},
    {"id": "demo-comment-mika-walk", "post_id": "demo-post-morning-walk", "author_user_id": "demo-user-mika", "text": "빛이 정말 좋네요. @ari.notes 다음 산책길도 알려 주세요!"},
    {"id": "demo-comment-nova-plan", "post_id": "demo-post-weekend-plan", "author_user_id": "demo-user-nova", "text": "주말 계획을 기록해 두셨군요. 즐거운 시간 보내세요!"},
]

LIKES = [
    {"id": "demo-like-mika-walk", "user_id": "demo-user-mika", "post_id": "demo-post-morning-walk"},
    {"id": "demo-like-ari-chart", "user_id": "demo-user-ari", "post_id": "demo-post-weekly-chart"},
    {"id": "demo-like-ari-digest", "user_id": "demo-user-ari", "post_id": "demo-post-daily-digest"},
]

BOOKMARKS = [
    {"id": "demo-bookmark-ari-chart", "user_id": "demo-user-ari", "post_id": "demo-post-weekly-chart", "note": "프로젝트 진행 방식 참고하기"},
    {"id": "demo-bookmark-mika-walk", "user_id": "demo-user-mika", "post_id": "demo-post-morning-walk", "note": "다음 산책 코스 후보"},
]

MESSAGES = [
    {"id": "demo-message-ari-mika-1", "sender_user_id": "demo-user-ari", "recipient_user_id": "demo-user-mika", "text": "안녕하세요! 이번 주 그래프 잘 봤어요."},
    {"id": "demo-message-mika-ari-1", "sender_user_id": "demo-user-mika", "recipient_user_id": "demo-user-ari", "text": "고마워요. 다음 주 작업표도 올려 두었어요!"},
]


def get_by_id(session: Session, model: type[ModelT], item_id: str) -> ModelT | None:
    return session.get(model, item_id)


def add_if_missing(session: Session, model: type[ModelT], values: dict) -> bool:
    if get_by_id(session, model, values["id"]) is not None:
        return False

    session.add(model(**values))
    return True


def add_follow_if_missing(session: Session, values: dict) -> bool:
    existing = session.exec(
        select(Follow).where(
            Follow.follower_user_id == values["follower_user_id"],
            Follow.following_account_id == values["following_account_id"],
        )
    ).first()
    if existing is not None:
        return False

    session.add(Follow(**values))
    return True


def add_pair_if_missing(session: Session, model: type[ModelT], values: dict, left: str, right: str) -> bool:
    if session.get(model, values["id"]) is not None:
        return False
    if session.exec(select(model).where(getattr(model, left) == values[left], getattr(model, right) == values[right])).first():
        return False
    session.add(model(**values))
    return True


def refresh_fields(session: Session, model: type[ModelT], values: dict, fields: tuple[str, ...], identity_fields: tuple[str, ...]) -> int:
    row = session.get(model, values["id"])
    if row is None or any(getattr(row, field) != values[field] for field in identity_fields):
        return 0
    changed = False
    for field in fields:
        if getattr(row, field) != values[field]:
            setattr(row, field, values[field])
            changed = True
    if changed:
        row.updated_at = datetime.now(timezone.utc)
        session.add(row)
    return int(changed)


def seed_database(refresh_demo: bool = False) -> dict[str, int]:
    counts = {
        "users": 0,
        "accounts": 0,
        "posts": 0,
        "post_assets": 0,
        "follows": 0,
        "profile_pins": 0,
        "comments": 0,
        "post_likes": 0,
        "bookmarks": 0,
        "direct_messages": 0,
        "refreshed": 0,
    }

    with create_session() as session:
        for values in USERS:
            user_values = {key: value for key, value in values.items() if key != "password"}
            inserted = add_if_missing(session, User, user_values)
            counts["users"] += int(inserted)
            if refresh_demo and not inserted:
                counts["refreshed"] += refresh_fields(session, User, user_values, ("display_name", "bio", "avatar_url"), ("handle",))
            session.flush()
            ensure_user_password(session, values["id"], values["password"])

        for values in ACCOUNTS:
            inserted = add_if_missing(session, Account, values)
            counts["accounts"] += int(inserted)
            if refresh_demo and not inserted:
                counts["refreshed"] += refresh_fields(session, Account, values, ("display_name", "bio", "avatar_url", "cover_url", "profile_links"), ("user_id", "handle"))
        session.flush()

        seeded_at = datetime.now(timezone.utc)
        for values in POSTS:
            post_values = {key: value for key, value in values.items() if key != "age_days"}
            created_at = seeded_at - timedelta(days=values["age_days"])
            post_values.update(created_at=created_at, updated_at=created_at)
            inserted = add_if_missing(session, Post, post_values)
            counts["posts"] += int(inserted)
            if refresh_demo and not inserted:
                counts["refreshed"] += refresh_fields(session, Post, post_values, ("title", "text", "tags", "metadata_json"), ("account_id",))
        session.flush()
        if refresh_demo or counts["accounts"] == len(ACCOUNTS):
            for values in POSTS:
                post = session.get(Post, values["id"])
                if post is not None and post.account_id == values["account_id"]:
                    sync_post_mentions(session, post)

        for values in ASSETS:
            inserted = add_if_missing(session, PostAsset, values)
            counts["post_assets"] += int(inserted)
            if refresh_demo and not inserted:
                counts["refreshed"] += refresh_fields(session, PostAsset, values, ("type", "title", "description", "url", "src", "mime_type", "sort_order", "metadata_json"), ("post_id",))

        # Existing users may have arranged their pins and interactions. Only a
        # fresh demo installation or an explicit refresh populates these.
        if refresh_demo or counts["accounts"] == len(ACCOUNTS):
            for values in FOLLOWS:
                counts["follows"] += int(add_follow_if_missing(session, values))
            session.flush()
            for account_id, post_ids in PINS.items():
                account = session.get(Account, account_id)
                expected_user_id = next(value["user_id"] for value in ACCOUNTS if value["id"] == account_id)
                if account is None or account.user_id != expected_user_id:
                    continue
                session.exec(delete(ProfilePin).where(ProfilePin.account_id == account_id))
                session.flush()
                for position, post_id in enumerate(post_ids):
                    post = session.get(Post, post_id)
                    if post is None or post.account_id != account_id:
                        continue
                    session.add(ProfilePin(id=f"demo-pin-{account_id}-{position}", account_id=account_id, post_id=post_id, position=position))
                    counts["profile_pins"] += 1
            for values in COMMENTS:
                counts["comments"] += int(add_if_missing(session, Comment, values))
            for values in LIKES:
                counts["post_likes"] += int(add_pair_if_missing(session, PostLike, values, "user_id", "post_id"))
            for values in BOOKMARKS:
                counts["bookmarks"] += int(add_pair_if_missing(session, Bookmark, values, "user_id", "post_id"))
            for values in MESSAGES:
                counts["direct_messages"] += int(add_if_missing(session, DirectMessage, values))
            # Fresh demo messages need a room; migrations handle existing rows.
            demo_messages = [session.get(DirectMessage, values["id"]) for values in MESSAGES]
            if all(demo_messages) and any(message.room_id is None for message in demo_messages):
                room_id = next((message.room_id for message in demo_messages if message.room_id),
                               "demo-room-ari-mika")
                if session.get(MessageRoom, room_id) is None:
                    first_at = min(message.created_at for message in demo_messages)
                    session.add(MessageRoom(id=room_id, kind="direct", created_at=first_at))
                    for user_id in {message.sender_user_id for message in demo_messages}:
                        session.add(MessageRoomMember(id=f"demo-member-{user_id}", room_id=room_id,
                                                      user_id=user_id, joined_at=first_at))
                    session.flush()
                for message in demo_messages:
                    message.room_id = room_id
                    session.add(message)

        session.commit()

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Add local demo data without replacing existing content.")
    parser.add_argument("--refresh-demo", action="store_true", help="Update Ari, Mika, and Nova demo content and reset their profile pins; keep passwords and other accounts.")
    args = parser.parse_args()
    counts = seed_database(refresh_demo=args.refresh_demo)
    print("Seed complete")
    for name, count in counts.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
