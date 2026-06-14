# AGENTS.md

## Project Identity

이 프로젝트는 `feed-prototype`입니다. Vite + React + TypeScript 기반의 범용 Instagram-like local feed prototype입니다.

이 codebase는 personal feed, bot feed, project feed, 향후 회사 내부 설비 리포트 feed를 지원할 수 있을 만큼 generic해야 합니다. core product model은 설비 전용이 아닙니다.

## Current Release Docs

현재 릴리즈는 `v0.2.3`(레이아웃 & UI 개편 테마 완료)이며
`feed-prototype/src/config/appVersion.ts`의 `APP_RELEASE_LABEL`이 기준입니다.
실행, external package 작성, 릴리즈 검증은 다음 문서를 우선 참고합니다.

- `README.md`
- `feed-prototype/README.md`
- `feed-prototype/docs/README.md` (문서 색인)
- `feed-prototype/docs/ROADMAP.md` (버전 트리·테마)
- `feed-prototype/docs/GOLDEN_SAMPLE_REGRESSION.md`
- `feed-prototype/docs/RELEASE_0_0_RUNBOOK.md`
- `feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md`
- `feed-prototype/docs/RELEASE_0_0_CHECKLIST.md`

버전별 상세 scope는 `feed-prototype/docs/`의 `V0_x_y_*_SCOPE.md` 문서를
참고합니다(v0.1.0~v0.2.3). 다음 테마 진입 판단과 후보는
`feed-prototype/docs/V0_3_X_INGESTION_PLAN.md`에 있습니다. 과거 MVP별 테스트
절차는 `feed-prototype/docs/archive/` 아래에 historical reference로 보관됩니다.
현재 실행/릴리즈 기준은 archived 문서보다 위 문서를 우선합니다.

## Core Domain

core type, shared component, route, data flow에는 다음 generic concept를 사용합니다.

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

core type name 또는 primary component name에 설비 리포트 전용 용어를 넣지 않습니다. 피해야 할 이름:

- Equipment
- Chamber
- Sensor
- Recipe
- Severity
- Report

설비 리포트 관련 정보가 필요하면 `post.metadata`, `metadata_json`, asset metadata로 표현합니다. domain-specific value는 data로 유지하고 app architecture의 기반으로 삼지 않습니다.

## Current Implementation Scope

v0.0.0 기준선은 MVP1-MVP12로 구축되었고, 그 위에 v0.1.x·v0.2.x 테마가 쌓였습니다.
상세 단계 기록은 아래 "Completed Scope History"를, 버전 트리는 `ROADMAP.md`를
참고합니다.

현재 제약:

- Mock mode는 계속 사용 가능합니다. v0.3.0부터 mock mode는 "UI 데모 전용 동결"
  상태로 전환되며(신규 기능은 API mode에만 추가 가능), 제거하지는 않습니다.
- static frontend mock data는 `feed-prototype/src/data` 아래에 유지합니다.
- static browser asset은 `feed-prototype/public/assets` 아래에 유지합니다.
- runtime mock-mode overlay는 localStorage에 저장합니다.
- API mode는 FastAPI와 backend PostgreSQL data를 사용합니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.
- 현 단계에서는 각 `User`에 정확히 하나의 `Account`가 대응합니다(1:N은 v0.5.x).
- active API user는 backend DB user 중에서 선택하고 local에 저장합니다.
- active API user selection은 real login, authentication, authorization, account security가 아닙니다.

중요 localStorage key:

- `local-feed-active-user-id`
- `local-feed-following-by-user`
- `local-feed-local-users`
- `local-feed-local-accounts`

## Completed Scope History

각 단계의 상세는 `ROADMAP.md`와 버전별 scope 문서에 있습니다. 아래는 한 줄 요약
이력입니다.

v0.0.0 기준선 (MVP1-MVP12):

- MVP1-MVP4: local/static feed. mock JSON + localStorage overlay, user/follow state.
- MVP5: backend/database skeleton. FastAPI + PostgreSQL + SQLModel + Alembic,
  `users`/`accounts`/`posts`/`post_assets`/`follows` table, seed data.
- MVP6: frontend API read mode(`mock`/`api`), `GET /api/feed?user_id=...`.
- MVP7: API follow/unfollow write(`follows` table). mock은 localStorage 유지.
- MVP7.5: API local user/account registration(`POST /api/users`, 1:1 Account 생성).
- MVP8: API personal post create/delete. own 1:1 account ownership check만 사용.
- MVP9: post asset + metadata management(`assets`/`tags`/`metadata_json`/`updated_at`,
  `POST`/`PATCH`/`DELETE /api/posts`). frontend는 `account_id`를 선택하지 않음.
- MVP10: external post ingestion pipeline. JSON package → import script가
  `external_id` 기반 upsert. `--dry-run` 지원. asset 파일 복사는 없음.
- MVP11: metadata/tag/asset filter & search. `GET /api/posts`·`GET /api/feed`에
  keyword/tag/metadata key-value/asset_type/account/`my_posts_only` query 추가.
- MVP12: asset viewer enhancement. image/plot thumbnail + lightbox(prev/next),
  `asset.sort_order`, CSV table preview, file/link card, broken URL graceful fallback.

v0.1.x — 탐색과 발견 (Discovery & Navigation):

- v0.1.0: cursor pagination(더 보기), 날짜 범위 필터, 최신순/오래된순 정렬,
  필터 ↔ URL query 동기화, `metadata_json` JSONB + GIN index.
- v0.1.1: 해시태그 칩 클릭 → `/posts?tag=<tag>`.
- v0.1.2: 검색창 `#tag` 라우팅, `GET /api/tags`, tag 자동완성.
- v0.1.3: post 본문 `@handle` → Account Profile 링크 렌더링(존재하지 않으면 plain).

v0.2.x — 레이아웃 & UI 개편 (Layout & UI):

- v0.2.0: 데스크톱 3컬럼 레이아웃(좌측 네비 레일 + 중앙 feed + 우측 컨텍스트 레일).
  PC 전용 전제(좁은 폭은 graceful fallback).
- v0.2.1: 한 줄 헤더 + 아바타 드롭다운 UserMenu(user id·버전 등 수납),
  Switch user 단일화.
- v0.2.2: Posts→Explore 태그 진입점, Accounts 활동 신호(최근 N일 post 수)·정렬.
- v0.2.3: Me 탭 mock/API 내 활동 요약 + 내 post 관리(New Post·Edit·인라인 Delete),
  필터 0건 empty state의 "Reset filters", UX backlog 반영.

## Roadmap & Versioning

v0.0.0 이후 작업은 `feed-prototype/docs/ROADMAP.md`의 버전 트리를 따릅니다.
새 작업을 시작하기 전에 해당 작업이 로드맵의 어느 테마(MIDDLE)에 속하는지
확인하고, 그 테마의 non-goals를 범위에 넣지 않습니다.

버전 규칙:

- `MAJOR.MIDDLE.MINOR`
- MAJOR: 제품 성격이 바뀌는 업그레이드에만 사용. 임의로 올리지 않습니다.
- MIDDLE: 기능 테마 단위. 테마 기반 작업이 `x.y.0`.
- MINOR: 테마 내 개별 기능/개선/수정.
- 현재 버전 라벨은 `feed-prototype/src/config/appVersion.ts`의
  `APP_RELEASE_LABEL`과 일치시킵니다.

작업 단위 규칙:

- 하나의 MINOR 버전은 하나의 집중된 변경 묶음입니다. 여러 MINOR 범위를
  한 번에 작업하지 않습니다.
- 각 MIDDLE 테마의 마지막 MINOR는 `feed-prototype/docs/UX_BACKLOG.md`
  반영용으로 예약되어 있습니다.
- 로드맵에 없는 기능 요청이 오면 먼저 로드맵의 어느 테마에 속하는지
  판단하고, 어울리는 자리가 없으면 로드맵 수정을 먼저 제안합니다.

## External Package Format Freeze

external post package JSON format은 v0.0.0 시점에 동결되었습니다.
외부 생성 프로그램들이 이 형식으로 데이터를 계속 생산하고 있습니다.

규칙:

- 기존 필드의 이름 변경, 삭제, 의미 변경, optional→required 전환을
  금지합니다.
- 새 필드는 optional로만 추가하며, 없을 때 기존 동작이 유지되어야 합니다.
- `external_id` 기반 upsert 동작을 유지합니다. 이미 import된 package의
  재import는 항상 안전해야 합니다.
- timezone 없는 `created_at`(naive datetime)은 허용되는 스펙입니다.
  tz 필수로 바꾸지 않습니다.
- import 코드 수정 시 `feed-prototype/data/external_posts/examples/` 아래
  golden sample package들의 `--dry-run` 통과를 확인합니다.
- format에 영향을 주는 변경이 불가피해 보이면 작업을 멈추고 사용자에게
  먼저 확인합니다.

## Development Guidelines

- TypeScript build를 통과시킵니다.
- 작고 집중된 변경을 선호합니다.
- 불필요한 큰 refactor를 피합니다.
- 새 abstraction을 추가하기 전에 기존 project pattern을 따릅니다.
- component와 type은 general feed와 향후 회사 내부 report feed 모두에 재사용 가능하게 유지합니다.
- equipment-report example은 가능한 data scenario 중 하나로만 취급하고 core domain으로 삼지 않습니다.
- API-mode feature를 구현하면서 mock mode를 제거하지 않습니다.
- future MVP가 명시적으로 범위를 바꾸기 전에는 password, JWT, session, OAuth, formal authorization system을 추가하지 않습니다.
- 외부 import 관련 작업에서 frontend file write logic 또는 actual upload flow는 해당 테마(v0.3.x)가 명시적으로 범위에 넣기 전까지 구현하지 않습니다.

## Verification

code change 후 Vite app directory에서 build를 실행합니다.

```bash
npm run build
```

handoff 전 build가 통과해야 합니다.
