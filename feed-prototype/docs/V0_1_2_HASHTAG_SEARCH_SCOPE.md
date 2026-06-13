# V0_1_2_HASHTAG_SEARCH_SCOPE.md

`feed-prototype` v0.1.2 — **해시태그 검색 최적화** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.1.x(탐색과 발견) 테마 중 세 번째 버전이며, ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤
작업한다" 규칙에 따라 작성되었습니다.

## 배경

v0.1.0에서 backend `tag` 필터와 필터 ↔ URL query parameter 동기화를,
v0.1.1에서 태그 칩을 `/posts?tag=<tag>` 링크로 만들었습니다. 이제 태그로
이동하는 경로는 ① 필터 패널의 `Tag` 입력칸에 직접 입력, ② 카드/상세의 태그
칩 클릭 두 가지입니다.

하지만 사람은 보통 검색창(keyword 입력)에 `#tag` 형태로 태그를 칩니다.
현재는 `#tag`가 keyword로 처리되어 제목/본문/계정명을 부분일치 검색할 뿐,
태그 필터로 가지 않습니다. 또 어떤 태그가 많이 쓰이는지 알 방법이 없어 태그를
"기억해서" 입력해야 합니다.

v0.1.2는 검색창을 태그 친화적으로 만듭니다. `#`로 시작하면 태그 필터로
라우팅하고, 사용 빈도순 태그 목록을 backend에서 받아 검색창에 자동완성을
띄웁니다.

## Goals

### 1. 검색창 `#` → tag 라우팅

- 검색창(keyword 입력)에 `#`로 시작하는 값을 넣고 Apply하면, keyword 검색이
  아니라 `#` 뒤 문자열을 **tag 필터**로 적용합니다.
  - 예: 검색창에 `#chamber` 입력 → `/posts?tag=chamber` 와 동일한 결과.
- 변환은 순수 함수 `routeHashtagSearch(filters)`로 구현해 HomeFeed와
  PostsBrowsePage 두 검색 표면에서 동일하게 동작합니다.
- 라우팅 규칙(단일 태그 정책, v0.1.1과 일관):
  - keyword가 `#`로 시작하면 `#`를 떼고 trim한 값을 `tag`로 설정하고 keyword는
    비웁니다(태그 클릭 = 해당 태그로 교체).
  - `#`만 입력했거나 뒤가 공백이면 태그가 비므로 필터가 적용되지 않습니다.
- 라우팅 후에도 URL은 기존 계약 그대로 `tag=<tag>`로 직렬화됩니다. 공유 링크,
  뒤로/앞으로 가기, 태그 칩 링크와 완전히 호환됩니다.

### 2. `GET /api/tags`

- 사용 빈도순 상위 N개 tag를 반환합니다.
- query parameter: `limit` (기본 20, 1..100).
- 응답: `{ "items": [{ "tag": "<tag>", "count": <int> }, ...] }`,
  `count` 내림차순 → `tag` 오름차순 정렬.
- 집계는 기존 tag 필터와 **동일한 대소문자 무시 의미**를 따릅니다.
  `lower(tag)` 기준으로 묶고 소문자 형태로 반환합니다(태그 필터가
  `lower(tag_elem) = lower(:tag_value)`이므로 일관).
- 빈 태그 배열 post는 집계에 기여하지 않습니다.

### 3. 검색창 tag 자동완성 UI

- 검색창 입력이 `#`로 시작하면, `GET /api/tags`로 받아온 인기 태그 중 `#` 뒤
  접두어와 매칭되는 것을 드롭다운으로 제안합니다.
  - 접두어가 비어 있으면(`#`만 입력) 인기 태그 상위를 그대로 보여줍니다.
  - 매칭은 대소문자 무시 접두어(prefix) 매칭, 표시 개수는 상한을 둡니다.
- 제안을 마우스 클릭 또는 키보드(↑/↓ 이동, Enter 선택, Esc 닫기)로 선택하면
  해당 tag 필터가 즉시 적용됩니다(= `#tag` 입력 후 Apply와 동일 경로).
- 접근성: 입력은 `role="combobox"`, 목록은 `role="listbox"`,
  `aria-activedescendant`로 현재 강조 항목을 연결합니다.
- 인기 태그 목록은 API mode 진입 시 한 번 받아옵니다(검색 표면별 1회).
  키 입력마다 재요청하지 않고 클라이언트에서 접두어 필터링합니다.

## 구현 메모

### Backend

- `app/schemas/feed.py`: `TagCount`, `TagListResponse` 추가.
- `app/services/post_filters.py`: `get_top_tags(session, limit)` 추가. 기존
  tag 필터의 `json_array_elements_text` raw SQL과 같은 모듈에 두어 태그 관련
  SQL을 한곳에 모읍니다. `count`는 SQLAlchemy `Row.count`(tuple 메서드)와
  충돌하므로 alias를 `usage_count`로 둡니다.
- `app/api/routes/tags.py`: `GET /api/tags` 라우트. `app/api/routes/init.py`에
  등록.

### Frontend

- `src/api/types.ts`: `ApiTagCount`, `ApiTagListResponse` 추가.
- `src/api/tagsApi.ts`: `getTags(limit?)`.
- `src/utils/hashtagSearch.ts`: `routeHashtagSearch(filters)` 순수 함수.
- `src/components/TagSearchInput.tsx`: keyword 입력 + 자동완성 드롭다운
  (combobox). 매칭/강조/키보드 상태를 내부에서 관리.
- `src/components/PostFilterPanel.tsx`: keyword `<input>`을 `<TagSearchInput>`
  으로 교체. `tagSuggestions`, `onSelectTag` props 추가.
- `src/pages/HomeFeed.tsx`, `src/pages/PostsBrowsePage.tsx`: API mode에서 인기
  태그를 1회 로드해 패널에 전달. Apply와 태그 선택은 `routeHashtagSearch`를
  거쳐 기존 commit 경로(각 페이지의 URL/state 동기화)로 적용.
- `src/config/appVersion.ts`: `v0.1.1` → `v0.1.2`.

## 정책 / 주의

- **단일 태그만 필터링합니다.** `#`로 시작하는 입력은 첫 토큰 하나를 태그로
  봅니다(공백 포함 태그도 `#` 뒤 전체 문자열을 trim해 하나의 태그로 처리).
  여러 태그 AND/OR 조합은 범위 밖(v0.1.x non-goal).
- keyword 검색과 tag 필터는 backend에서 별개 조건입니다. `#` 라우팅은
  keyword를 비우고 tag만 설정하므로 둘이 섞이지 않습니다.
- 자동완성/`#` 라우팅은 필터가 동작하는 **API mode 전용**입니다. mock mode는
  기존처럼 검색/필터가 적용되지 않습니다(검색창 자체는 막지 않음).
- `GET /api/tags` 집계는 대소문자 무시 기준이라 `#Chamber`와 `#chamber`는 한
  항목으로 합산되어 소문자로 표시됩니다.
- external post package JSON format은 변경하지 않습니다.

## Non-goals

```text
Elasticsearch / full-text / semantic search (v0.1.x non-goal)
여러 태그 AND/OR 조합, exclude 태그
검색 결과 하이라이트, 검색어 기록/추천(빈도 외 personalization)
GET /api/tags 서버측 prefix 필터(클라이언트 접두어 필터로 충분)
@mention 렌더링 (v0.1.3)
saved filter 저장 기능 (URL 동기화까지만)
external package format 변경
mock mode 검색/필터링
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건.
2. backend: `GET /api/tags` 가 빈도순 `{tag, count}` 목록을 반환.
   `limit`으로 개수 제한. 대소문자 다른 태그가 한 항목으로 합산.
3. 검색창에 `#tag` 입력 후 Apply → `/posts?tag=tag`로 라우팅되고 해당 태그
   post만 표시. keyword는 비워짐.
4. 검색창에 `#` 또는 `#부분문자열` 입력 → 인기/매칭 태그 드롭다운 표시.
5. 드롭다운 항목 클릭 → 해당 tag 필터 즉시 적용. 키보드 ↑/↓/Enter/Esc 동작.
6. `#` 없이 일반 keyword 입력 → 기존 keyword 검색 그대로 동작(드롭다운 없음).
7. HomeFeed와 PostsBrowsePage 양쪽 검색창에서 동일하게 동작.
