# UX_BACKLOG.md

사용 중 발견한 UX 불편/아이디어를 기록하는 backlog입니다. 즉시 고치지 않고
여기에 쌓아 두었다가, 각 MIDDLE 테마의 마지막 MINOR 릴리즈에서 모아 반영합니다.
(`ROADMAP.md` 참고)

기록 규칙:

- 한 항목 = 한 줄 제목 + 상황 설명. 해결 방법은 적어도 되고 안 적어도 됩니다.
- 발견 날짜와 발견한 화면(route)을 함께 적습니다.
- 반영된 항목은 목록에서 제거합니다. 과거 기록은 Git history에서 확인합니다.

## Open

| 날짜 | 화면 | 내용 | 메모 |
|---|---|---|---|
| 2026-07-11 | / (Home feed) | 피드가 마운트/필터 변경 시에만 fetch되어, 화면을 켜둔 사용자는 다른 계정의 새 post를 알 수 없음. 주기적 head-check(또는 cursor 비교)로 "N new posts — Refresh" 배너 노출 후보 | backend 변경 없이 가능 |
| 2026-07-11 | 전역 (SideNav 알림 badge) | `useNotifications`가 focus/visibility 이벤트에서만 refresh해서, 탭을 계속 보고 있는 동안은 unread badge가 갱신되지 않음. 가벼운 interval 폴링(예: 60초, `limit: 1` 재사용) 후보 | 새 post 배너와 같은 "신선도" 묶음 |
| 2026-07-11 | /, /posts (카드) | 카드 시간이 "Created: <절대 시각>"뿐이라 트리아지 시 최신성 파악이 느림. 알림 목록처럼 `formatRelativeTime` 상대 시간으로 바꾸고 hover tooltip으로 절대 시각 보존 | 유틸(`formatRelativeTime`)은 이미 존재, 알림 목록과 표기 일관성 |
| 2026-07-11 | /notifications | 읽음 상태가 user별 워터마크(`last_read_at`) 하나라서 알림을 클릭해 post를 봐도 그 알림이 계속 unread로 남음. 최소: 목록 진입/이탈 시 자동 mark-all-read 옵션. 제대로: 개별 읽음 모델 확장(스키마 변경, MINOR 규모) | 사용자가 "봤는데 왜 안 읽음?"을 겪는 구조적 어색함 |
| 2026-07-11 | /notifications | 댓글 알림(`own_post_comment`, comment mention)도 `/posts/{id}`로만 이동하고 댓글 섹션으로 딥링크되지 않음. `#comments` 앵커가 이미 구현되어 있으므로 링크만 `/posts/{id}#comments`로 변경 | 잔손질 수준 |
| 2026-07-11 | /notifications | 비로그인 guard의 "Select an API user / Choose a backend seed user" 문구가 현재 password 로그인 흐름과 맞지 않음 | 문구 현행화 또는 도달 불가 상태 제거 |
| 2026-07-11 | /, /posts (카드) | 댓글 작성 영역의 "Select an active API user to write comments." 문구가 현재 로그인 흐름과 맞지 않음 | 문구 현행화 |
| 2026-07-11 | /, /posts (카드) | 댓글 있는 카드마다 `getComments`를 개별 호출(N+1)하고 미리보기 3개를 위해 전체 댓글을 받음. feed 응답에 최근 댓글 2~3개를 additive 필드로 포함하거나 배치 endpoint 도입 후보 | 첫 페이지 로딩 체감 개선. package format 무관(응답 스키마 additive) |
| 2026-07-11 | 전역 (asset lightbox) | `AssetLightbox`가 초기 포커스만 잡고 포커스 트랩이 없어 Tab이 배경 콘텐츠로 빠져나감(`ConfirmDialog`는 포커스 제어 있음 — 비대칭) | a11y |
| 2026-07-11 | 전역 | 비동기 에러/로딩 문구가 일반 `<p>`라 스크린리더에 공지되지 않음(`aria-live` 부재). 협업 표면 전반 a11y audit 후보 | a11y, audit성 MINOR 후보 |
