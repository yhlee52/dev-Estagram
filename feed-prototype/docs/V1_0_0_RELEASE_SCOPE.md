# v1.0.0 Release Scope (첫 major — 배포 가능한 제품 기준선)

> 상태: **개시(open).** v0.6.x 테마 완료로 v1.0.0 전제가 충족되어 이 마일스톤을 엽니다.
> v1.0.0은 **새 기능을 넣지 않고**, 실사용자에게 배포 가능한 기준선을 만드는 안정화·
> 하드닝·문서/배포 절차 릴리즈입니다. 아래 must-do가 통과하고 release checklist가
> 녹색일 때만 `v1.0.0`을 태그합니다.

## 전제 (충족됨)

ROADMAP 기준 v1.0.0은 다음 세 축이 갖춰지면 올립니다 — 현재 모두 완료:

- v0.1.x 읽기 확장성 (pagination/필터/정렬/URL 동기화)
- v0.3.x ingestion 신뢰성 (HTTP/디렉터리/watch/managed storage/batch 이력)
- v0.6.x 인증 & 멀티유저 (password 로그인 + session, 1:1 identity, profile
  self-service, 운영 하드닝, 계정 라이프사이클)

추가로 v0.2(레이아웃)·v0.4(메타데이터 트리아지)·v0.5(협업)도 완료되어 있습니다.

## Must-do (태그 전 필수)

대부분 `archive/V0_6_3_AUTH_HARDENING_SCOPE.md`의 "Deferred — 비-localhost 이전 시 처리"
항목입니다. v1.0.0이 그 "비-localhost 이전" 시점입니다.

### 1. Session 기반 write 인가 (보안 blocker)

현재 write endpoint(POST `/api/posts`, comments, bookmarks, PATCH/POST
`/api/accounts/{id}`(profile·deactivate), follows)는 **request body/query의
`user_id`로 행위자를 신뢰**하고 frontend만 로그인 게이트 역할을 합니다. 비-localhost
배포 전에 행위자를 **session에서 도출**하도록 바꿉니다.

```text
- 각 write를 session user 기준으로 인가 (body user_id는 무시하거나 session과 일치 검증)
- 로그인 없이 write 시 401
- 다른 user 행세 시 403
- v0.5.x 협업 데이터(comment/bookmark/notification) 소유권도 session 기준으로 검증
```

### 2. Session cookie / 전송 보안

```text
- set_session_cookie의 secure 플래그를 환경설정으로 분리, HTTPS에서 secure=True
- SameSite 정책 재검토, 배포 host에 맞춘 CORS allow_origins 설정
- backend가 localhost 바인딩을 벗어날 때의 바인딩/프록시 전제 문서화
```

### 3. 로그인 화면 user 목록 노출 제거

```text
- 로그인 화면의 "Available backend users"(전체 user 목록 + id) 숨김 또는 게이트
```

### 4. Import-user 초기 password 정책 재검토

```text
- import가 만드는 paired user의 초기 password가 generated handle로 예측 가능.
  비-localhost에서는 이 계정들의 로그인 정책/초기 password 처리를 정한다.
```

## Stabilization (태그 전 통과)

```text
- backend 회귀 전부 green:
  check_comments / check_bookmarks / check_notifications /
  check_account_identity / check_account_profile / check_account_lifecycle /
  check_batch_history / check_metadata_facets / check_managed_asset_copy /
  check_process_incoming / check_http_import / check_golden_samples
- golden sample external package --dry-run 통과 (format 동결 유지)
- clean DB에서 alembic upgrade head + seed 성공
- npm run build / npm run lint 통과
- RELEASE_0_0_RUNBOOK.md / RELEASE_0_0_CHECKLIST.md가 실제 배포 절차로 동작
- APP_VERSION을 v1.0.0으로 bump
```

## Non-goals

```text
신규 기능 (v1.1.x Rich Asset Experience로)
RBAC / SSO / OAuth / JWT
User:Account 1:N
외부 알림 채널
```

## Decision

위 Must-do(1~4)와 Stabilization이 모두 통과하면 `v1.0.0`을 태그합니다. 그 전에는
v1.0.0을 "배포 가능"으로 표기하지 않습니다. 1번(session 기반 write 인가)이 가장
큰 단일 작업이며, 자연히 v1.0.0의 첫 작업 항목입니다.
