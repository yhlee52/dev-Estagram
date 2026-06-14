# V0_2_3_TAB_ACTIVATION_2_SCOPE.md

`feed-prototype` v0.2.3 — **탭 활성화 2 (Me) + UX backlog 반영** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.2.x(레이아웃 & UI 개편) 테마 **마지막 MINOR**이며, v0.2.0의
3컬럼 셸 / v0.2.1의 헤더·검색 정리 / v0.2.2의 Posts·Accounts 탭 활성화 위에서
**Me 탭을 실제로 쓸 수 있는 "내 활동/내 post 관리" 화면**으로 채우고, 그동안
`UX_BACKLOG.md`에 쌓인 항목과 이번 점검에서 새로 발견한 UX 불편을 함께
반영합니다.

## 배경

v0.2.0~v0.2.2에서 Home/Explore/Accounts 탭은 내용이 채워졌지만 **Me 탭은
구멍이 남아 있었습니다.**

- **Me 탭(`/me`, `MePage`)이 mock 전용**이었습니다. `MePage`는 `useActiveUser`
  (로컬/mock user 시스템)와 `posts.json`만 바라봐서, **API 모드에서는 활성
  API user가 있어도 "No active user"만 떠 사실상 빈 화면**이었습니다. API
  모드에서 "내 계정/내 post"를 보려면 Accounts → 내 계정 프로필로 우회해야
  했습니다.
- mock 모드에서도 Me 탭은 프로필 카드 + 내 post 목록을 **읽기 전용**으로만
  보여줄 뿐, "지금 얼마나 활발한지"(활동 요약)나 "post를 바로 관리"(수정/삭제,
  새 글)하는 진입점이 없었습니다. 내 post를 고치려면 매 post 상세로 들어가야
  했습니다.

또한 `UX_BACKLOG.md`에 검색/필터 관련 항목이 쌓여 있었고, 이번 점검에서 추가로
발견한 불편도 있었습니다(아래 "UX backlog 반영" 참고).

## Goals

### Me 탭 → 내 활동 + 내 post 관리

- **두 데이터 모드 모두에서 동작.** mock 모드는 `useActiveUser`/`posts.json`,
  API 모드는 활성 API user(`useActiveApiUser`)와 백엔드를 사용합니다. API
  모드에서 더 이상 "No active user"로 비지 않습니다.
- **내 활동 요약**: 프로필 카드에 총 post 수, 최근 7일 post 수, 마지막 활동
  시점(상대 시간)을 표시. v0.2.2의 `accountActivity` 유틸과 `formatRelativeTime`
  을 재사용해 같은 신호를 "내 계정" 한 건에 적용합니다.
- **내 post 관리(API 모드)**:
  - **New Post** 진입 버튼(프로필 카드 + My Posts 섹션 헤더).
  - 각 내 post 카드에 **Edit**(`/posts/:id/edit` 링크)와 **Delete**(인라인,
    확인창 + 에러 표시) 액션. 삭제 성공 시 상세로 이동하지 않고 **목록에서
    바로 제거**(상세에서 삭제하던 기존 흐름보다 관리에 적합).
- **mock 모드**: 기존 프로필/Connected Account/My Posts(읽기 전용)를 유지하되
  활동 요약을 추가. 생성/수정/삭제는 API 전용이므로 mock에서는 관리 버튼을
  노출하지 않고, 그 사실을 한 줄로 안내합니다(무회귀).

### UX backlog 반영

`UX_BACKLOG.md` Open 항목 + 이번 점검 발견분 중 합의 가능한 것을 반영합니다.

1. **필터 결과 0건 empty state에 "필터 초기화" 액션 추가**(backlog 2026-06-12).
   기존에는 "Try resetting filters..."라는 **문구만** 있고 실제 버튼이 없었음.
   `EmptyState`에 선택적 `action` slot을 추가하고, Explore(`PostsBrowsePage`)와
   Home(`HomeFeed`)에서 **필터가 적용된 채 결과가 0건**일 때 "Reset filters"
   버튼을 노출. 누르면 URL query를 비워 필터를 해제(단일 출처 유지).
2. **검색창 vs 별도 "Tag" 필드의 역할 모호성 완화**(backlog 2026-06-13).
   상단 검색창("Search posts by keyword or #tag")과 필터 그리드의 "Tag" 입력이
   동시에 있어 tag 입력 경로가 둘로 보였음. 동작은 정상이므로 **제거하지 않고**
   "Tag" 필드의 placeholder를 역할이 드러나게 정리(정확 일치 tag 필터임을 명시,
   "또는 위 검색창에서 #tag"). 입력 경로를 없애지 않아 필터 능력 회귀 없음.
3. **(신규 발견) Me 탭 API 모드 빈 화면** — 위 Me 탭 Goal로 해결. backlog에
   Resolved로 기록.

## 구현 메모

- **백엔드 변경 없음 / 신규 엔드포인트 없음.** Me 탭 API 모드는 기존
  `getUser`, `getAccounts`(user_id로 내 계정 찾기), `getAccountPosts`,
  `deletePost`만 조합합니다. 내 계정은 `account.user_id === activeApiUserId`로
  식별(다른 화면의 `account.metadata.user_id` 규칙과 동일).
- `src/components/EmptyState.tsx`: 선택적 `action?: ReactNode` prop 추가. 값이
  있을 때만 description 아래에 렌더(기존 사용처 전부 무회귀).
- `src/components/MyPostCard.tsx`(신규): `FeedCard` 위에 관리 액션 줄(Edit
  링크 + Delete 버튼)을 얹은 래퍼. props `item`, `userId`, `onDeleted`. 삭제
  상태/확인창/에러를 자체 보유하고, 성공 시 `onDeleted(postId)`로 부모 목록에서
  제거. `PostDetail`의 삭제 에러 메시지 매핑을 동일 패턴으로 재사용.
- `src/pages/MePage.tsx`: mock/API 분기. 공용 표현 컴포넌트(Avatar,
  SummaryItem)와 활동 요약 계산은 공유. API 본문은 내 user/account/posts를
  로드하고 New Post + `MyPostCard` 목록을 렌더. 활동 요약은
  `buildAccountActivity`로 내 계정 한 건을 집계.
- `src/pages/PostsBrowsePage.tsx`, `src/pages/HomeFeed.tsx`: 필터 적용 + 0건
  empty state에 `action`으로 "Reset filters" 버튼을 주입. reset은 기존
  `onReset`과 동일하게 URL query를 비움.
- `src/components/PostFilterPanel.tsx`: "Tag" 입력 placeholder를 역할 명시형
  으로 변경(aria-label "Tag"는 유지 → 접근성/테스트 무회귀).
- `src/config/appVersion.ts`: `APP_VERSION` → `v0.2.3`.

## 정책 / 주의

- **external post package JSON format 변경 없음.** format freeze 유지.
- **core domain 유지**(User/Account/Post/Feed/Follow/Asset/Metadata). 활동
  요약은 새 필드가 아니라 기존 post `created_at`에서 파생.
- **mock 모드 유지.** v0.2.x까지 mock/API 모두 동작. 생성/수정/삭제는 API
  전용이라는 기존 제약을 그대로 따르고, mock Me 탭은 읽기 전용 + 안내.
- **데스크톱 전용 전제 유지.** 모바일/좁은 폭 반응형은 v0.2.x 범위 밖.
- **검색/필터 동작 불변.** empty state의 reset은 기존 reset 경로(URL query
  비우기)를 재사용할 뿐 필터 로직/URL 단일 출처/`#tag` 라우팅을 바꾸지 않음.
- 내 post 로드는 `getAccountPosts`로 계정 post 전량을 받습니다. post가 매우
  많아지면 비용이 커지므로, 서버측 페이지네이션/집계는 데이터가 더 쌓였을 때
  (v0.3.x 이후)의 후속 과제로 남깁니다(현 prototype 규모 OK).

## Non-goals

```text
북마크 / "나를 언급한 post" 목록 (v0.5.x)
in-app 알림, unread 표시 (v0.5.x)
mock 모드 post 생성/수정/삭제 (API 전용 유지)
follow/팔로잉 목록 관리 UI 개편 (현행 유지)
백엔드 신규/변경 엔드포인트, 서버측 "내 post" 집계
external package format 변경, core domain 필드 추가
모바일/태블릿 폭 반응형, 다크 모드/디자인 시스템
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건(기존
   baseline 유지).
2. **API 모드** Me 탭: 활성 API user의 프로필 카드(활동 요약 포함)와 내 post
   목록이 보이고, New Post 버튼이 동작. 각 내 post의 Edit 링크가 편집 화면으로
   가고, Delete가 확인창 → 성공 시 목록에서 즉시 제거. 권한/네트워크 오류는
   인라인 에러로 표시.
3. **mock 모드** Me 탭: 기존 프로필/Connected Account/My Posts가 그대로 보이고
   활동 요약이 추가됨. 관리 버튼은 노출되지 않으며 안내 문구가 보임(회귀 없음).
4. Explore/Home에서 필터를 적용해 결과가 0건이면 empty state에 "Reset filters"
   버튼이 보이고, 누르면 필터가 해제되어 전체 목록으로 돌아감.
5. 필터 패널의 "Tag" 입력 placeholder가 역할이 드러나게 바뀌고, 기존 tag
   필터/`#tag` 라우팅/자동완성 동작은 그대로.
6. `EmptyState`를 쓰는 다른 화면(계정/포스트 not found 등)은 `action` 미주입
   시 기존 표시 그대로(무회귀).
