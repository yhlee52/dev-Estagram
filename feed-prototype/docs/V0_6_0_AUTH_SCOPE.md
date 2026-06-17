# v0.6.0 Auth Scope

## Theme Context

v0.6.x는 인증 & 멀티유저 테마입니다. v0.6.0은 그 기반 작업으로, 현재 API mode의
prototype active user selection을 password 로그인 + server-side session으로
교체합니다.

이 문서는 구현 전에 확정한 scope입니다. v0.6.0은 인증의 최소 기반만 다루며,
User:Account 1:1 원칙은 유지합니다.

## Goals

- Password 기반 로그인 화면을 추가합니다.
- Backend가 user id/handle + password를 검증하고 server-side session cookie를
  발급합니다.
- Frontend의 API mode active user selection을 현재 session user 조회로 대체합니다.
- Logout은 session을 서버에서 폐기하고 client state를 정리합니다.
- 로그인 화면에서 현재 password를 알고 있는 사용자가 password를 변경할 수 있게 합니다.
- Password는 서버에 평문 저장하지 않고 hash로 저장합니다.
- 기존 v0.5.x 협업 데이터의 작성자/소유자/수신자 기준은 user_id 그대로 유지하되,
  v0.6.0 이후에는 request session의 로그인 user를 기준으로 검증합니다.

## Non-goals

```text
OAuth / SSO
JWT access token flow
RBAC / role / formal permission system
User:Account 1:N ownership
다른 account로 대리 작성/대리 profile 수정
password email reset / mail delivery
관리자 console
external post package format 변경
```

## Identity Policy

v0.6.0에서는 User:Account 1:1 원칙을 바꾸지 않습니다.

```text
User
  - 로그인, password, session의 주체
  - comment/bookmark/notification/read state의 주체

Account
  - feed에 표시되는 profile/post/follow/mention identity
  - 각 User와 1:1 대응
```

봇/프로그램/설비 계정도 필요하면 별도의 User와 1:1 Account로 만듭니다. 즉 설비 봇
계정으로 post/comment/follow/bookmark를 하려면 해당 봇 user로 로그인합니다. 한 user가
여러 account를 관리하는 ownership 모델은 v0.6.x 범위에서 채택하지 않습니다.

## Password Policy

- `users` 또는 별도 credential table에 password hash를 저장합니다.
- Seed/test 계정에는 개발용 초기 password를 부여합니다.
- Password 변경은 `current_password` 검증 후 `new_password` hash로 교체합니다.
- Password 분실은 정식 복구 기능을 만들지 않습니다. 프로토타입에서는 운영자가
  seed/dev reset 절차로 임시 password를 재설정하는 수준으로 둡니다.

## Session Policy

- Session은 server-side로 저장하고 browser에는 httpOnly cookie만 둡니다.
- Session 조회 endpoint는 현재 로그인 user와 1:1 account를 반환합니다.
- API write endpoint는 request body/query의 `user_id` 신뢰에서 session user 기준으로
  이동합니다.
- v0.6.0 구현 중 기존 route 호환이 필요하면 migration window를 둘 수 있지만,
  최종 동작은 session user가 authoritative합니다.

## Frontend Scope

- API mode 진입 시 로그인되지 않았으면 login 화면을 보여줍니다.
- 기존 Switch user UI는 API mode에서 login/logout 중심으로 바꿉니다.
- Mock mode의 local demo user switching은 유지할 수 있습니다.
- Me, New Post, comments, bookmarks, notifications는 session user를 기준으로 동작합니다.

## External Package Policy

v0.6.0은 external post package JSON format을 변경하지 않습니다.

- 기존 `accounts[]` + `posts[].account_external_id` 구조를 유지합니다.
- `post.account_external_id`가 DB existing account를 참조할 수 있다는 기존 정책도 유지합니다.
- Import가 paired import User+Account를 만드는 현재 동작은 v0.6.0에서 깨지지 않아야 합니다.
- User credential은 package에 싣지 않습니다.

## Verification

- Backend auth/session route smoke test.
- 로그인 전 API write 접근이 거부되는지 확인.
- 로그인 후 feed, post create/edit/delete, comment, bookmark, notification read flow 확인.
- Password 변경 후 이전 password 실패 / 새 password 성공 확인.
- Golden sample external package `--dry-run` 통과 확인.
- Frontend build:

```bash
npm run build
```
