# v0.6.4 Account Lifecycle Scope (계획 / 미구현)

> 상태: **scope 확정 단계, 구현 전.** 이 문서는 v0.6.3까지 반영된 코드 위에서
> 다음 MINOR로 진행할 "계정 탈퇴/비활성 + post 보존"의 scope를 잡습니다.
> ROADMAP v0.6.x 제약의 "비활성/삭제 시 post 처리 정책(보존/비활성/숨김)은
> v0.6.x scope에서 별도 확정한다"를 이 문서에서 확정합니다.

## Theme Context

v0.6.x는 인증 & 멀티유저 테마입니다. v0.6.0~v0.6.3으로 로그인/세션/identity/
profile/운영 보강이 끝났습니다. 남은 라이프사이클 공백은 "계정을 그만 쓰게 되는"
경로입니다. post는 account FK로 묶여 있어 무삭제로는 정리되지 않으므로, **post를
보존하면서 계정을 비활성화**하는 정책을 정합니다.

## Decision (확정 정책)

```text
탈퇴 = 하드 삭제가 아니라 soft deactivation (post 보존)
```

- User에 비활성 상태를 둡니다(`deactivated_at` nullable 권장; null이면 active).
- 비활성 user는 로그인할 수 없고, 기존 session은 폐기합니다.
- 비활성 user의 1:1 account는 feed/discovery/follow 추천에서 숨깁니다.
- 그러나 **post/comment 등 기존 협업 데이터는 보존**합니다. 이미 작성된 글이
  사라지지 않게 하는 것이 이 정책의 핵심입니다.
- 1:1 원칙(v0.6.1)을 유지합니다. 라이프사이클도 user 단위로 다루고 account는 따라갑니다.

## Goals

- User deactivate API: 본인(또는 운영자)이 자기 user를 비활성화.
- 비활성 시 해당 user의 모든 `user_sessions` 폐기 + 로그인 차단.
- 비활성 account는 목록/검색/팔로우 추천에서 제외. 기존 post는 보존하되 작성자
  표기는 "deactivated/archived account"로 다룬다(정확한 표기는 구현 시 확정).
- (선택) 운영자 재활성화(reactivate) 경로 — dev/operator CLI 수준.
- 라이프사이클 동작을 검증하는 backend regression check(`check_account_lifecycle`).

## 구현 시 확정할 세부 (open questions)

```text
- 비활성 account의 post를 feed에서: 완전 숨김 vs "보존하되 비활성 표기로 노출"
  (현재 기울기: 보존 노출. 데이터 유실 없음 + 과거 맥락 유지)
- handle 재사용 허용 여부 (현재 기울기: 비활성 동안 handle 점유 유지 = 재사용 불가)
- 비활성 user가 받은 follow/bookmark/notification 처리 (보존, 단 신규 생성 차단)
- self-service 비활성 진입 UI 위치 (Me 탭 위험 액션 영역 + 확인 다이얼로그)
```

## Non-goals

```text
하드 삭제 / GDPR 스타일 완전 파기
계정 소유권 이전 (ownership transfer)
운영자 admin console / 일괄 관리 UI
User:Account 1:N
external post package format 변경
```

## External Package Policy

External post package JSON format은 변경하지 않습니다.

- import는 기존처럼 account/post를 upsert합니다.
- 비활성 상태는 앱 내부 라이프사이클이며 package에 싣지 않습니다.
- 재import가 비활성 user/account를 자동으로 되살리지 않도록 정책을 명시합니다
  (구현 시 확정: import가 비활성 account를 건드릴 때의 동작).

## Verification (계획)

```bash
cd feed-prototype/backend
python -m scripts.check_account_lifecycle
```

- user 비활성화 후 로그인 실패 + 기존 session 무효 확인.
- 비활성 account가 목록/검색에서 빠지되 기존 post는 조회 가능한지 확인.
- 재활성화(있다면) 후 로그인/노출 복귀 확인.
- Golden sample external package `--dry-run` 통과 확인.
- Frontend build (`npm run build`).
