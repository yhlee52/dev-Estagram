# UX_BACKLOG.md

사용 중 발견한 UX 불편/아이디어를 기록하는 backlog입니다. 즉시 고치지 않고
여기에 쌓아 두었다가, 각 MIDDLE 테마의 마지막 MINOR 릴리즈에서 모아 반영합니다.
(`ROADMAP.md` 참고)

기록 규칙:

- 한 항목 = 한 줄 제목 + 상황 설명. 해결 방법은 적어도 되고 안 적어도 됩니다.
- 발견 날짜와 발견한 화면(route)을 함께 적습니다.
- 반영된 항목은 삭제하지 않고 Resolved로 옮기고 반영 버전을 적습니다.

## Open

| 날짜 | 화면 | 내용 | 메모 |
|---|---|---|---|
| 2026-07-11 | / (Home feed) | 피드가 마운트/필터 변경 시에만 fetch되어, 화면을 켜둔 사용자는 봇이 새 리포트 post를 올려도 알 수 없음. 주기적 head-check(또는 cursor 비교)로 "N new posts — Refresh" 배너 노출 후보 | backend 변경 없이 가능. 상시 모니터링 사용 패턴에서 가치 큼 |
| 2026-07-11 | 전역 (SideNav 알림 badge) | `useNotifications`가 focus/visibility 이벤트에서만 refresh해서, 탭을 계속 보고 있는 동안은 unread badge가 갱신되지 않음. 가벼운 interval 폴링(예: 60초, `limit: 1` 재사용) 후보 | 새 post 배너와 같은 "신선도" 묶음 |
| 2026-07-11 | /, /posts (카드) | 카드 시간이 "Created: <절대 시각>"뿐이라 트리아지 시 최신성 파악이 느림. 알림 목록처럼 `formatRelativeTime` 상대 시간으로 바꾸고 hover tooltip으로 절대 시각 보존 | 유틸(`formatRelativeTime`)은 이미 존재, 알림 목록과 표기 일관성 |
| 2026-07-11 | /notifications | 읽음 상태가 user별 워터마크(`last_read_at`) 하나라서 알림을 클릭해 post를 봐도 그 알림이 계속 unread로 남음. 최소: 목록 진입/이탈 시 자동 mark-all-read 옵션. 제대로: 개별 읽음 모델 확장(스키마 변경, MINOR 규모) | 사용자가 "봤는데 왜 안 읽음?"을 겪는 구조적 어색함 |
| 2026-07-11 | /notifications | 댓글 알림(`own_post_comment`, comment mention)도 `/posts/{id}`로만 이동하고 댓글 섹션으로 딥링크되지 않음. `#comments` 앵커가 이미 구현되어 있으므로 링크만 `/posts/{id}#comments`로 변경 | 잔손질 수준 |
| 2026-07-11 | /notifications | 비로그인 guard의 "Select an API user / Choose a backend seed user" 문구가 v0.6.0 로그인 도입 이전 표현. 이 상태는 사실상 도달 불가(shell에서 로그인 강제)이므로 문구 현행화 또는 상태 제거 | v0.6.0 잔재 문구 드리프트 |
| 2026-07-11 | /, /posts (카드) | 댓글 작성 영역의 "Select an active API user to write comments." 문구가 v0.6.0 로그인 도입 이전 표현(API mode에서는 로그인이 보장됨) | v0.6.0 잔재 문구 드리프트 |
| 2026-07-11 | /, /posts (카드) | 댓글 있는 카드마다 `getComments`를 개별 호출(N+1)하고 미리보기 3개를 위해 전체 댓글을 받음. feed 응답에 최근 댓글 2~3개를 additive 필드로 포함하거나 배치 endpoint 도입 후보 | 첫 페이지 로딩 체감 개선. package format 무관(응답 스키마 additive) |
| 2026-07-11 | 전역 (asset lightbox) | `AssetLightbox`가 초기 포커스만 잡고 포커스 트랩이 없어 Tab이 배경 콘텐츠로 빠져나감(`ConfirmDialog`는 포커스 제어 있음 — 비대칭) | a11y |
| 2026-07-11 | 전역 | 비동기 에러/로딩 문구가 일반 `<p>`라 스크린리더에 공지되지 않음(`aria-live` 부재). 협업 표면 전반 a11y audit 후보 | a11y, audit성 MINOR 후보 |

## Resolved

| 날짜 | 화면 | 내용 | 반영 버전 |
|---|---|---|---|
| 2026-07-16 | 전역 (우측 rail Following) | `FollowShortcuts`가 팔로우 계정을 `MAX_SHORTCUTS`(8)명까지만 보여주고 초과분은 아무 안내 없이 잘렸음(v0.2.0 구현 시 방어적 상수, scope 문서에 제한 명시 없음). 잘린 인원 수를 목록 하단 "+N more" 표기로 노출(전체 목록은 Me 탭에 존재) | v1.0.1 (hotfix) |
| 2026-07-16 | /me (Following 목록) | Following 목록이 `avatarUrl`이 있어도 항상 이니셜 원만 렌더링. 같은 데이터를 쓰는 우측 rail(`FollowShortcuts`)과 비일관(v0.5.1 구현 누락). `avatarUrl` 존재 시 프로필 이미지를 표시하고 없을 때만 이니셜 fallback | v1.0.1 (hotfix) |
| 2026-06-16 | /notifications (Unread 탭) | 읽지 않은 알림이 없을 때도 전체 알림 0건과 같은 "No notifications yet" 문구를 보여, 이미 읽은 알림이 있는 사용자에게 상태가 모호했음. Unread 탭 전용 empty state("No unread notifications")로 분리하고, Mark all read 버튼은 로딩 중에도 비활성화 | v0.5.3 |
| 2026-06-16 | /me (Bookmarks) | 북마크 empty state가 "Tap Save"라고 안내해 데스크톱 중심 prototype의 조작 맥락과 살짝 어긋남. "Use Save..."로 바꿔 입력 장치에 덜 묶인 문구로 정리 | v0.5.3 |
| 2026-06-14 | /me (API 모드) | Following 수만 보이고 팔로잉한 계정 목록/바로가기는 없음. v0.5.1 Me 탭에 "Following" 목록 섹션 추가(팔로우 계정 → 프로필 바로가기). 같은 Me 탭 북마크 목록 작업과 함께 반영 | v0.5.1 |
| 2026-06-16 | /, /posts (카드) | pin한 metadata key가 카드에서 pinned 칩과 `MetadataSummary`(상위 3개)에 중복 표시됨(v0.4.1에서 발생). `MetadataSummary`에 `excludeKeys` 추가하고 `FeedCard`가 pinned key를 넘겨 summary에서 제외 | v0.4.2 |
| 2026-06-16 | /, /posts (필터 패널) | metadata 값 정렬 시 그 key를 가진 post만 보여줘 결과 수가 조용히 줄어드는 게 설명 없이 일어남. 정렬 활성 + key 선택 시 "only posts that have this metadata key are shown" 안내 문구 추가 | v0.4.2 |
| 2026-06-14 | /me (API 모드) | 내 post가 많아지면 `getAccountPosts`로 전량을 받아 한 번에 렌더 → 페이지네이션/Load more 없음. 활동 요약이 정확한 총계를 보여줘 어차피 전량 fetch가 필요하므로, 표시 카드만 `MY_POSTS_PAGE_SIZE`(20)개씩 "Load more"로 점진 렌더(클라이언트 사이드). 서버 cursor는 중복 fetch가 되어 보류 | v0.3.4 |
| 2026-06-14 | 전역 (삭제 확인) | post 삭제 확인이 브라우저 `window.confirm`이라 앱 톤과 이질적이고 스타일/포커스 제어가 안 됨. 공용 `ConfirmDialog` 컴포넌트(오버레이/Escape/백드롭/포커스 제어)로 교체하고 `MyPostCard`·`PostDetail` 삭제에 적용 | v0.3.4 |
| 2026-06-14 | /posts (필터 없음) | Explore 페이지 상단 헤더 "Explore"와 그 아래 `ExploreTags` 섹션 제목 "Explore"가 같은 화면에 중복 표시됨. 섹션 제목을 "Discover"로 바꿔 중복 제거(태그/계정 진입 의미 유지) | v0.2.3 (post-dev 점검) |
| 2026-06-12 | /posts, / (필터 결과 0건) | 필터 적용 후 결과 0건일 때 "Try resetting filters..." 안내 문구만 있고 실제 초기화 버튼이 없었음. `EmptyState`에 선택적 action slot 추가 + Explore/Home의 필터 적용 0건 empty state에 "Reset filters" 버튼 노출(URL query 비우기) | v0.2.3 |
| 2026-06-13 | /posts, / (필터 패널) | 검색창("Keyword or #tag")과 별도 "Tag" 입력 필드가 동시에 존재해 tag 입력 경로가 둘로 보임. 동작은 정상이라 제거하지 않고 "Tag" placeholder를 "Exact tag (or #tag in search)"로 바꿔 역할(정확 일치 필터)을 명시 | v0.2.3 |
| 2026-06-14 | /me (API 모드) | Me 탭이 mock 전용이라 API 모드에서 활성 user가 있어도 "No active user"만 떠 빈 화면이었음. API 모드에서 내 계정/내 post를 로드하고 활동 요약 + New Post/Edit/Delete 관리 추가 | v0.2.3 |
| 2026-06-13 | mock 모드 /posts | mock 모드에서 해시태그 칩이 클릭은 되지만 `/posts?tag=`로 이동해도 필터가 적용되지 않던 dead-end. URL의 `tag`를 client-side로 적용하고, 패널이 없는 mock 모드용 활성 tag 표시 + "Clear tag" 컨트롤 추가 | v0.1.3 (post-dev 점검) |
