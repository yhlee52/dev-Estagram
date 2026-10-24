# 프로젝트 목표

`feed-prototype`은 한 PC에서 테스트 계정과 데이터를 사용해 소셜 피드 기능을 확인하는
범용 앱입니다. Vite + React + TypeScript frontend, FastAPI backend, 로컬 PostgreSQL을
사용합니다. 현재 표시 버전은 [appVersion.ts](feed-prototype/src/config/appVersion.ts)를
따릅니다.

## 제품 모델

User, Account, Post, Feed, Follow, Asset, Metadata, Comment, Bookmark,
Notification, Like, Message를 공통 개념으로 사용합니다. personal feed, bot feed,
project feed에 같은 모델을 적용합니다. 특정 산업의 용어는 공통 type·component·route에
넣지 않고 post 및 asset metadata에 둡니다.

User와 Account는 1:1입니다. API 모드의 쓰기 작업은 password 로그인과 서버 세션으로
사용자를 확인합니다. mock 모드는 정적 UI 데모용으로 유지합니다.

## 로컬 데이터

PostgreSQL에 계정·게시글·상호작용을 저장합니다. 외부 JSON 패키지는
`EXTERNAL_POSTS_DIR/incoming/`에 넣고, 상대 경로 자산은 같은 루트의 `assets/`에
관리 복사본을 둡니다. 처리한 패키지는 `archive/` 또는 `failed/`로 이동합니다.
기존 외부 패키지 형식과 `external_id` 기반 재import 동작은 유지합니다.

설치와 실행은 [로컬 실행 가이드](feed-prototype/docs/QUICK_RUN_GUIDE_LOCAL.md),
현재 기능과 설정은 [앱 README](feed-prototype/README.md), 다음 작업 후보는
[로드맵](feed-prototype/docs/ROADMAP.md)을 참고합니다. 버전별 상세 이력은 Git
history에서 확인할 수 있습니다.
