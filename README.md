# feed-prototype

`feed-prototype`은 범용 `Account` / `Post` / `Feed` prototype입니다.

현재 릴리즈: `v0.3.5` (테마 완료 후 운영 안정화 patch — `process_incoming --watch`
실행 중 Vite dev server가 종료되던 문제 수정 + 릴리즈 문서 최신화). v0.3.x(Ingestion
신뢰성) 테마는 v0.3.4로 완료되었습니다. 버전 라벨 기준은
`feed-prototype/src/config/appVersion.ts`의 `APP_RELEASE_LABEL`입니다.

사용 시나리오:

1. 일반 SNS-like local feed
2. 외부 분석 프로그램이 생성한 plot, table, file, link, tag, metadata 포함 리포트 post를 보여주는 feed UI

`v0.0.0`이 첫 번째 공유 가능한 internal/local prototype release였고, 그 위에
v0.1.x(탐색과 발견)와 v0.2.x(레이아웃 & UI 개편) 테마가 쌓였으며, v0.3.x(Ingestion
신뢰성) 테마가 v0.3.0 HTTP Import API, v0.3.1 Import Batch 이력, v0.3.2 자동
이동/디렉터리 일괄 처리/Watch, v0.3.3 asset managed storage 복사(opt-in), v0.3.4 UX
backlog 반영으로 완료되었습니다. 일반 SNS-like feed와 external
report feed를 모두 데모할 수 있지만,
production-ready 제품은 아닙니다. 전체 버전 트리는
`feed-prototype/docs/ROADMAP.md`를 참고하세요.

## Core Domain

core domain은 generic하게 유지합니다.

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

설비/리포트 전용 값이 필요하면 core model이나 component 이름으로 만들지 않고 `metadata_json`, `post.metadata`, asset metadata에 둡니다. 예를 들어 반도체 설비 분석 scenario의 recipe, chamber, severity 같은 값은 metadata value로만 취급합니다.

## 기능 범위

v0.0.0 기준선:

- account/profile 조회
- follow/unfollow
- home feed
- post create/edit/delete
- external post JSON import
- post tags, metadata, assets
- metadata/tag/asset filter & search
- image/plot/table/file/link asset viewer
- image/plot thumbnail 및 lightbox
- multi image/plot `sort_order` 표시 순서
- CSV table preview

v0.1.x(탐색과 발견):

- cursor 기반 pagination(더 보기), 날짜 범위 필터, 최신순/오래된순 정렬
- 필터 상태 ↔ URL query 동기화(공유/재현 가능한 링크)
- 클릭 가능한 해시태그 칩, 검색창 `#tag` 라우팅, tag 자동완성, `GET /api/tags`
- post 본문 `@handle` → Account Profile 링크 렌더링

v0.2.x(레이아웃 & UI 개편):

- 데스크톱 3컬럼 레이아웃(좌측 네비 레일 + 중앙 feed + 우측 컨텍스트 레일)
- 한 줄 헤더 + 아바타 드롭다운(디버그 정보 수납), Switch user 단일화
- Explore(Posts) 탭 태그 진입점, Accounts 활동 신호·정렬
- Me 탭 mock/API 내 활동 요약 + 내 post 관리(New Post·Edit·인라인 Delete)

v0.3.x(Ingestion 신뢰성):

- HTTP import API: 기존 package JSON을 `POST /api/imports`로 수신(dry-run·선택적 토큰 보호)
- Import batch 이력: import 사건을 `import_batch`에 기록하고 `GET /api/imports`·
  `GET /api/imports/{batch_external_id}`로 조회, `/imports` UI(목록/상세, API mode 전용)
- 자동 이동 + 디렉터리 일괄 처리 + Watch: `incoming/`의 package를 일괄 import하고
  성공→`archive/` / 실패→`failed/`로 자동 이동(`process_incoming` CLI, `--watch`
  폴링 옵션). 단일 파일 CLI·HTTP import는 파일을 이동하지 않음
- Asset managed storage 복사(opt-in): `MANAGE_ASSET_STORAGE`를 켜면 asset url이
  상대 로컬 경로일 때 파일을 `public/assets/managed/`로 복사하고 url을 재작성.
  `/assets/...`·`http(s)://` url은 무손상, 기본 OFF, CLI/`process_incoming` 경로만
  적용(HTTP import 미적용)
- UX backlog 반영(테마 마지막 MINOR): Me 탭(API 모드) 내 post를 `MY_POSTS_PAGE_SIZE`
  단위 "Load more"로 점진 렌더, post 삭제 확인을 공용 `ConfirmDialog`로 교체.
  이로써 v0.3.x 테마 완료

## 실행 Mode

### Mock mode

Frontend 단독 UI demo mode입니다. Backend 없이 실행할 수 있고, static mock data와 localStorage overlay를 사용합니다.

### API mode

FastAPI + PostgreSQL 기반 mode입니다. 실제 DB를 read/write하며 user, account, follow, post, asset, metadata data를 API를 통해 다룹니다.

### External import mode

외부 JSON post package를 backend CLI로 DB에 import하는 workflow입니다. Import된 post는 API mode UI에서 일반 post처럼 표시됩니다. 일반 SNS sample과 분석 리포트 sample을 모두 확인할 수 있습니다.

## Non-goals / Limitations (현재까지)

- production-ready app이 아닙니다.
- 정식 login, JWT, session, OAuth를 제공하지 않습니다.
- formal permission/authorization system은 미완성입니다.
- 댓글, 좋아요, 알림 기능은 없습니다.
- S3 upload, real file upload를 제공하지 않습니다. asset 파일 복사는 v0.3.3부터
  opt-in(`MANAGE_ASSET_STORAGE`)으로 상대 로컬 경로 asset만 managed storage로
  복사합니다. UI/HTTP 업로드는 여전히 제공하지 않습니다.
- OS 레벨 scheduler/데몬은 제공하지 않습니다. `incoming/` 폴더의 단순 폴링
  watch와 일괄 처리 CLI(`process_incoming`)는 v0.3.2부터 제공합니다.
- interactive chart rendering을 제공하지 않습니다.
- PDF/HTML inline preview를 제공하지 않습니다.
- semantic search 또는 vector search를 제공하지 않습니다.

## 빠른 실행 문서

상세 실행 절차와 릴리즈 확인 절차는 아래 문서에서 관리합니다.

- `feed-prototype/docs/RELEASE_0_0_RUNBOOK.md`
- `feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md`
- `feed-prototype/docs/RELEASE_0_0_CHECKLIST.md`

환경 설정은 각 `.env.example`을 복사해 `.env`를 만드는 방식으로 시작합니다. 실제 `.env`는 commit하지 않습니다. Vite 환경변수를 바꾼 뒤에는 frontend dev server를 재시작하고, external import 전에는 backend `DATABASE_URL`이 의도한 DB를 가리키는지 확인합니다.

추가 참고 문서:

- `feed-prototype/README.md`
- `feed-prototype/data/external_posts/README.md`

## Repository 위치

- Frontend app: `feed-prototype/`
- Backend: `feed-prototype/backend/`
- Frontend mock data: `feed-prototype/src/data/`
- External post package: `feed-prototype/data/external_posts/`
- Static browser asset: `feed-prototype/public/assets/`
