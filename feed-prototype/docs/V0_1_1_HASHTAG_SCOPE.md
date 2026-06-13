# V0_1_1_HASHTAG_SCOPE.md

`feed-prototype` v0.1.1 — **해시태그 활성화** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.1.x(탐색과 발견) 테마 중 두 번째 버전이며, ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤
작업한다" 규칙에 따라 작성되었습니다.

## 배경

v0.1.0에서 backend 필터(`tag`)와 frontend 필터 ↔ URL query parameter 동기화
기반을 만들었습니다. 그러나 태그 칩은 아직 단순 표시용 텍스트라 사용자가 같은
태그의 다른 post로 이동하려면 직접 필터 패널에 태그를 입력해야 합니다.

v0.1.1은 이미 만들어진 두 가지(① backend tag 필터, ② URL 동기화)를 잇기만
하면 됩니다. 태그 칩을 `/posts?tag=<tag>` 링크로 만들어 어디서든 클릭 한 번으로
같은 태그의 post 목록으로 이동하게 합니다. **backend 변경은 없습니다.**

## Goals

- `TagList` 태그 칩을 클릭 가능한 링크로 변경: `/posts?tag=<tag>`.
  - 태그는 `URLSearchParams`로 인코딩해 공백/특수문자가 있는 태그도 안전하게
    링크됩니다.
- **PostCard(FeedCard), PostDetail, AccountProfile 어디서든** 태그 클릭이
  동작합니다. 세 화면 모두 `TagList`를 공유하므로 컴포넌트 한 곳만 바꿉니다.
  (AccountProfile은 FeedCard를 통해 태그를 렌더링합니다.)
- FeedCard처럼 **카드 전체가 클릭 가능한 컨테이너** 안에 있을 때, 태그 클릭이
  카드의 post 이동으로 전파(bubble)되지 않습니다 (`stopPropagation`).
- 이미 `/posts`에 있는 상태에서 태그를 클릭해도(같은 라우트, remount 없음)
  목록이 갱신됩니다. `PostsBrowsePage`에서 **URL query를 applied filter의 단일
  진리원(source of truth)** 으로 삼아 URL 변경에 반응하도록 합니다.
- 키보드 접근성: 태그는 `<a>`(react-router `Link`)이므로 Tab 포커스 + Enter로
  이동 가능하고 focus ring을 가집니다.

## 구현 메모

- `src/components/TagList.tsx`: `li > span` → `li > Link`. hover/focus 스타일과
  `onClick`/`onKeyDown` `stopPropagation` 추가. 링크 href는 `/posts?tag=...`.
- `src/pages/PostsBrowsePage.tsx`:
  - `appliedFilters`를 `useState`에서 `searchParams` 기반 `useMemo`로 전환.
    URL이 바뀌면(태그 클릭, 뒤로/앞으로 가기) 자동으로 다시 로드됩니다.
  - 편집용 `draftFilters`는 URL이 외부에서 바뀔 때 렌더 단계 state 조정
    (React 권장 패턴)으로 동기화합니다. apply/reset 핸들러는 이제 URL만
    갱신하고(`setSearchParams`), 별도 applied state를 두지 않습니다.
- 기존 v0.1.0의 `filtersToSearchParams` / `filtersFromSearchParams`를 그대로
  재사용합니다. 파라미터 이름(`tag`)도 backend 필터 계약과 동일합니다.

## 정책 / 주의

- **backend 변경 없음.** v0.1.0의 SQL `tag` 필터를 그대로 재사용합니다.
- tag 필터는 API mode에서만 실제로 적용됩니다(필터/검색은 API mode 전용).
  mock mode에서도 태그 링크 자체는 동작하지만 목록은 전체를 그대로 보여줍니다.
  이는 기존 동작과 일치하며 ROADMAP v0.1.x 범위 안입니다.
- 한 번에 하나의 태그만 필터링합니다(태그 클릭 = 해당 태그로 교체). 여러 태그
  AND/OR 조합은 범위 밖입니다.
- external post package JSON format은 변경하지 않습니다.

## Non-goals

```text
검색창 # 라우팅 / tag 자동완성 / GET /api/tags (v0.1.2)
@mention 렌더링 (v0.1.3)
여러 태그 AND/OR 조합, exclude 태그
tag 통계/인기 태그 집계
backend tag 필터 로직 변경
mock mode tag 필터링
saved filter 저장 기능 (URL 동기화까지만)
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건(기존 baseline
   유지).
2. API mode HomeFeed/PostsBrowse의 FeedCard에서 태그 칩 클릭 → `/posts?tag=<tag>`
   로 이동하고 해당 태그 post만 표시. 카드의 post 상세 이동은 발생하지 않음.
3. PostDetail의 태그 칩 클릭 → 동일하게 `/posts?tag=<tag>` 이동.
4. AccountProfile post 목록의 FeedCard 태그 칩 클릭 → 동일 동작.
5. 이미 `/posts`에 있을 때 카드의 태그 클릭 → 목록과 필터 패널 입력이 새 태그로
   갱신됨. 브라우저 뒤로/앞으로 가기로도 필터 상태 복원.
6. 공백/특수문자가 포함된 태그도 올바르게 인코딩되어 동작.
7. 태그를 Tab으로 포커스 후 Enter로 이동 가능(focus ring 표시).
