# V0_1_0_READ_AT_SCALE_SCOPE.md

`feed-prototype` v0.1.0 — **Read at Scale** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.1.x(탐색과 발견) 테마 중 첫 기반 버전이며, ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤
작업한다" 규칙에 따라 작성되었습니다.

## 배경

외부 분석/생성 프로그램이 주기적으로 post package를 만들어 import하므로 데이터가
빠르게 누적됩니다. v0.0.0 시점의 `GET /api/posts`, `GET /api/feed`는 전체 post를
메모리에 로드한 뒤 Python에서 필터링하고 pagination이 없습니다. 데이터가 늘면
응답이 무거워지고 매일 쓰기 어려워집니다. v0.1.0은 데이터가 누적돼도 매일 쓸 수
있는 읽기/탐색 경험의 기반을 만듭니다.

## Goals

- `GET /api/posts`, `GET /api/feed`에 **cursor 기반 keyset pagination** 추가
  (`(created_at, id)` 기준, `limit` + `cursor`).
- 기존 MVP11 필터(keyword/tag/metadata/asset_type/account/my_posts_only)를
  **메모리 필터에서 SQL WHERE pushdown으로 전환**. pagination 정확성(필터 후
  limit)을 위해 필요합니다.
- **날짜 범위 필터**: `created_at_from`, `created_at_to` query parameter.
- **정렬 옵션**: 최신순(`sort=newest`, 기본), 오래된순(`sort=oldest`).
- frontend feed/browse에 **더보기(Load more)** (필요 시 infinite scroll로 확장).
- **필터 상태와 URL query parameter 동기화**. 이후 해시태그 클릭(v0.1.1),
  공유 가능한 링크의 기반.
- **golden sample 회귀 테스트**: 실제 생성 형태의 package를 repo에 박제하고
  import `--dry-run` 통과를 릴리즈 체크에 포함.
- `posts.metadata_json` 컬럼 **JSON → JSONB 전환 + GIN index** (Alembic
  migration). SQL metadata 필터(key 존재/값 매칭)의 기반.
- mock mode 동작은 변경하지 않습니다(전체 표시 유지).

## API 계약

### 공통 query parameter (posts, feed)

```text
limit              기본 20, 최대 100
cursor             직전 응답의 next_cursor (base64)
sort               newest(기본) | oldest
created_at_from    ISO date(YYYY-MM-DD) 또는 datetime, 포함(>=)
created_at_to      ISO date 또는 datetime, 포함(<=); date만 주면 그 날 끝까지
```

기존 MVP11 필터 parameter(`keyword`, `tag`, `metadata_key`, `metadata_value`,
`asset_type`, `account_id`, `account_handle`, `user_id`, `my_posts_only`)는
그대로 유지됩니다.

### 응답 shape

`GET /api/posts`:

```json
{ "items": [ /* PostWithAssets */ ], "next_cursor": "…|null", "has_more": true }
```

`GET /api/feed`:

```json
{ "user": { /* UserRead */ }, "items": [ /* FeedItem */ ],
  "next_cursor": "…|null", "has_more": true }
```

- `next_cursor`가 `null`이면 마지막 페이지입니다.
- `has_more`가 `true`인 동안 클라이언트는 `cursor=next_cursor`로 다음 페이지를
  요청합니다.

> 내부 read API 응답 shape 변경입니다. external post package JSON format은
> 변경하지 않으므로 format freeze 위반이 아닙니다.

## 정책 / 주의

- cursor는 `(created_at, id)` keyset 기준입니다. 같은 정렬·필터 조합에서만
  유효하며, 정렬/필터를 바꾸면 새 페이지 1부터 다시 시작합니다.
- metadata 값 매칭은 SQL `metadata_json ->> :key ILIKE :value%` 기준의 **scalar
  값 부분일치**입니다. 기존 Python 구현의 nested dict/list JSON dump 부분일치와
  미세한 의미 차이가 있을 수 있으나, MVP11 사용 사례(`source=...`,
  `severity=high` 등 scalar)는 동일하게 동작합니다.
- metadata key 존재 판정은 JSONB `?` 연산자를 사용하므로 `metadata_json`의 JSONB
  전환이 전제입니다.
- core domain(User/Account/Post/Feed/Follow/Asset/Metadata)을 유지하고 설비 전용
  용어를 core 이름에 넣지 않습니다. domain-specific value는 `metadata_json` 또는
  asset metadata에 둡니다(AGENTS.md Core Domain).

## Non-goals

```text
Elasticsearch / full-text search / semantic search / vector search
saved filter 저장 기능 (URL 동기화까지만)
해시태그 칩 클릭 링크 (v0.1.1)
검색창 # 라우팅 / tag 자동완성 (v0.1.2)
@mention 렌더링 (v0.1.3)
external post package format 변경
mock mode 제거 또는 mock mode pagination
복잡한 AND/OR 조건 빌더, exclude 필터
dashboard / analytics
```

## 검증 요약

1. `alembic upgrade head` → `posts.metadata_json` JSONB + GIN index 확인.
2. 기존 `data/external_posts/examples/*` package `--dry-run` 통과(format 회귀).
3. `GET /api/posts?limit=5` → 5건 + `next_cursor`/`has_more`. cursor로 다음
   페이지 요청 시 중복/누락 없음. `sort=oldest`, 날짜 범위, 기존 필터 동작.
4. `GET /api/feed?user_id=...&limit=...` 동일 + follow 스코프 유지.
5. frontend: API mode Load more 누적, 필터/정렬 변경 시 리셋, URL query 반영 및
   새로고침 복원. mock mode 동작 불변. `npm run build` 통과.
