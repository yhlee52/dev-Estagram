# V0_4_0_FACET_FILTER_SCOPE.md

`feed-prototype` v0.4.0 — **Facet 기반 필터** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.4.x(메타데이터 일급화 & 트리아지) 테마의 기반(x.y.0)
버전이며, "개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를
작성한 뒤 작업한다" 규칙에 따라 작성되었습니다. 진입 판단과 후보 정리는
`V0_4_X_METADATA_PLAN.md`를 참고합니다.

## 배경

ingestion(v0.3.x)으로 metadata가 풍부한 post가 대량 누적되면서, 다음 병목은
"읽기"가 아니라 "트리아지"입니다. 현재 metadata 필터는 자유 입력뿐입니다
(`PostFilters.metadata_key`/`metadata_value` → `jsonb_exists(...)` +
`(metadata_json ->> key) ILIKE %value%`). 사용자는 어떤 key가 존재하는지,
그 key에 어떤 value가 있는지 **기억해서** 타이핑해야 합니다.

v0.4.0은 자유 입력을 유지하면서, **데이터에 실제로 존재하는 key/value를 골라
넣는** facet 선택을 보강합니다. 새 필터 경로를 만드는 것이 아니라, 기존
`metadata_key`/`metadata_value` query 경로에 선택지를 채워주는 보조입니다.
집계는 v0.1.2 `get_top_tags`(빈도 집계) + `GET /api/tags`(자동완성) 패턴을
그대로 따릅니다.

## 확정된 결정 (2026-06-15)

- **단일 key + 단일 value 유지.** 한 key 안의 다중 value(OR)는 도입하지
  않습니다. AND/OR 쿼리 빌더는 테마 non-goal입니다.
- **facet 선택 value = 정확일치, 자유 입력 = 기존 ILIKE 부분일치 유지.**
  facet은 데이터에 존재하는 값을 고르는 것이므로 정확일치가 자연스럽습니다.
  둘을 구분하기 위해 optional `metadata_match` 파라미터를 추가합니다(기본
  `contains` = 현행 동작, 회귀 안전).

## Goals

### 1. `GET /api/metadata/keys`

- post에 실제로 존재하는 distinct metadata key를 사용 빈도순으로 반환합니다.
- query parameter: `limit` (기본 20, 1..100).
- 응답: `{ "items": [{ "key": "<key>", "count": <int> }, ...] }`,
  `count` 내림차순 → `key` 오름차순 정렬.
- 집계는 JSONB 최상위 key 기준입니다. `jsonb_object_keys(metadata_json)`로
  key를 펼쳐 `GROUP BY key`로 셉니다(객체 한 개당 key는 한 번 나오므로 count는
  "그 key를 가진 post 수"가 됩니다).
- `metadata_json`이 NULL인 post는 집계에 기여하지 않습니다.
- 중첩 객체 내부 key는 펼치지 않습니다(최상위 key만). generic 정책 유지.

### 2. `GET /api/metadata/values`

- 특정 key의 distinct value를 사용 빈도순으로 반환합니다.
- query parameter: `key` (필수), `limit` (기본 20, 1..100).
- 응답: `{ "key": "<key>", "items": [{ "value": "<value>", "count": <int> }, ...] }`,
  `count` 내림차순 → `value` 오름차순 정렬.
- value는 `(metadata_json ->> :key)` 텍스트 추출 기준입니다. scalar는 그
  문자열, 객체/배열은 JSON 텍스트로 나옵니다(generic — 도메인 의미 모름).
- 대량 value를 가진 key(자유 텍스트 등) 대비 `limit` + 빈도 정렬이 기본
  방어선입니다. value 목록은 "상위 N"이며 전수 목록이 아님을 응답이 함의합니다.
- `key`를 가진 post가 없으면 빈 `items`를 반환합니다(404 아님).

### 3. `metadata_match` 정확일치 모드

- `PostFilters`에 optional `metadata_match` 추가: `contains`(기본) | `exact`.
  - `contains` → 현행 `(metadata_json ->> key) ILIKE %value%` 그대로.
  - `exact` → `(metadata_json ->> key) = value` (대소문자 구분 정확일치).
- `metadata_value`가 없으면 `metadata_match`는 무시합니다(현행 "value 없으면
  필터 없음"과 일관). 값이 enum 밖이면 400.
- 기본값이 `contains`라 기존 URL/공유 링크/자유 입력 동작은 불변(회귀 안전).
- PostFilters를 만드는 라우트(`feed`, `posts`)에 `metadata_match` query
  parameter를 통과시킵니다.

### 4. 필터 패널 facet UI (API mode 전용)

- 자유 입력 `metadata_key`/`metadata_value` 입력칸은 **그대로 유지**합니다.
- 그 옆에 알려진 key 드롭다운(`GET /api/metadata/keys`)을 둡니다. key를
  고르면 `GET /api/metadata/values?key=<key>`로 value 드롭다운/칩을 띄웁니다.
- facet에서 value를 선택하면 `metadata_key`/`metadata_value`를 채우고
  `metadata_match=exact`로 설정합니다(= 기존 commit 경로로 적용).
- 자동완성/목록 로드는 v0.1.2 패턴을 따릅니다: API mode 진입 시 keys를 한 번
  로드, values는 key 선택 시 로드. 키 입력마다 재요청하지 않습니다.
- 접근성: 드롭다운은 `role="listbox"`, 입력 연동은 v0.1.2 `TagSearchInput`
  prior art를 따릅니다.

## 구현 메모

### Backend

- `app/schemas/feed.py`: `MetadataKeyCount`, `MetadataKeyListResponse`,
  `MetadataValueCount`, `MetadataValueListResponse` 추가. v0.1.2 `TagCount`/
  `TagListResponse`와 같은 형태.
- `app/services/post_filters.py`:
  - `get_metadata_keys(session, *, limit)`, `get_metadata_values(session, key,
    *, limit)` 추가. 기존 tag 집계 raw SQL과 같은 모듈에 두어 facet/tag 집계
    SQL을 한곳에 모읍니다. `count` alias는 `usage_count`(SQLAlchemy `Row.count`
    충돌 회피, v0.1.2와 동일).
  - `DEFAULT_FACET_LIMIT = 20`, `MAX_FACET_LIMIT = 100` 추가.
  - `PostFilters`에 `metadata_match: str | None = None` 필드 추가,
    `normalize_post_filters`에 포함.
  - `validate_post_filters`: `metadata_match` enum 검증(`contains`/`exact`),
    값 없을 때 무시.
  - `apply_filters_to_select`: metadata_value 분기에서 `exact`이면 `=`,
    아니면 기존 `ILIKE %...%`.
- `app/api/routes/metadata.py`: `GET /api/metadata/keys`,
  `GET /api/metadata/values` 라우트. `app/api/routes/__init__.py`에 등록.
- `app/api/routes/feed.py`, `app/api/routes/posts.py`: `metadata_match`
  query parameter를 받아 `PostFilters`에 전달.

### Frontend

- `src/api/types.ts`: `ApiMetadataKeyCount`, `ApiMetadataValueCount` +
  list response 타입 추가.
- `src/api/metadataApi.ts`: `getMetadataKeys(limit?)`,
  `getMetadataValues(key, limit?)`.
- 필터 상태 타입 + URL 동기화: `metadataMatch` 추가(값이 `exact`일 때만
  직렬화, 기본은 생략해 기존 링크와 호환).
- `src/components/PostFilterPanel.tsx`: 자유 입력 옆에 key 드롭다운, value
  드롭다운/칩. facet 선택 시 `metadata_key`/`metadata_value` 채우고
  `metadataMatch=exact` 설정 후 기존 commit 경로로 적용.
- `src/pages/HomeFeed.tsx`, `src/pages/PostsBrowsePage.tsx`: API mode에서
  keys 1회 로드해 패널에 전달.
- `src/config/appVersion.ts`: `v0.3.5` → `v0.4.0`.

### 회귀 체크 스크립트

- `backend/scripts/check_metadata_facets.py`: 기존 `check_*` 패턴을 따라
  `GET /api/metadata/keys`/`values`가 빈도순 목록을 반환하고 `metadata_match=
  exact`가 정확일치로 동작하는지 확인.

## 정책 / 주의

- **자유 입력 필터 동작 불변.** facet은 입력을 채워주는 보조이며, 기존
  `metadata_key`/`metadata_value` query 경로를 그대로 사용합니다. `metadata_match`
  기본값 `contains`로 기존 동작이 유지됩니다.
- **API mode 전용.** mock mode 필터 패널은 현행 유지(facet UI 미노출).
- **generic key-value 유지.** severity·chamber·recipe 같은 도메인 필드를 core
  model/공유 component/route/주요 UI 컨트롤에 하드코딩하지 않습니다. facet은
  값으로만 동작합니다.
- **distinct key/value는 데이터에서 파생.** metadata 스키마를 새로 정의하거나
  강제하지 않습니다.
- **external post package JSON format은 변경하지 않습니다.**
- value 목록은 "빈도순 상위 N"이며 전수 목록이 아닙니다. 자유 텍스트성 key는
  의미 있는 facet이 아닐 수 있음을 UI가 함의(드롭다운이 길어지지 않도록 limit).
- 구현 완료 후 `appVersion.ts`를 `v0.4.0`으로 올리고 `AGENTS.md` Completed
  Scope History·`docs/README.md` 색인·`ROADMAP.md` 진행 현황을 갱신합니다.

## Non-goals

```text
한 key 내 다중 value(OR), 여러 key AND/OR 조합, 쿼리 빌더
카드 metadata 칩 노출 / pinned keys (v0.4.1)
metadata 값 기준 정렬 (v0.4.1)
saved filter(이름 붙인 조합 저장) — 테마 후속 후보로 보류
analytics / 시계열 추세 차트 / dashboard
metadata 스키마 강제/검증, 중첩 key 펼치기
external package format 변경
mock mode facet UI
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건.
2. backend: `GET /api/metadata/keys` 가 빈도순 `{key, count}` 목록을 반환,
   `limit`으로 개수 제한. metadata_json NULL post는 미집계.
3. `GET /api/metadata/values?key=<key>` 가 해당 key의 빈도순 `{value, count}`
   목록을 반환. 없는 key는 빈 items.
4. `metadata_match=exact` + `metadata_key`/`metadata_value` → 정확일치만
   필터. `metadata_match` 생략/`contains` → 기존 ILIKE 부분일치 그대로.
5. 필터 패널에서 key 드롭다운 선택 → value 드롭다운/칩 표시 → value 선택 시
   해당 metadata 필터가 정확일치로 즉시 적용(URL에 `metadata_match=exact` 반영).
6. 자유 입력 metadata 필터는 facet UI와 무관하게 기존대로 동작.
7. mock mode에서는 facet UI가 노출되지 않고 기존 동작 유지.
8. `scripts/check_metadata_facets.py` 통과. golden sample import `--dry-run`
   회귀 통과(facet 추가가 import 경로에 영향 없음 확인).
```
