# V0_5_2_NOTIFICATIONS_SCOPE.md

`feed-prototype` v0.5.2 — **In-app Notifications & Mentions** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.5.x(협업 — Annotation & Collaboration) 테마 세 번째 MINOR이며,
진입 판단·재사용 기반은 `V0_5_X_COLLABORATION_PLAN.md`를 참고합니다.

> 구현 상태(2026-06-16): **완료**. 앱 라벨은 `v0.5.2`.

## 배경

v0.5.0은 댓글로 공개 협업을 열었고, v0.5.1은 북마크와 비공개 메모로 개인 주석을
추가했습니다. v0.5.2는 그 협업 신호 중 **내가 봐야 할 변화**를 앱 안에서 모아
보는 단계입니다. 팔로우 계정의 새 post, 내 post의 새 댓글, 나를 언급한 post/comment를
한 곳에 모으고, 읽음 처리로 매일 확인할 수 있는 흐름을 만듭니다.

## 확정된 결정 (2026-06-16)

- **수신자 = prototype active user selection.** 알림 수신자는 `user_id`로 식별합니다.
  실제 인증/권한은 v0.6.x이며, 댓글/북마크와 같은 수준의 active user selection입니다.
- **알림 항목은 파생, 읽음 상태만 약하게 저장.** 개별 알림 레코드를 누적 저장하지
  않습니다. post/comment/follow/comment text에서 알림 후보를 파생하고, user별
  `last_read_at` 워터마크만 저장합니다. 이렇게 하면 post/comment 삭제 시 알림도
  자연히 사라지고, 대량 event log 설계를 미루면서도 "모두 읽음"은 안정적으로 됩니다.
- **mention 규칙은 렌더러와 동일하게 맞춤.** v0.5.0의 `parseRichTextSegments`와 같은
  handle 패턴을 Python 서비스에 복제해 `@handle`을 감지합니다. DB에서는 `%@handle%`
  후보만 좁히고, 최종 판정은 regex로 합니다(email/word 중간의 `@` 오탐 방지).
- **중복 이벤트는 source 단위로 합침.** 같은 post/comment가 여러 이유(예: 팔로우한
  계정의 새 post이면서 나를 mention)로 걸리면 하나의 item에 `reasons`를 함께 싣습니다.
- **API mode 전용.** mock 모드는 데모 전용 동결 — 알림 UI 미노출.

## Goals

### 1. `notification_state` 테이블 (migration `0009`)

- 컬럼: `user_id` PK/FK(`users.id`), `last_read_at` nullable datetime, `updated_at`.
- user당 1행만 둡니다. 알림 item 자체는 저장하지 않습니다.
- `last_read_at`이 없으면 모든 파생 알림을 unread로 봅니다.

### 2. 알림 파생 서비스 (`app/services/notifications.py`)

알림 source는 다음 세 가지입니다.

- `followed_post`: 내가 팔로우한 account의 새 post. 내 1:1 account가 올린 post는 제외.
- `own_post_comment`: 내 1:1 account의 post에 달린 다른 user의 댓글.
- `mention`: 내 account handle을 `@handle`로 언급한 post 또는 comment. 내가 작성한
  post/comment는 제외.

구현 메모:

- active user의 1:1 account를 기준으로 수신 handle을 결정합니다.
- post source key는 `post:{post_id}`, comment source key는 `comment:{comment_id}`.
- 같은 source key의 reason은 합쳐 `reasons: list[str]`로 반환합니다.
- 정렬은 `created_at desc`, tie-breaker `source_key`.
- 이형 목록이라 `paginate_posts`를 직접 재사용하지 않습니다. 후보를 제한해 메모리에서
  merge/pagination하는 단순 구현으로 시작합니다(default limit 20, max 50).

### 3. mention 감지 서비스 (`app/services/mentions.py`)

- Python regex가 `src/utils/mentions.ts`의 handle shape를 mirror합니다.
- `find_mentioned_handles(text) -> set[str]`를 제공하고 lowercase normalize합니다.
- DB 후보는 `Post.text.ilike(f"%@{handle}%")`, `Comment.text.ilike(...)`로 좁힌 뒤
  regex로 최종 확인합니다.
- hashtag 처리나 mention 자동완성은 범위 밖입니다.

### 4. 알림 API (`app/api/routes/notifications.py`, user-scoped)

- `GET /api/users/{user_id}/notifications?limit=&cursor=&unread_only=`
  - 응답 `PaginatedNotifications`.
  - 각 item은 `id`, `source_type`, `source_id`, `reasons`, `created_at`,
    `is_read`, `post`, `account`, optional `comment`, optional `comment_author`를 포함.
  - `unread_count`, `last_read_at`, `next_cursor`, `has_more`를 함께 반환.
- `POST /api/users/{user_id}/notifications/read-all`
  - `last_read_at = utc_now()`로 갱신하고 현재 summary를 반환.
- user/account가 없으면 404.

### 5. Frontend (API mode 전용)

- `src/api/notificationsApi.ts`: `getUserNotifications`, `markNotificationsRead`.
- `src/hooks/useNotifications.ts`: active user의 notification summary/list 로드,
  `markAllRead`, `refresh`, storage/custom event 동기화. websocket/push 없이 app load,
  window focus, mark-all 이후 refresh합니다.
- `src/pages/NotificationsPage.tsx`: `/notifications` route.
  - unread/all 토글, "Mark all read", loading/error/empty 상태.
  - item은 reason badge + actor + post title/comment excerpt + relative time을 보여주고
    post detail로 이동합니다.
- `SideNav`: API mode에서 `Notifications` 항목 추가, unread count badge 표시.
- `HomeFeed`: API mode에서 unread summary가 있으면 상단에 새 알림 진입 chip/banner 표시.
- `MePage`: API mode에서 "Mentions" 요약 섹션 추가(최근 mention item 일부 + 전체
  알림으로 이동). v0.2.3에서 남겨둔 "언급됨 목록 자리"를 채웁니다.
- `src/config/appVersion.ts`: `v0.5.1` → `v0.5.2`.

### 6. 회귀 체크 스크립트

- `backend/scripts/check_notifications.py`: TestClient + 실제 DB + 생성물 정리 패턴.
- 확인 범위:
  - 팔로우 account의 새 post가 `followed_post` 알림으로 잡힘.
  - 내 post의 타인 댓글이 `own_post_comment` 알림으로 잡힘.
  - post/comment의 `@myhandle`이 mention 알림으로 잡힘.
  - email/word 중간 `@`는 mention으로 잡히지 않음.
  - 같은 source의 reason은 중복 item이 아니라 `reasons`로 병합됨.
  - `read-all` 후 unread count가 0이 되고, 이후 새 comment/post는 다시 unread.
  - post/comment 삭제 후 파생 알림도 목록에서 사라짐.

## 정책 / 주의

- **인증 범위 밖(v0.6.x).** 수신자와 읽음 상태는 active user selection으로 식별합니다.
- **generic 협업 개념.** Notification/Mention은 설비 전용 개념이 아니므로 v0.5.x core
  협업 타입으로 허용합니다.
- **external package format 무변경.** mention은 기존 post/comment text에서 파생합니다.
  외부 package에 알림 상태를 싣지 않습니다.
- **실시간 아님.** push/websocket/email/slack 같은 외부 채널은 범위 밖입니다. 조회와
  가벼운 refresh 기반으로만 동작합니다.
- **mock mode 동결.** mock 모드에는 알림 route/UI를 추가하지 않습니다.

## Non-goals

```text
실시간 push / websocket / browser notification
메일, 메신저, Slack 등 외부 알림 채널
개별 알림 삭제/숨김/보관
per-notification event log 누적 저장
mention 자동완성 / rich text editor
댓글 threading / reaction / like
external package format 변경
mock mode 알림 UI
```

## 검증 요약

1. `npm run build`(tsc+vite) 통과, `npm run lint` 신규 에러 0건.
2. `GET /api/users/{id}/notifications`가 followed post / own-post comment /
   mention post/comment를 최신순으로 반환하고, source 중복은 reason 병합.
3. `POST /api/users/{id}/notifications/read-all` 후 `unread_count`가 0.
4. read-all 이후 생성된 새 source는 다시 unread.
5. mention regex가 `@handle`은 잡고 email/word 중간 `@`는 제외.
6. SideNav unread badge, `/notifications` 목록, Home unread 진입, Me mentions 요약이
   API mode에서 동작.
7. mock 모드에서는 알림 UI 미노출, 기존 동작 유지.
8. `scripts/check_notifications.py` 통과. golden sample dry-run 회귀 통과.
