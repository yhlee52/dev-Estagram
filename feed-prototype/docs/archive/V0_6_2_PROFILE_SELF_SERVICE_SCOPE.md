# v0.6.2 Profile Self-service Scope

## Theme Context

v0.6.x는 인증 & 멀티유저 테마입니다. v0.6.2는 User:Account 1:1 원칙 위에서, 각
user가 자기 account profile을 직접 관리하는 작업입니다.

v0.6.0의 session 도입 전까지는 기존 active API user id를 사용해 ownership을
검증합니다. v0.6.0 이후에는 같은 정책을 session user 기준으로 옮깁니다.

## Goals

- 로그인/active API user가 자기 1:1 account의 `display_name`, `bio`, `avatar_url`을
  수정할 수 있습니다.
- `account.id`, `account.handle`, `account.kind`, `account.external_id`,
  `account.user_id`는 self-service에서 수정하지 않습니다.
- 다른 user가 account profile을 수정하려 하면 403을 반환합니다.
- Me 탭에서 자기 account profile 편집 UI를 제공합니다.
- 저장 후 Me 화면의 profile header와 내 post 카드의 account 표시가 즉시 갱신됩니다.
- self-service로 저장된 profile은 `profile_source=user`로 표시하고, 이후 import가
  `display_name`, `bio`, `avatar_url`을 덮지 않습니다.
- Profile avatar는 URL을 저장합니다. 실제 파일 업로드는 범위 밖이며, 파일을 둘 경우
  post asset과 분리된 profile 전용 경로(`/assets/profiles/...`)를 사용하도록 권장합니다.

## Non-goals

```text
file upload / drag-and-drop avatar upload
profile image binary storage implementation
handle 변경
account 삭제/비활성화
다른 user/account profile 관리
admin ownership transfer
external post package format 변경
```

## API

```text
PATCH /api/accounts/{account_id}
```

Request body:

```json
{
  "user_id": "demo-user-ari",
  "display_name": "Ari Notes",
  "bio": "Updated profile text",
  "avatar_url": "/assets/profiles/demo-account-ari/avatar.png"
}
```

Rules:

- `user_id`는 현 prototype 단계의 ownership check input입니다.
- `account.user_id != user_id`이면 403입니다.
- `display_name`은 빈 문자열로 저장할 수 없습니다.
- `bio`와 `avatar_url`은 빈 문자열을 `null`로 정규화합니다.
- 저장에 성공하면 `profile_source`는 `user`가 됩니다.
- response는 `AccountRead`입니다.

## Frontend

- API mode Me 탭에 `Account Profile` 편집 panel을 추가합니다.
- Mock mode는 계속 read-only입니다.
- 편집 가능한 값은 display name, bio, avatar URL입니다.
- 저장 성공 후 Me 탭의 현재 account state와 내 post list에 들어 있는 account snapshot을
  함께 갱신합니다.

## External Package Policy

External post package JSON format은 변경하지 않습니다.

- package에 credential/profile ownership 정보를 싣지 않습니다.
- 기존 `accounts[]` import upsert 동작은 유지합니다.
- `profile_source=user`인 account는 import 재실행 시 `display_name`, `bio`,
  `avatar_url`을 보존합니다.
- import는 기존 package 재import 가능성을 깨지 않습니다.

## Verification

- Backend profile regression:

```bash
cd feed-prototype/backend
python -m scripts.check_account_profile
```

이 check는 다음을 확인합니다.

- owner user는 자기 account profile을 수정할 수 있습니다.
- 다른 user는 profile update에서 403을 받습니다.
- handle/kind/user_id는 profile update로 바뀌지 않습니다.
- 빈 bio/avatar URL은 `null`로 정규화됩니다.
- user-edited profile은 같은 package 재import 후에도 보존됩니다.

- Frontend build:

```bash
npm run build
```
