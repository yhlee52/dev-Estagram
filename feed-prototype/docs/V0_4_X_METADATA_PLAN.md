# V0_4_X_METADATA_PLAN.md

`feed-prototype` v0.4.x — **메타데이터 일급화 & 트리아지 (Metadata-first
Reading)** 테마 진입 판단과 v0.4.0~v0.4.1 후보 계획 문서입니다.

이 문서는 v0.3.x post-dev 점검(2026-06-14)에서 작성되었습니다. `ROADMAP.md`의
v0.4.x 항목을 코드 현황에 맞춰 구체화하고, 진입 전 확인할 사항을 정리합니다.
각 MINOR의 확정 scope는 착수 시 `V0_4_0_*_SCOPE.md` / `V0_4_1_*_SCOPE.md`로
분리해 작성합니다.

> **테마 진행 현황 (2026-06-14)**
> - v0.4.0 — Facet 기반 필터: **미착수**.
> - v0.4.1 — 카드 metadata 노출 & 값 정렬: **미착수**.
> - v0.4.x 마지막 MINOR — UX backlog 반영: **미착수(예약 슬롯)**.
> - 직전 테마 v0.3.x(Ingestion 신뢰성)는 **완료**(`appVersion.ts` 라벨 `v0.3.4`).
>   상세는 `archive/V0_3_X_INGESTION_PLAN.md` 및 `archive/V0_3_*_SCOPE.md`.

## 1. v0.3.x 완료 / 진입 판단

v0.3.x(Ingestion 신뢰성) 테마는 완료되었습니다.

- v0.3.0 HTTP Import API, v0.3.1 Import Batch 이력 API + 최소 UI, v0.3.2 자동
  이동/디렉터리 일괄 처리 CLI/폴링 Watch, v0.3.3 asset managed storage 복사
  (opt-in), v0.3.4 UX backlog 반영 — 5개 MINOR 모두 구현.
- 테마 마지막 MINOR(UX backlog 반영) 슬롯 사용 완료.
- 차단(blocking) 버그 없음. `UX_BACKLOG.md`의 Open 1건(Me 탭 "내가 팔로우한
  계정" 목록)은 메모대로 v0.5.x(협업)로 의도적 이연 — 회귀 아님.

**판단: v0.4.x 진입 가능.**

> 순서 근거(ROADMAP 재확인): ingestion으로 metadata가 풍부한 post가 대량
> 누적되면 다음 병목은 "읽기"가 아니라 "트리아지"입니다. 자유 입력 필터(MVP11)를
> 넘어 metadata를 일급 차원(facet 필터·카드 칩·값 정렬)으로 올리는 v0.4.x를
> 협업(v0.5.x)·인증(v0.6.x)보다 먼저 둡니다. generic 메커니즘이지만 리포트/분석
> post(severity·chamber·recipe를 한눈에)에서 특히 강력합니다.

### 진입과 함께 유지되는 정책

- mock mode는 v0.3.0부터 **"UI 데모 전용 동결"** 상태입니다. v0.4.x 신규 기능은
  API mode에만 추가해도 되며, mock mode를 제거하지는 않습니다.
- external post package JSON format **동결 유지**. v0.4.x는 기존에 들어온
  `metadata_json`을 **읽는 방식**만 강화합니다. 새 필드 추가/필수화 없음.
- distinct key/value 목록은 **데이터에서 파생**합니다. metadata 스키마를 새로
  정의하거나 강제하지 않습니다.

## 2. 코드 현황 (재사용 기반)

v0.4.x도 대부분 기존 자산 위에 얇게 얹는 작업입니다.

- **metadata 저장이 JSONB + GIN**: `Post.metadata_json`은 migration
  `0005_metadata_json_jsonb_gin`로 JSONB + GIN index. key/value 집계와 존재
  검사가 인덱스 친화적입니다.
- **자유 입력 metadata 필터 존재**: `app/services/post_filters.py`가 이미
  `metadata_key`/`metadata_value`를 받아 `jsonb_exists(...)` +
  `(metadata_json ->> key) ILIKE value`로 필터링합니다(v0.4.0은 이 위에 알려진
  key/value 선택지를 얹는 것이지, 새 필터 경로를 만드는 것이 아님).
- **빈도 집계 패턴 존재**: `get_top_tags`가 `json_array_elements_text` + count +
  `order_by`로 상위 tag를 반환합니다. facet API의 distinct key/value + 빈도
  집계가 그대로 따라갈 패턴입니다.
- **자동완성 UI 패턴 존재**: v0.1.2의 `GET /api/tags` + 검색창 tag 자동완성.
  facet 드롭다운/칩 선택 UI가 재사용할 prior art입니다.
- **정렬·커서 골격 존재**: `apply_sort_and_cursor`가 newest/oldest + cursor를
  처리합니다. v0.4.1의 metadata 값 정렬은 이 정렬 축을 확장하는 형태입니다.
- **필터 ↔ URL 동기화 존재**: v0.1.0에서 필터 상태와 URL query를 동기화. pinned
  key·facet 선택도 같은 메커니즘에 얹습니다(localStorage 병행은 scope에서 결정).

## 3. v0.4.x 후보 (MINOR 분해)

`ROADMAP.md` v0.4.x 항목을 코드 현황에 맞춰 구체화한 것입니다. 각 MINOR는 하나의
집중된 변경 묶음입니다. 확정 결정은 각 `V0_4_*_SCOPE.md`에서 합니다.

### v0.4.0 — Facet 기반 필터 (테마 기반 작업, x.y.0)

목표: 자유 입력 metadata 필터를 **알려진 key/value의 선택**으로 보강한다(자유
입력은 유지).

- facet API(경로명은 scope에서 확정): distinct metadata key 목록 + 사용 빈도,
  그리고 특정 key의 distinct value 목록 + 빈도. `get_top_tags` 집계 패턴 재사용.
  - 후보: `GET /api/metadata/keys`, `GET /api/metadata/values?key=<key>`.
  - 대량 value를 가진 key(예: 자유 텍스트) 대비 `limit` + 빈도 정렬 기본 적용.
- 필터 패널 보강: 자유 입력 옆에 알려진 key 드롭다운, key 선택 시 value
  드롭다운/칩. 기존 `metadata_key`/`metadata_value` query 경로를 그대로 사용.
- **API mode 전용**(mock 동결 정책에 부합). mock 모드 필터 패널은 현행 유지.
- 회귀 안전장치: 기존 자유 입력 필터 동작 불변(facet은 입력을 채워주는 보조).

결정 필요(scope에서):
- 단일 key + 단일 value 유지(현행) vs 다중 value(OR) 허용 여부. 복잡한 AND/OR
  쿼리 빌더는 non-goal이므로, 최소 확장(예: 한 key 안의 다중 value OR)까지만 검토.
- value facet의 ILIKE 부분일치(현행)와 정확일치 선택지의 관계 정의.

### v0.4.1 — 카드 metadata 노출 & 값 정렬

목표: 고른 metadata를 카드에서 바로 읽고, 값 기준으로 정렬한다.

- pinned keys: 사용자가 고른 metadata key를 PostCard/Explore 카드에 칩으로 고정
  표시. 상태는 URL query + localStorage 병행(scope에서 우선순위 확정).
- metadata 값 정렬: 기존 newest/oldest 정렬 축에 "선택한 metadata key의 값" 정렬
  추가. 숫자/날짜 인식(문자열 사전순 fallback). `apply_sort_and_cursor` 확장.
  - 주의: JSONB 값은 텍스트라 숫자/날짜 정렬은 캐스팅·NULL 처리·커서 안정성
    설계가 필요. cursor 호환을 깨지 않도록 tie-breaker(post id) 유지.
- **API mode 전용**. 카드 칩 렌더는 generic key-value만 알고, 도메인 의미를
  모른다(값으로만 렌더).

### v0.4.x 마지막 MINOR — UX backlog 반영 (예약 슬롯)

`ROADMAP.md` 규칙대로 테마 마지막 MINOR는 `UX_BACKLOG.md` 반영용으로 예약.
이 테마 작업 중 새로 쌓이는 항목과, 기존 Open 항목 중 metadata 읽기와 맞닿는
것들을 여기서 재평가합니다(예: Me 탭 Following 목록은 backlog 메모상 v0.5.x가
자연스러우므로 그대로 이연 여부 확인).

## 4. v0.4.x 메타데이터 정책 (ROADMAP 재확인)

```text
facet/정렬/칩은 모두 generic key-value 위에서 동작한다
severity, recipe, chamber, equipment 같은 도메인 필드를 core model / 공유
  component / route / 주요 UI 컨트롤에 하드코딩하지 않는다 (값으로만 유지)
distinct key/value 목록은 데이터에서 파생한다 (스키마를 새로 정의하지 않는다)
external post package JSON format은 동결 유지 (새 필드는 optional로만)
mock mode는 데모 전용 동결 (제거하지 않음)
인증/JWT/session/OAuth는 범위 밖 (v0.6.x)
```

## 5. v0.4.x non-goals (ROADMAP 재확인)

```text
analytics / 시계열 추세 차트 / dashboard
복잡한 AND/OR 쿼리 빌더
saved filter(이름 붙인 조합 저장) — 후속 후보로 보류
batch/source 단위 그룹 읽기 — 후속 후보로 보류 (v0.3.1 batch 이력이 기반)
metadata 스키마 강제/검증
```

## 6. 진입 전 권장 정리 (선택)

진행에 필수는 아니지만 v0.4.x 작업 품질을 높이는 정리:

- v0.3.x 완료 처리 잔여(post-dev 점검에서 반영): 문서 버전 라벨 v0.3.4 동기화,
  v0.3.x scope 문서 `archive/` 이동, `public/assets/managed/` gitignore 추가는
  처리됨. 새 facet API 추가 시 `scripts/`에 회귀 체크 스크립트(예:
  `check_metadata_facets.py`)를 함께 두는 것을 권장(기존 check_* 패턴).
- facet/정렬 추가로 늘어나는 query 경로는 기존 `post_filters.py` 단일 진입점에
  모읍니다. 새 추상화를 만들기 전에 현 패턴을 따릅니다.

## 7. 다음 행동

1. v0.4.0 착수 시 `V0_4_0_FACET_FILTER_SCOPE.md`를 작성해 facet API 경로·집계
   범위·다중 value 허용 여부를 확정한다.
2. 구현 후 `appVersion.ts` 라벨을 `v0.4.0`으로 올리고, `AGENTS.md` Completed
   Scope History·`docs/README.md` 색인·`ROADMAP.md` 진행 현황을 갱신한다.
3. v0.4.1(카드 칩 + 값 정렬), 이어서 마지막 MINOR(UX backlog)로 진행한다.
