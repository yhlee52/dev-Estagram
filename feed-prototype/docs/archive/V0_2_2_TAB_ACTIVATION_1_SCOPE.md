# V0_2_2_TAB_ACTIVATION_1_SCOPE.md

`feed-prototype` v0.2.2 — **탭 활성화 1 (Posts, Accounts)** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.2.x(레이아웃 & UI 개편) 테마 세 번째 버전이며, v0.2.0의
3컬럼 셸과 v0.2.1의 헤더/검색 정리 위에서 **Posts 탭과 Accounts 탭에 실제
탐색 가치**를 채웁니다. (Me 탭은 v0.2.3에서 다룹니다.)

## 배경

v0.2.0~v0.2.1까지는 레이아웃·헤더·검색의 "골격"을 정리했습니다. 그 결과
좌측 nav의 Posts/Accounts 탭은 자리는 잡았지만 내용은 빈약했습니다.

- **Posts 탭(`/posts`, `PostsBrowsePage`)**: 필터/검색 패널 + 전체 post
  목록뿐이라, "무엇을 탐색할지" 진입점이 없습니다. 사용자는 검색어나 태그를
  스스로 입력해야만 탐색을 시작할 수 있습니다.
- **Accounts 탭(`/accounts`, `AccountsPage`)**: 계정을 API가 돌려준 순서
  그대로(생성순) 나열하고 총 post 수만 표시합니다. "지금 활발한 계정이
  누구인지" 같은 활동 신호가 없어, 계정이 늘어날수록 둘러보기 가치가
  떨어집니다.

## Goals

### Posts 탭 → 탐색(Explore) 성격

- nav 라벨을 **Posts → Explore**로 변경(라우트는 `/posts` 유지 → 기존
  `?tag=` 링크/북마크 호환). 페이지 상단 헤딩도 "Explore"로 정리.
- **Explore 진입 섹션** 추가: 필터가 적용되지 않은 기본 상태에서 페이지 맨 위에
  노출. 태그를 고르면 기존 `/posts?tag=<tag>` 필터가 적용되어 결과가 보이는
  "탐색 landing → 필터 결과" 흐름.
  - **인기 태그**: 전체 사용 빈도순(API: `GET /api/tags` 재사용, mock: 클라이언트
    집계) 칩 클라우드. 칩에 사용 횟수 표시.
  - **최근 태그**: 최근 post들에 등장한 태그를 등장 순서대로 dedupe해 별도 묶음.
  - **계정 둘러보기 진입점**: Accounts 탭으로 가는 링크 카드.
- 필터가 적용되면 Explore 섹션은 접고 결과 목록에 집중.

### Accounts 탭 → 활동 신호 + 정렬

- **활동 신호 표시(AccountCard)**: 총 post 수에 더해
  - **최근 7일간 post 수**,
  - **마지막 활동 시점**(가장 최근 post의 상대 시간, 예: "3일 전").
- **정렬 토글**: 기본 **최근 활동순**(마지막 post 시각 내림차순), 추가로
  **post 많은순**, **이름순** 선택. URL/state는 단순 로컬 state로 관리.

## 구현 메모

- **백엔드 변경 없음 / 신규 엔드포인트 없음.** 두 페이지 모두 이미 필요한
  데이터를 fetch 합니다.
  - `AccountsPage`는 `getAllPosts()`로 전체 post를 이미 받아 총 post 수를
    집계 중 → 같은 데이터에서 최근 7일 수·마지막 활동 시각을 함께 파생.
  - `PostsBrowsePage`는 autocomplete용으로 `getTags()`(인기 태그)를 이미 로드 →
    인기 태그 묶음에 재사용. 최근 태그는 첫 페이지 post들의 태그에서 파생.
  - mock 모드는 `posts.json`을 그대로 사용해 동일하게 클라이언트 집계.
- `src/utils/accountActivity.ts`(신규): `{ accountId, createdAt }[]`에서
  계정별 `{ postCount, recentPostCount, lastActiveAt }`를 만들고, `recent /
  posts / name` 정렬을 수행하는 순수 함수. 윈도우 기본 7일(`RECENT_ACTIVITY_DAYS`).
- `src/utils/format.ts`: `formatRelativeTime(value, now?)` 추가("방금 전",
  "N분/시간/일/주 전", 그 이상은 절대 날짜로 fallback).
- `src/components/AccountCard.tsx`: 선택적 props
  `recentPostCount?`, `recentWindowDays?`, `lastActiveAt?` 추가. 값이 있을 때만
  활동 신호 줄을 렌더(없으면 기존 표시 그대로 → 다른 사용처 무회귀).
- `src/components/ExploreTags.tsx`(신규): `popularTags`(tag/count),
  `recentTags`(string[]) 묶음을 칩으로 렌더하고, 각 칩은 `/posts?tag=<tag>`
  링크(`TagList`와 동일한 라우팅 규칙). "Browse accounts" 진입 링크 포함.
- `src/pages/AccountsPage.tsx`: 정렬 토글 + 활동 맵 계산. 정렬 state 추가,
  `AccountCard`에 활동 props 주입. 헤딩/문구 정리.
- `src/pages/PostsBrowsePage.tsx`: 필터 미적용 시 상단에 `ExploreTags` 렌더.
  인기/최근 태그 계산(API/mock 분기). 헤딩 "Explore"로.
- `src/components/SideNav.tsx`: `/posts` 라벨 `Posts → Explore`.
- `src/config/appVersion.ts`: `APP_VERSION` → `v0.2.2`.

## 정책 / 주의

- **external post package JSON format 변경 없음.** format freeze 유지.
- **core domain 유지**(User/Account/Post/Feed/Follow/Asset/Metadata). 활동
  신호는 새 도메인 필드가 아니라 기존 post `created_at`에서 파생합니다.
- **mock 모드 유지.** v0.2.x까지 mock/API 모두 동작해야 하므로 두 모드에서
  동일하게 클라이언트 집계로 처리.
- **데스크톱 전용 전제 유지.** 모바일/좁은 폭 반응형은 v0.2.x 범위 밖.
- **검색/필터 동작 불변.** Explore 섹션은 진입점만 추가하며 `PostFilters`,
  URL 동기화(단일 출처), `#tag` 라우팅, 태그 자동완성 로직은 그대로입니다.
- 활동 신호는 클라이언트가 `getAllPosts()` 전량을 받아 집계하므로, post가
  매우 많아지면 비용이 커집니다. 서버측 집계/엔드포인트화는 데이터가 더
  쌓였을 때(예: v0.3.x 이후)의 후속 과제로 남깁니다(현 prototype 규모 OK).

## Non-goals

```text
백엔드 신규/변경 엔드포인트, 서버측 활동 집계
Me 탭 강화 (v0.2.3)
태그 상세 페이지(태그별 전용 라우트) — 칩은 기존 ?tag= 필터로만 연결
like/trending 랭킹 알고리즘, 개인화 추천
external package format 변경, core domain 필드 추가
모바일/태블릿 폭 반응형, 다크 모드/디자인 시스템
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건(기존
   baseline 유지).
2. nav에 "Explore" 탭이 보이고, `/posts` 라우트·`?tag=` 링크가 그대로 동작.
3. Explore(필터 미적용) 상단에 인기 태그·최근 태그 묶음과 "Browse accounts"
   링크가 보이고, 태그 클릭 시 `/posts?tag=<tag>` 필터가 적용되며 Explore
   섹션이 접힘.
4. Accounts 탭에서 각 카드에 총 post 수·최근 7일 post 수·마지막 활동 시간이
   보임. 정렬 토글로 최근 활동순/post 많은순/이름순 전환이 동작.
5. mock 모드에서도 인기/최근 태그·계정 활동 신호·정렬이 동작(빈 데이터에서도
   안전).
6. AccountCard를 쓰는 다른 화면(있다면)에 활동 props 미주입 시 회귀 없음.
</content>
</invoke>
