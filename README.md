# feed-prototype v0.0.0

`feed-prototype`은 범용 `Account` / `Post` / `Feed` prototype입니다.

사용 시나리오:

1. 일반 SNS-like local feed
2. 외부 분석 프로그램이 생성한 plot, table, file, link, tag, metadata 포함 리포트 post를 보여주는 feed UI

`v0.0.0`은 첫 번째 공유 가능한 internal/local prototype release입니다. 일반 SNS-like feed와 external report feed를 모두 데모할 수 있는 기준 버전이지만, production-ready 제품은 아닙니다.

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

## v0.0.0 기능 범위

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

## 실행 Mode

### Mock mode

Frontend 단독 UI demo mode입니다. Backend 없이 실행할 수 있고, static mock data와 localStorage overlay를 사용합니다.

### API mode

FastAPI + PostgreSQL 기반 mode입니다. 실제 DB를 read/write하며 user, account, follow, post, asset, metadata data를 API를 통해 다룹니다.

### External import mode

외부 JSON post package를 backend CLI로 DB에 import하는 workflow입니다. Import된 post는 API mode UI에서 일반 post처럼 표시됩니다. 일반 SNS sample과 분석 리포트 sample을 모두 확인할 수 있습니다.

## v0.0.0 Non-goals / Limitations

- production-ready app이 아닙니다.
- 정식 login, JWT, session, OAuth를 제공하지 않습니다.
- formal permission/authorization system은 미완성입니다.
- 댓글, 좋아요, 알림 기능은 없습니다.
- S3 upload, real file upload, asset file copy를 제공하지 않습니다.
- scheduler 또는 folder watch를 제공하지 않습니다.
- interactive chart rendering을 제공하지 않습니다.
- PDF/HTML inline preview를 제공하지 않습니다.
- semantic search 또는 vector search를 제공하지 않습니다.

## 빠른 실행 문서

상세 실행 절차와 릴리즈 확인 절차는 아래 문서에서 관리합니다.

- `feed-prototype/docs/RELEASE_0_0_RUNBOOK.md`
- `feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md`
- `feed-prototype/docs/RELEASE_0_0_CHECKLIST.md`

환경 설정은 각 `.env.example`을 복사해 `.env`를 만드는 방식으로 시작합니다. 실제 `.env`는 commit하지 않습니다. Vite 환경변수를 바꾼 뒤에는 frontend dev server를 재시작하고, external import 전에는 backend `DATABASE_URL`이 의도한 DB를 가리키는지 확인합니다.

현재 참고 가능한 기존 문서:

- `feed-prototype/README.md`
- `feed-prototype/docs/RELEASE_CHECKLIST_v0.0.0.md`
- `feed-prototype/docs/SMOKE_TEST_v0.0.0.md`
- `feed-prototype/data/external_posts/README.md`
- `feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md`

## Repository 위치

- Frontend app: `feed-prototype/`
- Backend: `feed-prototype/backend/`
- Frontend mock data: `feed-prototype/src/data/`
- External post package: `feed-prototype/data/external_posts/`
- Static browser asset: `feed-prototype/public/assets/`
