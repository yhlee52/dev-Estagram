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
| 2026-06-14 | /me (API 모드) | Following 수만 보이고 팔로잉한 계정 목록/바로가기는 없음. 우측 레일 FollowShortcuts와 중복되지 않게 "내가 팔로우한 계정" 진입을 Me 탭에서도 제공할지 검토 | v0.2.3 점검 중 발견. 북마크/언급됨과 함께 v0.4.x 협업 단계에서 같이 다루는 게 자연스러움 |
| 2026-06-14 | /me (API 모드) | 내 post가 많아지면 `getAccountPosts`로 전량을 받아 한 번에 렌더 → 페이지네이션/Load more 없음 | Explore/Home처럼 cursor 기반 더 보기 필요. 데이터가 쌓이는 v0.3.x 이후 |
| 2026-06-14 | 전역 (삭제 확인) | post 삭제 확인이 브라우저 `window.confirm`이라 앱 톤과 이질적이고 스타일/포커스 제어가 안 됨 | 공용 ConfirmDialog 컴포넌트로 교체 검토. 현재는 동작 우선 |

## Resolved

| 날짜 | 화면 | 내용 | 반영 버전 |
|---|---|---|---|
| 2026-06-14 | /posts (필터 없음) | Explore 페이지 상단 헤더 "Explore"와 그 아래 `ExploreTags` 섹션 제목 "Explore"가 같은 화면에 중복 표시됨. 섹션 제목을 "Discover"로 바꿔 중복 제거(태그/계정 진입 의미 유지) | v0.2.3 (post-dev 점검) |
| 2026-06-12 | /posts, / (필터 결과 0건) | 필터 적용 후 결과 0건일 때 "Try resetting filters..." 안내 문구만 있고 실제 초기화 버튼이 없었음. `EmptyState`에 선택적 action slot 추가 + Explore/Home의 필터 적용 0건 empty state에 "Reset filters" 버튼 노출(URL query 비우기) | v0.2.3 |
| 2026-06-13 | /posts, / (필터 패널) | 검색창("Keyword or #tag")과 별도 "Tag" 입력 필드가 동시에 존재해 tag 입력 경로가 둘로 보임. 동작은 정상이라 제거하지 않고 "Tag" placeholder를 "Exact tag (or #tag in search)"로 바꿔 역할(정확 일치 필터)을 명시 | v0.2.3 |
| 2026-06-14 | /me (API 모드) | Me 탭이 mock 전용이라 API 모드에서 활성 user가 있어도 "No active user"만 떠 빈 화면이었음. API 모드에서 내 계정/내 post를 로드하고 활동 요약 + New Post/Edit/Delete 관리 추가 | v0.2.3 |
| 2026-06-13 | mock 모드 /posts | mock 모드에서 해시태그 칩이 클릭은 되지만 `/posts?tag=`로 이동해도 필터가 적용되지 않던 dead-end. URL의 `tag`를 client-side로 적용하고, 패널이 없는 mock 모드용 활성 tag 표시 + "Clear tag" 컨트롤 추가 | v0.1.3 (post-dev 점검) |
