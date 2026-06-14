# V0_2_0_DESKTOP_LAYOUT_SCOPE.md

`feed-prototype` v0.2.0 — **데스크톱 3컬럼 레이아웃** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.2.x(레이아웃 & UI 개편) 테마 중 첫 기반 버전이며, ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤
작업한다" 규칙에 따라 작성되었습니다.

## 배경

v0.0.0~v0.1.x의 화면은 `AppShell`이 전체를 `max-w-[430px]` 단일 컬럼으로
감싸고, 하단 `BottomNav`(Home/Posts/Accounts/Me)로 이동하는 모바일 형태입니다.
데이터가 누적되고(v0.1.0) 해시태그/검색/멘션 탐색(v0.1.1~v0.1.3)이 늘면서, 좁은
단일 컬럼은 데스크톱의 가로 공간을 거의 버리고 적용 중인 필터·팔로우 맥락도
화면 밖으로 밀려납니다.

v0.2.0은 단일 컬럼을 **데스크톱 폭 3컬럼**(좌측 navigation 레일 + 중앙 feed +
우측 맥락 레일)으로 확장해 가로 공간을 활용하고 정보 위계를 정리합니다.

이 prototype은 당분간 **PC 브라우저에서만** 쓰는 것을 전제로 하므로, v0.2.0은
**데스크톱 전용**으로 진행합니다. 모바일/태블릿 좁은 폭을 위한 반응형 분기(기존
하단 nav 유지 등)는 이번 범위에서 적극적으로 설계/검증하지 않고 v0.2.x 범위 밖으로
미룹니다. (ROADMAP v0.2.x non-goals 참조.)

## Goals

- `AppShell`을 데스크톱 폭 **3컬럼 그리드**로 재구성합니다. 단일 컬럼
  `max-w-[430px]` 셸을 대체하고, 콘텐츠 폭은 데스크톱 화면을 채우되 과도하게
  늘어나지 않도록 상한(예: `max-w-screen-xl` 수준)을 둡니다.
  - **좌측 레일**: navigation. 현재 `BottomNav`의 항목(Home/Posts/Accounts/Me)을
    세로 사이드바 형태로 표시. active 표시·키보드 포커스는 기존과 동일.
  - **중앙 컬럼**: 기존 `<Outlet />` feed/페이지 본문. 라우트별 페이지 컴포넌트는
    그대로 재사용하며, 폭만 중앙 컬럼에 맞춥니다.
  - **우측 레일**: 맥락 패널. (1) **적용 중 필터** 요약 + 해제,
    (2) **팔로우 계정 바로가기**.
- 헤더의 사용자 카드(아바타/handle/id)와 Switch user·Logout은 유지하되, 3컬럼
  상단에 맞게 배치합니다. (헤더 압축/드롭다운화는 v0.2.1 범위이므로 여기서는
  레이아웃 이동까지만.)
- **mock mode / API mode 모두 동일한 3컬럼 셸**을 사용합니다. 현재
  `AppShell`이 두 모드별로 셸 마크업을 중복 보유하고 있으므로, 공통 셸로
  정리하고 모드별 차이(사용자 카드 내용 등)만 주입합니다.
- 좌·우 레일은 스크롤 시 따라오도록 **sticky** 처리하고, 중앙 컬럼만 길어지게
  합니다. 기존 sticky 헤더 동작과 충돌하지 않게 합니다.

### 우측 레일 — 적용 중 필터

- Home/Posts에서 현재 적용된 `PostFilters`를 **읽기 좋은 칩/목록**으로 요약하고,
  개별 항목 해제 및 전체 Reset을 제공합니다. 활성 필터 판정은 기존
  `hasActivePostFilters`를 재사용합니다.
- 필터 상태는 v0.1.0에서 만든 **URL query parameter와 동기화된 단일 출처**를
  그대로 사용합니다. 레일은 같은 상태를 다른 위치에서 표시/조작할 뿐, 별도의
  필터 상태를 새로 만들지 않습니다.
- 필터가 없는 라우트(Accounts/Me/상세 등)에서는 이 섹션을 숨기거나 빈 상태로
  둡니다.

### 우측 레일 — 팔로우 계정 바로가기

- 활성 사용자가 팔로우한 계정의 바로가기 목록을 표시하고, 클릭 시
  `/accounts/:id`로 이동합니다.
- 데이터 출처는 기존을 재사용합니다: API mode는 기존 follow/accounts 조회,
  mock mode는 로컬 follow 관계. **backend 신규 API는 추가하지 않습니다.**
- 팔로우가 없거나 로드 실패 시 비차단(non-fatal) 빈 상태로 둡니다.

## 구현 메모

- `src/components/AppShell.tsx`: 모드별로 중복된 셸을 공통 3컬럼 셸로 통합.
  `ApiModeAppShell`/`MockModeAppShell`은 진입 가드(미선택 시 Entry 화면)와
  사용자 카드 내용만 다르므로, 공통 `DesktopShell`(헤더 + 좌측 레일 + 중앙
  `<Outlet />` + 우측 레일)에 사용자 카드·로그아웃 핸들러를 props로 주입.
- 좌측 navigation: 기존 `BottomNav`의 `navItems`/active 스타일을 재사용하되
  세로 레일용 컴포넌트(예: `SideNav`)로 분리하거나 `BottomNav`에 방향
  variant를 추가. 라우트 정의(`navItems`)는 단일 출처를 유지.
- 우측 레일은 `src/components/RightRail.tsx`(또는 섹션별 컴포넌트)로 분리하고,
  현재 라우트/필터 상태를 받아 해당 섹션만 조건부 렌더.
- 적용 중 필터 요약은 `PostFilterPanel`의 `hasActivePostFilters`와 `PostFilters`
  타입을 재사용. 필터 변경 핸들러도 기존 페이지의 onChange/onApply/onReset를
  그대로 위로 끌어올려 공유(상태 중복 금지).
- 페이지 컴포넌트(`HomeFeed`/`PostsBrowsePage`/`AccountsPage`/`MePage`/상세)는
  **내용 로직 변경 없이** 중앙 컬럼에 들어가도록 폭 관련 클래스만 조정.

## 정책 / 주의

- **backend 변경 없음.** 레이아웃과 기존 데이터 재배치만 다룹니다. 새 엔드포인트,
  새 query parameter를 추가하지 않습니다.
- **external post package JSON format 변경 없음.** format freeze 유지.
- **데스크톱 전용.** 좁은 폭에서 레이아웃이 완전히 깨지지는 않도록 최소한
  무너지지 않는(graceful) 단일 컬럼 fallback 정도는 허용하되, 모바일 폭의 하단
  nav·반응형 분기를 이번 버전에서 설계/보장하지 않습니다.
- 필터 상태의 **단일 출처(URL 동기화)**를 깨지 않습니다. 우측 레일은 표시·조작
  surface를 하나 더 늘리는 것이지 상태를 복제하는 것이 아닙니다.
- core domain(User/Account/Post/Feed/Follow/Asset/Metadata)을 유지합니다
  (AGENTS.md Core Domain).

## Non-goals

```text
모바일/태블릿 폭 반응형 대응, 하단 nav 유지 분기 (PC 전용 전제)
헤더 압축 / 사용자 카드 드롭다운화 / 검색창 정리 (v0.2.1)
Posts·Accounts·Me 탭의 탐색(Explore) 기능 강화 (v0.2.2 / v0.2.3)
다크 모드 등 테마 시스템, 디자인 시스템/컴포넌트 라이브러리 도입
backend API 신규/변경, external package format 변경
saved filter 저장 (URL 동기화까지만 유지)
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건(기존 baseline
   유지).
2. 데스크톱 폭에서 좌측 navigation 레일 + 중앙 feed + 우측 레일 3컬럼이
   표시되고, 콘텐츠 폭 상한이 적용됨.
3. 좌측 레일 navigation이 기존 BottomNav와 동일하게 동작(active 표시, 라우팅,
   Tab 포커스).
4. Home/Posts에서 적용 중 필터가 우측 레일에 요약되고, 개별 해제/Reset이
   URL query 및 결과에 반영됨(필터 상태가 중복되지 않고 한 곳에서 동작).
5. 우측 레일의 팔로우 계정 바로가기 클릭 시 `/accounts/:id`로 이동. 팔로우가
   없거나 로드 실패 시 비차단 빈 상태.
6. mock mode와 API mode가 동일한 3컬럼 셸을 사용하고, 각 모드의 사용자 카드/
   Switch user/Logout이 정상 동작.
7. 페이지 스크롤 시 좌·우 레일 sticky 동작, 중앙 컬럼만 길어짐. 기존 페이지
   기능(Load more, 필터, 상세 이동 등) 회귀 없음.
