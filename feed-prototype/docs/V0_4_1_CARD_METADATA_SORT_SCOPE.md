# V0_4_1_CARD_METADATA_SORT_SCOPE.md

`feed-prototype` v0.4.1 — **카드 metadata 노출 & 값 정렬** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.4.x(메타데이터 일급화 & 트리아지) 테마 두 번째 MINOR입니다.
(이 문서는 구현과 함께/직후 작성되었습니다 — v0.4.x는 테마 완료 시점에 문서를
일괄 정리하는 방식으로 진행했습니다.)

## 배경

v0.4.0이 facet 필터로 metadata를 "고를" 수 있게 했습니다. 다음 단계는 고른
metadata를 (1) 카드에서 글을 열지 않고 바로 읽고, (2) 값 기준으로 정렬해
트리아지하는 것입니다. 기존 newest/oldest 정렬 축(`apply_sort_and_cursor`)과
카드 렌더(`FeedCard`/`MetadataSummary`)를 확장합니다.

## 확정된 결정 (2026-06-15)

- **값 정렬 = 텍스트 사전순.** JSONB 값은 텍스트라 `(metadata_json ->> key)`를
  사전순 비교합니다. 문자열·ISO 날짜는 정확히 정렬되고, 숫자는 사전순
  ("10" < "2")입니다. 숫자 인식 정렬은 v0.4.x 후속으로 미룹니다.
- **정렬 대상 = 그 key가 있고 non-null인 post만.** values facet과 동일 규칙.
  keyset cursor가 NULL 비교 없이 안정적으로 동작합니다("그 필드로 정렬"의
  자연스러운 의미이기도 함).
- **pinned keys = localStorage 표시 설정.** URL 동기화는 범위 밖(공유 필터가
  아닌 개인 표시 취향).

## Goals

### 1. metadata 값 정렬 API

- `sort=metadata_asc | metadata_desc` + `sort_metadata_key=<key>`.
  metadata 정렬인데 key가 없으면 400.
- `(metadata_json ->> key)` 텍스트 사전순 + `post id` tie-breaker(안정 정렬).
- 정렬 대상은 `jsonb_exists(metadata_json, key)` 이고
  `(metadata_json ->> key) IS NOT NULL` 인 post로 제한(`_apply_metadata_sort_and_cursor`).
- cursor: `encode_cursor`가 정렬 모드별로 값을 인코딩(metadata는
  `jsonb_text`로 `->>` 텍스트와 일치, bool은 "true"/"false"). `decode_cursor`는
  `rsplit("|", 1)`로 값에 `|`가 있어도 id를 안전하게 분리. keyset 비교는 raw
  text로 ORDER BY와 일치시킴.
- `feed`/`posts` 라우트에 `sort_metadata_key` query parameter 통과.

### 2. pinned keys — 카드 metadata 칩

- 사용자가 고른 metadata key를 `FeedCard`(Home/Browse/Explore 공통)에 칩으로
  고정 표시. 칩은 generic key:value 렌더(도메인 의미 모름).
- 상태: `usePinnedMetadataKeys`(localStorage + storage/custom event 동기화).
- 선택 UI: 필터 패널의 `PinnedMetadataKeysControl`(알려진 key 토글 칩).
- 카드 칩(`PinnedMetadataChips`)은 post가 실제 가진 pinned key만 렌더.

### 3. 정렬 UI

- 필터 패널 정렬 select에 "Metadata value ↑/↓" 옵션 추가(알려진 key가 있을
  때만 = API mode). 선택 시 key 드롭다운 노출, key 미선택이면 Apply 시 inline
  검증 에러.

## 구현 메모

### Backend

- `app/services/post_filters.py`: `METADATA_SORTS`, `ALLOWED_SORTS` 확장,
  `PostPagination.sort_metadata_key`, `validate_pagination` key 필수화,
  `jsonb_text`, `encode_cursor(post, pagination)` 시그니처 변경,
  `decode_cursor` rsplit, `_cursor_datetime`, `_apply_metadata_sort_and_cursor`.
- `app/api/routes/feed.py`, `app/api/routes/posts.py`: `sort_metadata_key` 통과.

### Frontend

- `src/types/filters.ts`: `PostSort`에 `metadata_asc`/`metadata_desc`,
  `sortMetadataKey` 필드.
- `src/api/postFilterQuery.ts`, `src/utils/filterUrl.ts`: sort +
  `sort_metadata_key` 직렬화/파싱(기본 newest는 생략).
- `src/components/PostFilterPanel.tsx`: 정렬 옵션·key 드롭다운·검증.
- `src/hooks/usePinnedMetadataKeys.ts`, `src/components/PinnedMetadataKeysControl.tsx`,
  `src/components/PinnedMetadataChips.tsx`, `src/components/FeedCard.tsx` 칩 렌더.
- `src/config/appVersion.ts`: `v0.4.0` → `v0.4.1`.

## 정책 / 주의

- **generic key-value 유지.** 도메인 필드 하드코딩 없음. 칩/정렬 모두 값으로만.
- **API mode 전용** 추가 UI(정렬 metadata 옵션·facet·pinned picker). mock 현행 유지.
- **회귀 안전.** 기본 sort=newest 동작 불변, cursor 포맷은 정렬 모드별로
  자기완결적. 기존 newest/oldest cursor도 그대로 동작.
- 숫자 정렬 미지원(텍스트 사전순). metadata 정렬은 key 보유 post로 한정.

## Non-goals

```text
숫자/날짜 타입 캐스팅 정렬 (텍스트 사전순까지)
pinned keys URL 동기화 / 계정별 동기화 (localStorage까지)
여러 key 동시 정렬, 복합 정렬
PostDetail 등 카드 외 표면의 pinned 칩
external package format 변경
mock mode 신규 UI
```

## 검증 요약

1. `npm run build`(tsc+vite) 통과, `npm run lint` 신규 에러 0건.
2. `sort=metadata_asc&sort_metadata_key=<key>` → 그 key 가진 post만 값 사전순
   정렬, id tie-breaker. desc는 역순. key 누락 시 400.
3. Load more(cursor)가 metadata 정렬에서도 연속 페이지를 정확히 이어줌
   (값에 `|` 포함 케이스 포함).
4. 필터 패널에서 key를 pin → 카드에 key:value 칩 표시, 새로고침 후 유지.
5. 정렬 metadata 옵션 선택 후 key 미선택이면 Apply 시 검증 에러.
