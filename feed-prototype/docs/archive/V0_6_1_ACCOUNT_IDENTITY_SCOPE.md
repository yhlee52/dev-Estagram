# v0.6.1 Account Identity Scope

## Theme Context

v0.6.x는 인증 & 멀티유저 테마입니다. v0.6.1은 User:Account 관계를 1:N으로
확장하지 않고, **1:1 identity 원칙을 운영 정책으로 고정**하는 작업입니다.

v0.6.0의 password login + server-side session이 들어오면 현재 active API user
selection은 session user로 교체됩니다. v0.6.1은 그 다음 단계에서 "로그인 주체와
feed identity가 어떻게 대응하는가"를 명확히 합니다.

## Decision

```text
User 1개 : Account 1개
```

- User는 login/password/session/comment/bookmark/notification/read state의 주체입니다.
- Account는 feed에 표시되는 profile/post/follow/mention identity입니다.
- 봇/프로그램/설비 계정도 별도의 로그인 User와 1:1 Account로 표현합니다.
- 계정 전환은 "다른 User로 로그인"하는 문제로 취급합니다.

## Goals

- 현재 코드의 1:1 구조를 유지합니다.
- `accounts.user_id`의 unique 제약을 유지합니다.
- import가 외부 account마다 deterministic paired import User+Account를 생성하는
  현재 동작을 유지합니다.
- post create/edit/delete는 계속 active/session user의 1:1 account를 기준으로
  소유권을 판단합니다.
- v0.6.0 이후 comment/bookmark/notification도 session user 기준으로 검증하되,
  account 대리 행동 모델은 만들지 않습니다.
- 1:1 identity 정책을 검증하는 backend regression check를 둡니다.

## Non-goals

```text
User:Account 1:N ownership
acting account selector
로그인 user가 다른 account로 대리 post/comment/follow/bookmark 수행
봇 계정 여러 개를 한 user가 관리하는 admin UI
RBAC / role / permission matrix
external package format 변경
```

## Bot / Program / Facility Accounts

봇/프로그램/설비 계정은 product core model에 별도 도메인 type을 추가하지 않습니다.
필요하면 다음처럼 일반 User+Account fixture로 표현합니다.

```text
user-line-a-bot      -> account-line-a-bot
user-analysis-bot    -> account-analysis-bot
user-yonghoon        -> account-yonghoon
```

이 계정들로 post/comment/follow/bookmark를 하려면 해당 user로 로그인합니다. 이렇게
하면 v0.5.x에서 만든 user-scoped collaboration data와 자연스럽게 이어집니다.

## External Package Policy

External post package JSON format은 변경하지 않습니다.

- `accounts[]`는 계속 imported account profile data를 담습니다.
- `posts[].account_external_id`는 계속 `accounts[].external_id` 또는 DB existing
  account를 참조합니다.
- import service는 account external id에서 deterministic import user id와 account id를
  만들며, 둘을 1:1로 연결합니다.
- password/session/credential data는 package에 싣지 않습니다.

## Verification

- Backend identity regression:

```bash
cd feed-prototype/backend
python -m scripts.check_account_identity
```

이 check는 다음을 확인합니다.

- import account마다 paired import User+Account가 생성됩니다.
- 각 imported user는 정확히 하나의 account를 가집니다.
- post create는 user의 1:1 account에 귀속됩니다.
- 다른 user는 그 post를 edit/delete할 수 없습니다.
- owner user는 그 post를 edit/delete할 수 있습니다.

- Frontend build:

```bash
npm run build
```
