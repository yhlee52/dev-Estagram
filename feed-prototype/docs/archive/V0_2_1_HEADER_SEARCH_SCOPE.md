# V0_2_1_HEADER_SEARCH_SCOPE.md

`feed-prototype` v0.2.1 — **헤더/검색창 정리** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.2.x(레이아웃 & UI 개편) 테마 두 번째 버전이며, v0.2.0에서
만든 데스크톱 3컬럼 셸 위에서 헤더의 정보 위계와 검색 진입점을 정리합니다.

## 배경

v0.2.0은 단일 컬럼을 3컬럼(좌측 nav 레일 + 중앙 feed + 우측 맥락 레일)으로
확장하면서, 헤더의 사용자 카드(아바타/이름/handle/id)와 Switch user·Logout
버튼을 **레이아웃만 상단으로 이동**시켰습니다(헤더 압축/드롭다운화는 v0.2.1로
명시 위임).

그 결과 헤더 한 줄에 다음이 모두 노출되어 있었습니다.

- 앱 타이틀 + 서브타이틀(`API mode - feed-prototype v0.1.3` 같은 모드/버전 배지)
- 사용자 카드(아바타 + 이름 + handle 또는 user id)
- **Switch user** 버튼
- **Logout** 버튼

문제점:

- **버튼 중복.** Switch user와 Logout이 둘 다 동일하게 `onClear`(active user
  해제 → Entry 화면)를 호출합니다. prototype은 실제 세션/인증이 아니라 user
  selection 방식이라 두 버튼의 동작이 완전히 같습니다.
- **디버그성 정보 노출.** user id, 버전 배지는 평소 볼 필요가 없는데 헤더
  상단을 차지합니다.
- **검색창 위계.** 키워드/`#tag` 검색이 `PostFilterPanel` 그리드에서 다른
  보조 필터(metadata, asset type, 날짜 등)와 같은 칸 크기로 섞여 있어, 가장
  자주 쓰는 진입점인데도 시각적으로 묻혀 있습니다.

## Goals

- **헤더 한 줄 압축.** 타이틀 + 서브타이틀 2줄 구조를 한 줄로 줄이고, 우측은
  아바타 버튼 하나만 남깁니다.
- **사용자 카드 → 아바타 드롭다운.** 아바타 클릭 시 드롭다운을 열어 사용자
  details(이름/handle), 디버그 정보(user id, mode, version), 그리고 단일
  **Switch user** 액션을 담습니다. 바깥 클릭/Escape로 닫힙니다.
- **디버그성 정보 이동.** user id와 버전 배지는 헤더 본문에서 빼고 드롭다운
  안으로 옮깁니다.
- **Switch user / Logout 중복 정리.** 동작이 동일하므로 드롭다운 안의 단일
  **Switch user** 항목 하나로 통합합니다. (진짜 logout/auth는 v0.6.x에서
  server-side session을 도입할 때 별도로 다룹니다.)
- **검색창 승격.** 키워드/`#tag` 검색을 `PostFilterPanel` 그리드에서 분리해
  패널 맨 위 **전폭(full-width)** 검색 바로 올리고, 크기를 키웁니다. 나머지
  보조 필터는 그 아래 그리드로 유지합니다.

## 구현 메모

- `src/components/UserMenu.tsx`(신규): 아바타 트리거 + 드롭다운 패널. props로
  `avatar`(ReactNode), `primaryLabel`, `secondaryLabel`, `meta`(label/value
  rows), `onClear`를 받습니다. 드롭다운 열림 상태와 바깥 클릭/Escape 닫기를
  자체 관리합니다. 단일 액션은 **Switch user** 하나입니다.
- `src/components/AppShell.tsx`:
  - `DesktopShell`의 헤더를 `subtitle` + `userCard` + 별도 Switch user/Logout
    버튼 구조에서, 좌측 타이틀 + 우측 `userMenu`(ReactNode) 한 줄로 교체.
  - `ApiModeAppShell` / `MockModeAppShell`은 각 모드의 아바타 노드와 meta
    rows(user id / mode / version)를 만들어 `UserMenu`에 주입. 진입 가드(미선택
    시 Entry 화면)는 그대로.
- `src/components/PostFilterPanel.tsx`: `form`을 `grid`에서 `space-y` +
  내부 `grid`로 재구성. `TagSearchInput`을 그리드 밖 맨 위 전폭 바로 승격하고
  (`h-11`, 큰 글씨, focus ring), 나머지 보조 필터/버튼/메시지는 아래 그리드에
  유지. `#tag` 라우팅·자동완성 등 **검색 동작 로직은 변경 없음**(스타일/배치만).
- `src/config/appVersion.ts`: `APP_VERSION`을 `v0.2.1`로 갱신(드롭다운 버전
  배지에 반영). v0.2.0에서 버전 라벨이 갱신되지 않아 함께 정정합니다.

## 정책 / 주의

- **backend 변경 없음.** 헤더/검색은 표시·배치만 다룹니다. 새 엔드포인트,
  새 query parameter 없음.
- **검색/필터 동작 불변.** `PostFilters`, URL 동기화(단일 출처), `#tag`
  라우팅, 태그 자동완성은 그대로입니다. 검색 바는 위치/크기만 바뀝니다.
- **인증 도입 아님.** Switch user 단일화는 어디까지나 동일 동작의 중복 정리이며,
  실제 logout/세션은 v0.6.x 범위입니다.
- **external post package JSON format 변경 없음.** format freeze 유지.
- **데스크톱 전용.** 좁은 폭 fallback(헤더 아래 horizontal nav)은 v0.2.0과
  동일하게 유지하되, 모바일 반응형을 새로 설계하지 않습니다.
- core domain(User/Account/Post/Feed/Follow/Asset/Metadata) 유지.

## Non-goals

```text
실제 logout / server-side session / 인증 (v0.6.x)
검색 동작/필터 로직 변경, 전역(글로벌) 검색 신설
Posts·Accounts·Me 탭의 탐색(Explore) 기능 강화 (v0.2.2 / v0.2.3)
모바일/태블릿 폭 반응형 대응 (PC 전용 전제)
다크 모드 등 테마 시스템, 디자인 시스템 도입
backend API 신규/변경, external package format 변경
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건(기존 baseline
   유지: AssetRenderer set-state-in-effect, PostFilterPanel export 3건).
2. 데스크톱 헤더가 한 줄로 압축되고, 우측에 아바타 버튼 하나만 보임.
3. 아바타 클릭 시 드롭다운이 열려 이름/handle, user id, mode, version,
   Switch user 항목이 보이고, 바깥 클릭/Escape로 닫힘.
4. Switch user 클릭 시 active user가 해제되고 Entry 화면으로 돌아감
   (mock/API 모드 각각).
5. 헤더 본문에 user id·버전 배지가 더 이상 노출되지 않음.
6. Home/Posts 필터 패널 맨 위에 전폭 검색 바가 보이고, 키워드 검색·`#tag`
   라우팅·태그 자동완성이 v0.2.0과 동일하게 동작.
7. 나머지 보조 필터(metadata/asset type/날짜/정렬/My posts only)와 Apply/Reset,
   결과 카운트/에러 메시지가 검색 바 아래 그리드에서 정상 동작(회귀 없음).
