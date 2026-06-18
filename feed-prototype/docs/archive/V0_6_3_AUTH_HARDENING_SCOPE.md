# v0.6.3 Auth Hardening & Cleanup Scope

## Theme Context

v0.6.x는 인증 & 멀티유저 테마입니다. v0.6.0~v0.6.2로 password 로그인 + session,
1:1 identity 운영 정책, profile self-service가 들어왔습니다. v0.6.3은 그 위에서
**인증 표면의 운영성/품질 보강**을 작게 모은 작업입니다. 신규 도메인 기능은 없으며,
v0.6.0 scope가 명시적으로 이연했던 운영 항목과 점검에서 발견된 정리 항목을 닫습니다.

## Goals

- 운영자가 분실된 password를 재설정할 수 있는 dev/operator CLI를 추가합니다.
  (V0_6_0 Password Policy의 "운영자가 seed/dev reset 절차로 임시 password를
  재설정한다"를 실제 경로로 구현)
- API 호출이 session 만료/무효로 401을 받으면 frontend가 active user를 비우고
  로그인 화면으로 자연스럽게 되돌아가게 합니다.
- 로그인 화면(`ApiUserEntry`)에 남은 dead code(이전 lookup 기반 "user not found →
  register" 흐름의 잔재)를 제거합니다.

## Non-goals

```text
write endpoint의 session-only 인가 전환 (아래 "Deferred" 참고 — OAuth/SSO 도입 시 처리)
password self-serve reset / email 복구
멀티 세션 관리 / "다른 기기 로그아웃"
account 탈퇴/비활성 (v0.6.4)
external post package format 변경
```

## 1. Operator password reset CLI (#2)

V0_6_0 Password Policy는 self-serve 복구를 만들지 않고 운영자 reset으로 대신한다고
정했지만, 실제 경로가 없었습니다. seed는 `ensure_user_password`(write-once)를 쓰므로
재-seed로도 기존 password를 덮지 않습니다.

```text
python -m scripts.reset_password --user <id-or-handle> --password <new>
```

- user는 `find_user_by_login`과 같은 규칙으로 id 또는 handle로 해석합니다.
- `set_user_password`로 hash를 덮어쓰고 commit합니다.
- new password가 4자 미만이면 비-zero로 종료합니다.
- user를 못 찾으면 비-zero로 종료합니다.
- API/세션을 거치지 않는 직접 DB 도구입니다(운영자 전용, localhost 가정).

## 2. Frontend session-expiry 처리 (#3)

session TTL은 7일이고 서버에서 만료/삭제될 수 있는데, `useActiveApiUser`는 마운트
시 1회만 session을 확인했습니다. 사용 중 만료되면 이후 호출이 401을 던지고 화면별
generic 에러만 떴습니다.

- API client는 `401`을 받으면 `auth` 경로(`/api/auth/...`)를 제외하고 전역
  `unauthorized` 이벤트를 발생시킵니다. (login/session/password의 401은 정상 흐름)
- `useActiveApiUser`는 이 이벤트를 듣고 active user를 비웁니다. AppShell의 기존
  로그인 게이트가 그대로 로그인 화면을 보여줍니다.
- 순환 import를 피하려고 이벤트 이름은 import가 없는 작은 모듈(`auth/authEvents.ts`)에
  둡니다.

## 3. 로그인 화면 dead code 정리 (#4)

`ApiUserEntry`의 `missingUserPrompt` 상태/`MissingUserPrompt` 타입/"User not found.
Register?" 블록은 항상 `null`로만 설정되어 절대 렌더되지 않습니다(v0.6.0 이전 lookup
흐름 잔재). 로그인은 이제 곧장 `/api/auth/login`을 호출하므로 이 분기가 죽었습니다.
가입은 "Register new API user" 버튼으로 계속 도달 가능하므로 기능 손실 없이 제거합니다.

## Deferred — 비-localhost 이전 시 처리 (기록용)

다음 항목들은 현재 localhost 단일 사용 전제에서는 비용 대비 이득이 없어 미룹니다.
**서버에 띄워 외부에서 접속하는 비-localhost 환경으로 옮길 때(대략 v1.0.0 이후
준비 단계)** 함께 처리합니다.

```text
- session cookie의 secure 플래그를 환경설정으로 분리하고 HTTPS에서 secure=True로 둔다.
  (현재 app/services/auth.py set_session_cookie의 secure=False는 localhost http 전용)
- write endpoint(POST /api/posts, comments, bookmarks, PATCH /api/accounts 등)를
  session 기준 인가로 전환한다. 현재는 body/query의 user_id로 인가하고 frontend만
  로그인 게이트 역할을 한다. OAuth/SSO 도입 시 이 hardening을 함께 묶는다.
- 로그인 화면의 "Available backend users"(전체 user 목록 + id 노출)를 숨긴다.
  지금은 dev 편의가 커서 유지한다.
```

password 변경 후 다른 세션 무효화/안내는 단일 세션 가정상 현 단계 skip합니다.

## Verification

- Operator reset:

```bash
cd feed-prototype/backend
python -m scripts.reset_password --user ari --password temppass
# 로그인: 이전 password 실패 / 새 password 성공 확인
```

- Frontend: 로그인 후 서버에서 session 삭제(또는 만료) → 다음 API 호출 시 로그인
  화면으로 복귀하는지 확인.
- Frontend build:

```bash
npm run build
```
