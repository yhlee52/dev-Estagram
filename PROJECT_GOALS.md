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
- Comment
- Bookmark
- Notification

core type name, shared component name, route, data flow에 설비/리포트 전용 용어를 넣지 않습니다. `Equipment`, `Chamber`, `Sensor`, `Recipe`, `Severity`, `Report` 같은 이름을 피합니다. domain-specific value는 `metadata_json`, `post.metadata`, asset metadata에 넣습니다.

## 현재 릴리즈

현재 릴리즈는 `v1.0.0`(첫 major — 배포 가능한 제품 기준선)입니다. v0.1.x~v0.6.x
테마가 모두 완료되어 전제가 갖춰졌고, v1.0.0 자체는 새 기능 없이 session 기반
write 인가 등 보안 하드닝과 안정화/문서/배포 절차 정리 릴리즈입니다(상세는
`feed-prototype/docs/V1_0_0_RELEASE_SCOPE.md`). 버전 라벨 기준은
`feed-prototype/src/config/appVersion.ts`의 `APP_RELEASE_LABEL`입니다.

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
- v0.3.x (Ingestion 신뢰성): HTTP import API `POST /api/imports`(v0.3.0),
  import batch 이력 API + 최소 UI(v0.3.1), incoming→archive/failed 자동 이동 +
  디렉터리 일괄 처리 CLI + 폴링 Watch(v0.3.2), asset managed storage 복사 opt-in
  (v0.3.3), UX backlog 반영(Me 탭 Load more + 공용 ConfirmDialog, v0.3.4). 테마 완료.
  테마 완료 후 v0.3.5에서 Watch 중 Vite dev server 종료 문제 수정 + 릴리즈 문서 최신화.
- v0.4.x (메타데이터 일급화 & 트리아지): facet 기반 metadata key/value 필터,
  카드 metadata 칩, metadata 값 정렬, UX 정리. 테마 완료.
- v0.5.x (협업): post별 댓글(v0.5.0), 북마크/비공개 메모(v0.5.1), in-app
  알림/mention 수신(v0.5.2), 협업 표면 UX polish와 문서 wrap-up(v0.5.3). 테마 완료.
- v0.6.x (인증 & 멀티유저): password 로그인 + server-side session(v0.6.0),
  User:Account 1:1 identity 운영 정책(v0.6.1), 내 account profile
  self-service(v0.6.2), auth hardening & 운영자 password reset CLI(v0.6.3),
  계정 soft deactivation + post 보존(v0.6.4). 테마 완료.
- v1.0.0 (첫 major): 새 기능 없이 보안 하드닝(write endpoint의 session 기반
  인가, cookie `secure`/CORS 환경설정 분리, 로그인 화면 user 목록 제거,
  import-user 초기 password 임의화)과 안정화/문서/배포 절차 정리 후 태그.

## 다음 테마

다음 테마는 v1.1.x(Rich Asset Experience)입니다. 이미지/plot zoom & pan,
`mime_type` 기반 interactive chart opt-in 렌더링(Vega-Lite/Plotly JSON), PDF
inline preview, CSV preview 확장이 로드맵에 예약되어 있습니다(상세는
`feed-prototype/docs/ROADMAP.md`). v0.3.0부터
mock mode는 "UI 데모 전용 동결" 상태이며, 신규 기능은 API mode에만 추가합니다.

## 개발 원칙

- TypeScript build를 계속 통과시킵니다.
- 작고 집중된 변경을 선호합니다.
- 명시적 요청이 없으면 mock mode를 유지합니다(v0.2.x까지 mock/API 동작 보장).
- frontend data access는 선택된 repository/API mode 뒤에 둡니다.
- backend data access는 FastAPI 뒤에 둡니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.
- `User`와 `Account`는 1:1로 유지합니다(v0.6.1 운영 정책). 1:N ownership 모델은
  도입하지 않습니다.
- API mode 인증은 password 로그인 + server-side session입니다(v0.6.0~). write
  행위자는 request body/query가 아닌 로그인 session에서 도출합니다(v1.0.0).
  mock mode의 active user selection은 UI 데모 상태일 뿐 authentication이 아닙니다.
- external post package JSON format은 동결 상태입니다(기존 필드 변경/삭제/필수화
  금지, 새 필드는 optional로만). 자세한 규칙은 `AGENTS.md`의 External Package
  Format Freeze를 따릅니다.
