# v0.6.4 Account Lifecycle Scope

> 상태: **구현 완료.** v0.6.3까지 위에 계정 "탈퇴/비활성 + post 보존"을 구현했습니다.
> ROADMAP v0.6.x 제약의 "비활성/삭제 시 post 처리 정책(보존/비활성/숨김)은 v0.6.x
> scope에서 별도 확정한다"를 이 문서에서 확정하고 반영했습니다.

## Theme Context

v0.6.x는 인증 & 멀티유저 테마입니다. v0.6.0~v0.6.3으로 로그인/세션/identity/profile/
운영 보강이 끝났고, 남은 라이프사이클 공백("계정을 그만 쓰게 되는" 경로)을 v0.6.4가
닫습니다. post는 account FK로 묶여 있어 무삭제로는 정리되지 않으므로 **post를 보존하면서
계정을 비활성화**합니다.

## Decision (확정 정책)

```text
탈퇴 = 하드 삭제가 아니라 soft deactivation (post 보존)
```

- 비활성 상태는 **`accounts.deactivated_at`(nullable timestamp)** 에 저장합니다.
  null = active. User:Account가 1:1(v0.6.1)이라 user/account 라이프사이클은 동치이며,
  discovery 필터와 `AccountRead` 노출이 join 없이 단순해지고 로그인만 account 1회
  조회를 더합니다. (scope 초안의 "User에 둔다"를 1:1 동치 하에 account-centric으로 확정)
- 비활성 user는 로그인할 수 없고(`POST /api/auth/login` → 403), 비활성 시 해당 user의
  모든 `user_sessions`를 폐기해 진행 중 로그인도 즉시 끊깁니다.
- 비활성 account는 discovery(`GET /api/accounts`)에서 숨깁니다. `?include_deactivated=true`
  로만 노출합니다.
- **post/comment/bookmark 등 기존 데이터는 보존**합니다. 프로필·post 조회는 계속
  가능하며(`GET /api/accounts/{id}`, `.../posts`), UI는 "Deactivated" 배지로 표시합니다.
- 1:1 원칙(v0.6.1)을 유지합니다.

## 확정된 세부 (구현 결과)

```text
- 비활성 account의 post: 숨기지 않고 보존·노출. discovery(목록)에서만 account 제외.
- handle 재사용: 비활성 동안에도 handle/external_id 점유 유지(레코드 보존) = 재사용 불가.
- follow: 기존 follow는 보존. 비활성 account를 새로 follow하면 409로 차단.
- bookmark/notification: 기존 데이터 보존(별도 삭제/숨김 없음 — post가 보존되므로 유효).
- self-service 진입: Me 탭 "Danger zone" + 공용 ConfirmDialog. 성공 시 로그아웃되어
  로그인 화면으로 복귀(세션이 서버에서 폐기되었으므로).
- 재활성화: 비활성 user는 로그인 불가하므로 self-service 불가. 운영자 CLI
  `scripts/reactivate_user.py`로만 `deactivated_at`을 해제.
```

## API

```text
POST /api/accounts/{account_id}/deactivate    body: {"user_id": "<owner>"}
GET  /api/accounts?include_deactivated=true    (discovery escape hatch)
```

- `account.user_id != user_id`이면 403(소유자만 비활성화).
- 성공 시 `deactivated_at` 설정 + 해당 user의 모든 session 폐기. 이미 비활성이면
  최초 timestamp를 유지(idempotent). response는 `AccountRead`(`deactivated_at` 포함).

## Non-goals

```text
하드 삭제 / GDPR 스타일 완전 파기
계정 소유권 이전 (ownership transfer)
운영자 admin console / 일괄 관리 UI
self-service 재활성화 (운영자 CLI만)
bookmark/notification의 적극적 suppression
User:Account 1:N
external post package format 변경
```

## External Package Policy

External post package JSON format은 변경하지 않습니다.

- import는 기존처럼 account/post를 upsert합니다.
- 비활성 상태는 앱 내부 라이프사이클이며 package에 싣지 않습니다.
- **재import는 `deactivated_at`을 건드리지 않습니다**(upsert update 경로가 handle/profile만
  갱신). 즉 재import가 비활성 account를 자동으로 되살리지 않습니다. 복원은 운영자 CLI만.

## Verification

```bash
cd feed-prototype/backend
python -m scripts.check_account_lifecycle
```

이 check는 다음을 확인합니다(모두 통과).

- 소유자만 비활성화(타 user 403), `deactivated_at` 설정.
- 비활성 후 로그인 403 + 이전 session 무효(401).
- discovery에서 제외되되 `?include_deactivated=true`로 노출, 프로필·post는 보존·조회 가능.
- 기존 follow 보존 + 비활성 account 신규 follow 409.
- 운영자 CLI 재활성화 후 로그인/discovery 복귀.

추가:

- Golden sample external package `--dry-run` 통과(format 동결 유지).
- Frontend build (`npm run build`).
