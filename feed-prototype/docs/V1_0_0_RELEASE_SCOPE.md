# v1.0.0 Release Scope (첫 major — 배포 가능한 제품 기준선)

> 상태: **Must-do(1~4) 구현 완료, Stabilization 통과 — 태그 준비 완료.** v0.6.x
> 테마 완료로 v1.0.0 전제가 충족되어 이 마일스톤을 열었고, 아래 보안 하드닝
> Must-do는 코드/문서 반영이 끝났습니다. v1.0.0은 **새 기능을 넣지 않고**,
> 실사용자에게 배포 가능한 기준선을 만드는 안정화·하드닝·문서/배포 절차
> 릴리즈입니다. 회귀 스크립트 12개 실행 확인을 포함한 release checklist가
> 모두 녹색이 되어 `v1.0.0`을 태그합니다.

## 전제 (충족됨)

ROADMAP 기준 v1.0.0은 다음 세 축이 갖춰지면 올립니다 — 현재 모두 완료:

- v0.1.x 읽기 확장성 (pagination/필터/정렬/URL 동기화)
- v0.3.x ingestion 신뢰성 (HTTP/디렉터리/watch/managed storage/batch 이력)
- v0.6.x 인증 & 멀티유저 (password 로그인 + session, 1:1 identity, profile
  self-service, 운영 하드닝, 계정 라이프사이클)

추가로 v0.2(레이아웃)·v0.4(메타데이터 트리아지)·v0.5(협업)도 완료되어 있습니다.

## Must-do (태그 전 필수)

대부분 v0.6.3의 "Deferred — 비-localhost 이전 시 처리"
항목입니다. v1.0.0이 그 "비-localhost 이전" 시점입니다.

### 1. Session 기반 write 인가 (보안 blocker) — 구현 완료

write endpoint(POST `/api/posts`, comments, bookmarks, PATCH/POST
`/api/accounts/{id}`(profile·deactivate), follows, notifications)는 더 이상
request body/query의 `user_id`를 신뢰하지 않습니다. 행위자는 `get_current_user`
의존성이 session cookie에서 도출한 `current_user`이며:

```text
- 로그인 없이 write 시 401 (get_current_user 의존성)
- posts/comments/accounts: 리소스 소유자 필드와 current_user.id가 다르면 403
- bookmarks/notifications/follows: path의 {user_id}와 current_user.id가 다르면 403
  (_require_self 헬퍼)
- GET /api/users, GET /api/users/{id}도 로그인 세션을 요구(자기 자신 한정은 아님)
- request schema에서 user_id 필드 자체를 제거(schemas/feed.py)
```

### 2. Session cookie / 전송 보안 — 구현 완료

```text
- SESSION_COOKIE_SECURE 환경설정(app/core/config.py)으로 cookie secure 플래그 분리.
  기본 False(localhost dev), HTTPS 배포 시 true로 설정.
- CORS_ALLOW_ORIGINS 환경설정(쉼표 구분)으로 배포 host에 맞춘 allow_origins 지정.
  기본값은 Vite dev server origin.
- SameSite=Lax 유지. backend가 localhost 바인딩을 벗어날 때는 HTTPS 종단 + 위 두
  값을 배포 host에 맞게 설정한다는 전제를 문서화.
```

### 3. 로그인 화면 user 목록 노출 제거 — 구현 완료

```text
- ApiUserEntry.tsx에서 "Available backend users"(전체 user 목록 + id) roster 제거.
  로그인 화면은 handle/id + password 입력만 노출.
```

### 4. Import-user 초기 password 정책 재검토 — 구현 완료

```text
- import가 만드는 paired user의 초기 password를 generated handle(예측 가능) 대신
  generate_random_password()의 임의 문자열로 변경(import_external_posts.py).
- 분실/테스트 목적 known password가 필요하면 운영자가
  scripts/reset_password.py로 재설정한다.
```

## Stabilization (태그 전 통과)

Must-do 1의 session 인가 전환에 맞춰, write/self-scoped endpoint를 쓰는 회귀
스크립트 6개(`check_comments` / `check_bookmarks` / `check_notifications` /
`check_account_identity` / `check_account_profile` / `check_account_lifecycle`)는
`scripts/auth_test_utils.py`(`login` / `set_known_password`)로 실제
`/api/auth/login` 세션을 통해 로그인하도록 다시 작성했습니다(body의 `user_id`는
모두 제거). 나머지 6개(`check_batch_history` / `check_metadata_facets` /
`check_managed_asset_copy` / `check_process_incoming` / `check_http_import` /
`check_golden_samples`)는 공개 엔드포인트만 사용해 변경이 필요 없었습니다.

```text
- [x] backend 회귀 12개 전부 green (로컬 PostgreSQL DATABASE_URL로 실행 확인 완료)
- [x] golden sample external package --dry-run 통과 (format 동결 유지)
- [x] clean DB에서 alembic upgrade head + seed 성공
- [x] npm run build / npm run lint 통과
- [x] 로컬 실행/배포 절차 문서가 실제 배포 절차로 동작
- [x] APP_VERSION을 v1.0.0으로 bump
```

## Non-goals

```text
신규 기능 (v1.1.x Rich Asset Experience로)
RBAC / SSO / OAuth / JWT
User:Account 1:N
외부 알림 채널
```

## Decision

Must-do(1~4)는 코드/문서 구현이 끝났고, Stabilization 체크리스트(회귀 스크립트
실행 확인, 배포 절차 문서 검증, 버전 bump)까지 모두 통과했습니다. `v1.0.0`을
"배포 가능한 제품 기준선"으로 태그합니다.
