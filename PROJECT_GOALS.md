# PROJECT_GOALS.md

## 프로젝트 목표

`feed-prototype`은 Vite + React + TypeScript 기반의 범용 Instagram-like local feed prototype입니다.

core product model은 generic하게 유지해야 합니다. 같은 feed model이 personal feed, bot feed, project feed, 향후 회사 내부 설비 리포트 feed를 지원할 수 있어야 하며, 설비 리포트가 architecture의 기반이 되어서는 안 됩니다.

core concept:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

core type name, shared component name, route, data flow에 설비/리포트 전용 용어를 넣지 않습니다. `Equipment`, `Chamber`, `Sensor`, `Recipe`, `Severity`, `Report` 같은 이름을 피합니다. domain-specific value는 `metadata_json`, `post.metadata`, asset metadata에 넣습니다.

## 현재 릴리즈

현재 릴리즈는 `v0.3.0`(HTTP Import API — v0.3.x Ingestion 신뢰성 테마 진입)입니다.
버전 라벨 기준은 `feed-prototype/src/config/appVersion.ts`의 `APP_RELEASE_LABEL`입니다.

이 문서는 제품의 변하지 않는 목표/원칙을 정의합니다. 버전별 테마와 순서는
`feed-prototype/docs/ROADMAP.md`, 단계별 상세 이력은 `AGENTS.md`의
"Completed Scope History", 각 버전 상세 scope는 `feed-prototype/docs/`의
`V0_x_y_*_SCOPE.md` 문서를 참고합니다.

## 완료된 범위 요약

v0.0.0 기준선은 MVP1-MVP12로 구축되었습니다.

- MVP1-MVP4: local/static feed (mock JSON + localStorage overlay).
- MVP5: backend/database skeleton (FastAPI + PostgreSQL + SQLModel + Alembic).
- MVP6: frontend API read mode (`mock`/`api`).
- MVP7 / MVP7.5: API follow/unfollow, API local user/account registration.
- MVP8: API personal post create/delete (own 1:1 account ownership check).
- MVP9: post asset + metadata management (`assets`/`tags`/`metadata_json`).
- MVP10: external post ingestion pipeline (`external_id` upsert, `--dry-run`).
- MVP11: metadata/tag/asset filter & search (read API query parameters).
- MVP12: asset viewer enhancement (thumbnail+lightbox, `sort_order`, CSV preview).

v0.0.0 위에 쌓인 테마:

- v0.1.x (탐색과 발견): pagination·날짜 필터·정렬·URL 동기화(v0.1.0),
  해시태그 칩(v0.1.1), `#tag` 검색·자동완성(v0.1.2), `@mention` 렌더링(v0.1.3).
- v0.2.x (레이아웃 & UI 개편): 데스크톱 3컬럼(v0.2.0), 헤더 정리·UserMenu(v0.2.1),
  Explore/Accounts 탭 활성화(v0.2.2), Me 탭 + UX backlog 반영(v0.2.3).
- v0.3.x (Ingestion 신뢰성): HTTP import API `POST /api/imports`(v0.3.0). 진행 중.

## 다음 테마

진행 중인 테마는 v0.3.x(Ingestion 신뢰성)입니다. v0.3.0(HTTP Import API) 완료,
다음 후보는 v0.3.1(import batch 이력 API + 최소 UI), v0.3.2(자동 이동/watch/
asset 복사)입니다. 진입 판단과 0.3.0~0.3.2 후보는
`feed-prototype/docs/V0_3_X_INGESTION_PLAN.md`를 참고합니다. v0.3.0부터 mock
mode는 "UI 데모 전용 동결" 상태가 되며, 신규 기능은 API mode에만 추가합니다.

## 개발 원칙

- TypeScript build를 계속 통과시킵니다.
- 작고 집중된 변경을 선호합니다.
- 명시적 요청이 없으면 mock mode를 유지합니다(v0.2.x까지 mock/API 동작 보장).
- frontend data access는 선택된 repository/API mode 뒤에 둡니다.
- backend data access는 FastAPI 뒤에 둡니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.
- 현 단계에서는 `User`와 `Account`를 1:1로 유지합니다(1:N은 v0.6.x).
- active API user selection은 local prototype state이며 authentication이 아닙니다.
- external post package JSON format은 동결 상태입니다(기존 필드 변경/삭제/필수화
  금지, 새 필드는 optional로만). 자세한 규칙은 `AGENTS.md`의 External Package
  Format Freeze를 따릅니다.
