# 계정 관리 명령어 (Account Management)

feed-prototype의 user/account를 다루는 **모든 명령**을 모았습니다. 인증 & 멀티유저
테마(v0.6.x)에서 추가된 것들입니다.

## 개요 (먼저 알아둘 것)

- **User : Account = 1 : 1.** User는 로그인/세션/password/comment·bookmark·notification의
  주체이고, Account는 feed에 보이는 profile/post/follow identity입니다.
- 명령은 두 부류입니다.
  - **Operator CLI**: 서버에서 직접 DB를 다루는 운영자 도구(`feed-prototype/backend`에서
    `DATABASE_URL`이 대상 DB를 가리키는 상태로 실행). 인증/세션을 거치지 않습니다.
  - **HTTP API**: 앱(프론트엔드)이 쓰는 self-service 경로. `curl`로도 호출 가능합니다.
- 초기 password 규칙: **seed user = handle과 동일**(`ari`/`mika`/`nova`), **import로
  생성된 user = generated handle**(`import.<slug>`). password 부여는 write-once라
  재-seed/재import로는 기존 password를 덮지 않습니다.

> API base host와 앱을 여는 host를 맞추세요(둘 다 `localhost`). 다르면 세션 쿠키
> (SameSite=Lax)가 cross-site로 취급돼 드랍되고 로그인이 유지되지 않습니다.
> 자세한 내용은 `RELEASE_0_0_RUNBOOK.md` 참고.

---

## Operator CLI (운영자)

`feed-prototype/backend`에서, `DATABASE_URL`이 대상 DB(예: `feed_dev`/`feed_ops`)를
가리키는 상태로 실행합니다.

### Seed user/account 생성 (write-once)

```bash
python -m app.services.seed
```

seed user(`ari`/`mika`/`nova`, password=handle)와 1:1 account, 데모 post를 만듭니다.
이미 있으면 덮지 않습니다(있으면 그대로 둠). 따라서 **password 복구 용도로는 쓸 수
없습니다**(아래 reset 사용).

### Password 재설정 (v0.6.3)

```bash
python -m scripts.reset_password --user <id-or-handle> --password <new>
# 예) python -m scripts.reset_password --user ari --password newpass
```

- `--user`는 user id 또는 handle로 해석합니다(로그인과 같은 규칙).
- credential이 없던 user(예: v0.6.0 이전 import user)에게도 새로 password를 부여합니다.
- `<new>`는 4자 이상이어야 합니다. user를 못 찾으면 비-zero 종료.

### 계정 재활성화 (v0.6.4)

```bash
python -m scripts.reactivate_user --user <id-or-handle>
# 예) python -m scripts.reactivate_user --user ari
```

비활성화된 계정의 `deactivated_at`를 해제해 로그인/노출을 복구합니다. 비활성 user는
스스로 로그인할 수 없으므로 **재활성화는 운영자 전용**입니다. post는 비활성화 동안에도
삭제되지 않았으므로 별도 복구가 필요 없습니다.

---

## Self-service / HTTP API

앱이 사용하는 경로입니다. 로그인·세션·password 변경은 **세션 쿠키**가 필요하고,
profile 수정·비활성화는 현재 prototype 단계에서 본문의 `user_id`로 소유권을 확인합니다
(세션 기반 인가 전환은 v1.0.0 하드닝 항목 — `V1_0_0_RELEASE_SCOPE.md`).

base URL은 `http://localhost:8000` 가정.

### 신규 가입 (user + 1:1 account 생성)

```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  --data '{"handle":"new_user","password":"secret","display_name":"New User"}'
```

handle은 3~32자 소문자/숫자/`_`/`-`. password는 4자 이상. 성공 시 user와 같은 handle의
1:1 account가 함께 생성됩니다. 프론트엔드 로그인 화면의 "Register"가 이 API를 씁니다.

### 로그인 / 현재 세션 / 로그아웃

```bash
# 로그인 → 쿠키 저장 (login은 id 또는 handle)
curl -c cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  --data '{"login":"ari","password":"ari"}'

# 현재 로그인 user + 1:1 account 조회
curl -b cookies.txt http://localhost:8000/api/auth/session

# 로그아웃 (세션 폐기)
curl -b cookies.txt -X POST http://localhost:8000/api/auth/logout
```

비활성화된 계정은 로그인 시 403입니다.

### 본인 password 변경 (현재 password 검증)

```bash
curl -b cookies.txt -X PATCH http://localhost:8000/api/auth/password \
  -H "Content-Type: application/json" \
  --data '{"current_password":"ari","new_password":"newpass"}'
```

현재 password가 틀리면 403, 새 password가 4자 미만이면 422.

### 내 account profile 수정 (소유자만, v0.6.2)

```bash
curl -X PATCH http://localhost:8000/api/accounts/demo-account-ari \
  -H "Content-Type: application/json" \
  --data '{"user_id":"demo-user-ari","display_name":"Ari Notes","bio":"hello","avatar_url":"/assets/profiles/ari.png"}'
```

`display_name`/`bio`/`avatar_url`만 수정 가능. `handle`/`kind`/`user_id` 같은 식별자는
고정. `account.user_id != user_id`면 403. 빈 bio/avatar는 null로 정규화. 앱에서는 Me 탭
"Account Profile" 패널이 이 API를 씁니다.

### 계정 비활성화 (소유자만, v0.6.4)

```bash
curl -X POST http://localhost:8000/api/accounts/demo-account-ari/deactivate \
  -H "Content-Type: application/json" \
  --data '{"user_id":"demo-user-ari"}'
```

성공 시 `deactivated_at` 설정 + 해당 user의 모든 세션 폐기. 이후 로그인 차단, discovery
목록에서 제외. **post는 보존**됩니다. 앱에서는 Me 탭 "Danger zone"이 이 API를 씁니다.
복구는 위 `reactivate_user` CLI(운영자)로만 가능합니다.

### user / account 조회

```bash
curl http://localhost:8000/api/users            # user 목록
curl http://localhost:8000/api/users/demo-user-ari
curl http://localhost:8000/api/accounts          # account 목록 (비활성 제외)
curl "http://localhost:8000/api/accounts?include_deactivated=true"  # 비활성 포함
curl http://localhost:8000/api/accounts/demo-account-ari
```

---

## 아직 없는 기능 (의도된 공백)

| 원하는 것 | 현재 상태 | 대안 |
|---|---|---|
| 계정 **완전 삭제**(hard delete) | 없음 | soft deactivation(비활성화)만 제공 |
| **본인** 재활성화 | 없음 | 운영자 `reactivate_user` CLI |
| 운영자 **비활성화** CLI | 없음 | self-service `POST .../deactivate` API |
| email 기반 password **복구** | 없음 | 운영자 `reset_password` CLI |
| 다른 user/account 대리 관리 | 없음 (1:1·소유자 한정) | 범위 밖 (v0.6.x non-goal) |

write endpoint를 세션 기반 인가로 전환하는 작업과 비-localhost 배포 하드닝은
`V1_0_0_RELEASE_SCOPE.md`에 정리되어 있습니다.

## 관련 문서

- `archive/V0_6_0_AUTH_SCOPE.md` — password 로그인 + 세션
- `archive/V0_6_2_PROFILE_SELF_SERVICE_SCOPE.md` — profile self-service
- `archive/V0_6_3_AUTH_HARDENING_SCOPE.md` — 운영자 reset / 이연 항목
- `archive/V0_6_4_ACCOUNT_LIFECYCLE_SCOPE.md` — 비활성화/재활성화 + post 보존
- `RELEASE_0_0_RUNBOOK.md` / `RELEASE_0_0_CHECKLIST.md` — 실행/검증 절차
