# AGENTS.md

## Project Identity

이 프로젝트는 `feed-prototype`입니다. Vite + React + TypeScript 기반의 범용 Instagram-like local feed prototype입니다.

이 codebase는 personal feed, bot feed, project feed, 향후 회사 내부 설비 리포트 feed를 지원할 수 있을 만큼 generic해야 합니다. core product model은 설비 전용이 아닙니다.

## Current Release Docs

현재 릴리즈는 `v0.4.2`(메타데이터 일급화 & 트리아지 테마 완료)이며
`feed-prototype/src/config/appVersion.ts`의 `APP_RELEASE_LABEL`이 기준입니다.
v0.4.x 테마는 v0.4.0(facet 기반 필터) → v0.4.1(카드 metadata 칩 & 값 정렬) →
v0.4.2(UX backlog 반영, 테마 마지막 MINOR)로 **완료**되었습니다. 다음 테마는
v0.5.x(협업 — Annotation & Collaboration)이며, 진입 판단/후보 계획은
`feed-prototype/docs/V0_5_X_COLLABORATION_PLAN.md`에 있습니다(아직 미착수).
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
참고합니다. v0.4.x 테마가 완료되어 그 scope 문서
(`V0_4_0_FACET_FILTER_SCOPE.md` ~ `V0_4_2_UX_BACKLOG_SCOPE.md`)와 진입 판단/후보
계획(`V0_4_X_METADATA_PLAN.md`)은 완료 테마 v0.1.x~v0.3.x와 함께
`feed-prototype/docs/archive/`로 이동했습니다. 다음 테마(v0.5.x 협업 — Annotation
& Collaboration)의 진입 판단·후보 계획은
`feed-prototype/docs/V0_5_X_COLLABORATION_PLAN.md`에 있으며, 각 MINOR 확정 scope는
착수 시 `docs/`에 `V0_5_*_SCOPE.md`로 새로 작성합니다. 과거 MVP별 테스트 절차도
`feed-prototype/docs/archive/` 아래에 historical reference로 보관됩니다.
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

v0.0.0 기준선은 MVP1-MVP12로 구축되었고, 그 위에 v0.1.x~v0.4.x 테마가 쌓였습니다.
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
- 현 단계에서는 각 `User`에 정확히 하나의 `Account`가 대응합니다(1:N은 v0.6.x).
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

v0.3.x — Ingestion 신뢰성 (Ingestion Hardening):

- v0.3.0: HTTP import API. `POST /api/imports`가 기존 `import_payload`를 재사용해
  동일한 package JSON을 HTTP로 수신(`?dry_run=true` 지원). 스키마 위반 422 /
  payload 의미 오류 400 / 그 외 500. 선택적 `IMPORT_API_TOKEN` 헤더 보호(미설정 시
  검사 없음). CLI import workflow 유지.
- v0.3.1: Import batch 이력. 신규 `import_batch` 테이블(migration `0006`)에 import
  사건을 기록(`external_id` upsert, status success/failed, 사건 카운트 스냅샷 +
  `import_count`). 기록은 서비스 계층(`import_payload` 성공=원자적, 실패=별도
  트랜잭션)에서 처리해 CLI/HTTP 양쪽 자동 반영. dry_run은 batch를 쓰지 않음
  (dry-run 회귀 스크립트의 "DB 미기록" 보장 유지). 조회 `GET /api/imports`(목록,
  사건 스냅샷 + live post 수)·`GET /api/imports/{batch_external_id}`(상세 + 귀속
  post, 미존재 404). 최소 UI는 신규 `/imports` 라우트(목록/상세), **API mode 전용**.
  package format 변경 없음.
- v0.3.2: 자동 이동 + 디렉터리 일괄 처리 CLI + 폴링 Watch. 신규
  `app/services/process_incoming.py`가 `data/external_posts/incoming/`을 스캔해
  package(단일 `.json` 또는 `feed_posts.json` 포함 디렉터리)마다 `run_import`를
  호출하고, 성공→`archive/` / 실패→`failed/`로 이동(이름 충돌 시 타임스탬프
  접미사, 덮어쓰지 않음). 한 package 실패가 나머지를 막지 않음. `--watch
  --interval N`은 단순 폴링 루프(외부 의존성 없음). `--dry-run`은 DB·파일 모두
  무변경. 이동은 이 경로에서만 발생(단일 파일 `--input` CLI와 HTTP import는 파일
  이동 없음). `Settings.external_posts_dir` 설정 추가. DB 스키마/마이그레이션 없음,
  frontend 변경 없음, package format 변경 없음. asset managed storage 복사는 v0.3.3.
- v0.3.3: asset managed storage 복사(opt-in). 신규 `app/services/asset_storage.py`가
  asset url이 **상대 로컬 경로**일 때만 패키지 디렉터리 기준으로 파일을 해석해
  `public/assets/managed/<batch>/<asset>`(frontend가 이미 서빙하는 트리)로 복사하고
  DB url을 `/assets/managed/...`로 재작성. `Settings.manage_asset_storage`(env
  `MANAGE_ASSET_STORAGE`, 기본 OFF) 단일 토글. 복사는 디스크 패키지가 있는
  CLI/`process_incoming` 경로에만 적용(`import_payload`에 `asset_source_dir` 주입,
  HTTP import은 `None`이라 미적용). `/assets/...`·`http(s)://`·`//` url은 무손상,
  원본 누락·디렉터리 탈출·복사 실패는 원본 url 유지(import 실패 없음). 목적지는
  결정적이라 재import 시 덮어씀(누적 없음). DB 스키마/마이그레이션 없음, package
  format 변경 없음, frontend 변경 없음(재작성된 url도 기존과 동일하게 렌더링).
- v0.3.4: UX backlog 반영(테마 마지막 MINOR). (1) Me 탭(API 모드) 내 post를
  전량 한 번에 렌더하던 것을 `MY_POSTS_PAGE_SIZE`(20)개씩 "Load more"로 점진
  렌더(클라이언트 사이드 윈도우). 활동 요약이 정확한 총계를 보여줘 어차피 전량
  fetch가 필요하므로 서버 cursor 대신 렌더만 윈도잉(백엔드 변경 없음). (2) post
  삭제 확인의 `window.confirm`을 신규 공용 `ConfirmDialog`(오버레이/Escape/
  백드롭/포커스 제어)로 교체하고 `MyPostCard`·`PostDetail`에 적용. DB/format
  변경 없음. 이로써 v0.3.x(Ingestion 신뢰성) 테마 완료.
- v0.3.5: 테마 완료 후 운영 안정화 patch. `process_incoming --watch` 실행 중
  managed storage 복사(`public/assets/managed/`)와 `data/external_posts/`의
  package 이동으로 발생하는 파일 churn에 Vite dev server의 watcher가 반응해
  (특히 Windows의 copy/rename 경합) dev server가 종료되던 문제를 `vite.config.ts`의
  `server.watch.ignored`로 두 런타임 데이터 경로를 제외해 해결(파일은 계속 serve,
  불필요한 full reload도 제거). 릴리즈 runbook/checklist를 현재 버전 기준으로
  재작성. 코드 변경은 `vite.config.ts` 1개, DB/format/frontend 동작 변경 없음.

v0.4.x — 메타데이터 일급화 & 트리아지 (Metadata-first Reading):

- v0.4.0: facet 기반 필터(테마 기반). 데이터에서 파생한 distinct metadata
  key/value를 빈도순으로 반환하는 `GET /api/metadata/keys`·`GET /api/metadata/values`
  (`get_top_tags` 집계 패턴 재사용, `jsonb_object_keys`/`->>`, `limit` 기본 20).
  `PostFilters.metadata_match`(`contains` 기본 = 기존 ILIKE 부분일치 / `exact` =
  정확일치) 추가로 facet 선택은 정확일치, 자유 입력은 기존 동작 유지(회귀 안전).
  필터 패널은 자유 입력 옆에 key 드롭다운 → value 드롭다운/칩(facet 선택 시
  `metadata_key`/`metadata_value` 채우고 `metadata_match=exact`). **API mode 전용**,
  DB 스키마/format 변경 없음. 회귀 스크립트 `scripts/check_metadata_facets.py`.
- v0.4.1: 카드 metadata 노출 & 값 정렬. `sort=metadata_asc|metadata_desc` +
  `sort_metadata_key`로 `(metadata_json ->> key)` 텍스트 사전순 정렬(그 key를 가진
  non-null post 한정, `post id` tie-breaker, cursor를 정렬 모드별 자기완결 인코딩으로
  확장 — 값에 `|` 포함 케이스 안전). pinned keys: 사용자가 고른 key를 `FeedCard`에
  칩으로 고정(`usePinnedMetadataKeys`, localStorage + storage/custom event 동기화,
  URL 동기화는 범위 밖). 칩/정렬 모두 generic key-value(도메인 의미 모름).
  숫자 인식 정렬은 테마 후속으로 보류. **API mode 전용**, 기본 sort=newest 동작 불변.
- v0.4.2: UX backlog 반영(테마 마지막 MINOR). (1) 카드 metadata 중복 제거 —
  `MetadataSummary`에 `excludeKeys` 추가하고 `FeedCard`가 pinned key를 넘겨 칩과
  summary 이중 표시 제거(`PinnedMetadataChips`를 `pinnedKeys` prop화). (2) metadata
  값 정렬 시 그 key 보유 post만 보여 결과 수가 조용히 줄어드는 데 대한 안내 문구를
  필터 패널에 추가. (3) 테마 완료 문서 일괄 정리. 기능 추가 없는 폴리시+문서 중심.
  이로써 v0.4.x(메타데이터 일급화 & 트리아지) 테마 완료.

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
