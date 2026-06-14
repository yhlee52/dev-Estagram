# V0_3_1_BATCH_HISTORY_SCOPE.md

`feed-prototype` v0.3.1 — **Import Batch 이력 API + 최소 UI** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.3.x(Ingestion 신뢰성) 테마 두 번째 MINOR이며, v0.3.0
(HTTP Import API) 위에 "무엇이 언제 들어왔는지"를 가시화합니다. ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서를 작성한 뒤 작업한다" 규칙과
`V0_3_X_INGESTION_PLAN.md`의 v0.3.1 후보를 구체화한 것입니다.

## 배경

v0.3.0으로 CLI/HTTP 어느 경로로도 package를 import할 수 있게 되었지만, "어떤
batch가 언제 들어왔고 무엇이 생성/갱신/실패했는지"를 확인할 방법은 없습니다.
현재 batch 흔적은 `Post.import_batch_external_id`(migration `0003`)뿐이며, 이는
post에 흩어진 외래키일 뿐 import 사건(event) 자체의 기록이 아닙니다. 실패한
import은 아예 흔적이 남지 않습니다.

v0.3.1은 **import 사건을 1급 레코드로 보존하는 `import_batch` 테이블**을 신설하고,
이를 조회하는 읽기 API와 최소 UI를 추가합니다. 이는 v0.3.2(성공→archive /
실패→failed 자동 이동)의 상태 판단 기반이 됩니다.

## 결정 사항 (진입 시 확정)

`V0_3_X_INGESTION_PLAN.md` 3장 v0.3.1 후보의 "결정 필요" 항목을 확정합니다.

- **저장 방식: 별도 `import_batch` 테이블 신설.** post 집계만으로는 (1) 실패
  batch, (2) import 시점의 사건 카운트(이후 재import로 덮이는 값), (3) source 등
  batch 메타를 보존할 수 없습니다. 별도 테이블로 사건을 박제합니다.
- **UI 위치: 신규 `/imports` 라우트.** ingestion 운영 화면으로 명확히 분리하며
  **API mode 전용**입니다(mock 동결 정책에 부합). Me 탭에는 넣지 않습니다.
- **실패 batch 기록 방식:** 성공 batch는 import 트랜잭션과 **원자적으로** 기록하고,
  실패 batch는 rollback 후 **별도 트랜잭션**으로 기록합니다(아래 "쓰기 통합" 참조).
  스키마 검증(422) 단계 실패는 batch.external_id를 신뢰할 수 없으므로 기록하지
  않습니다(payload가 파싱된 의미 오류부터 기록).

## 재사용 기반 (코드 현황)

- `app/services/import_external_posts.py`의 `import_payload(session, payload, *,
  dry_run) -> ImportSummary`: batch 사건 카운트의 원천. 성공 batch 기록을 이
  함수 끝에 더합니다(commit은 기존대로 caller가 수행).
- `run_import(...)`(CLI)와 `app/api/routes/imports.py`의 `create_import`(HTTP):
  두 진입점 모두 동일한 트랜잭션 규약을 가집니다. 실패 batch 기록을 두 caller에
  공통으로 끼웁니다.
- `ExternalImportBatch`(`app/schemas/external_import.py`): `external_id`,
  `source`, `created_at`(payload가 선언한 batch 생성 시각). batch 행의 입력 소스.
- `ImportSummary`(dataclass): batch 행에 박제할 사건 카운트.
- 모델/마이그레이션 패턴: `app/models/*.py`의 SQLModel(`id` PK + `external_id`
  unique index 규약, `Account`/`Post` 참고), Alembic `versions/000N_*.py`.
- 라우터 등록: `app/api/routes/imports.py`에 GET 추가 → 이미 `init.py`에 등록됨
  (신규 라우터 불필요, 기존 `imports_router`에 핸들러만 추가).

## Goals

### 1) 데이터 모델: `import_batch` 테이블

신규 모델 `app/models/import_batch.py` + Alembic migration
`0006_add_import_batch_table.py`. 컬럼(초안):

```text
id                  str   PK   (예: "import-batch-{uuid4}")
external_id         str   unique index   (payload.batch.external_id)
source              str?  (payload.batch.source)
batch_created_at    datetime?  tz-aware   (payload.batch.created_at; naive 허용 스펙)
status              str   "success" | "failed"
error_message       str?  (실패 시 ImportErrorWithMessage 등 메시지)
first_imported_at   datetime  tz-aware   (최초 import 시각)
last_imported_at    datetime  tz-aware   (최근 import 시각; 재import 시 갱신)
import_count        int   (이 batch_external_id로 import가 실행된 횟수)
-- 최근 import 사건의 ImportSummary 카운트 스냅샷 --
accounts_created/accounts_updated
users_created/users_updated
posts_created/posts_updated/posts_skipped
asset_replace_target_posts/assets_deleted/assets_created
errors
```

- **upsert 키는 `external_id`.** 같은 batch를 재import하면 새 행을 만들지 않고
  기존 행을 갱신(`last_imported_at`, `import_count += 1`, status/카운트 스냅샷
  최신화)합니다. `first_imported_at`은 보존합니다.
- 모델은 core domain을 바꾸지 않습니다. `import_batch`는 ingestion 운영 메타이며
  User/Account/Post/Feed/Follow/Asset/Metadata 도메인에 새 개념을 더하지 않습니다.
- migration은 add-only(테이블 신설). 기존 테이블/`Post.import_batch_external_id`는
  그대로 둡니다.

### 2) 쓰기 통합 (CLI/HTTP 공통으로 batch 기록)

batch 이력은 진입점과 무관하게 남아야 하므로, route가 아니라 **서비스 계층**에서
기록합니다.

- **성공 기록:** `import_payload`가 (dry_run이 아닐 때) 반환 직전 `import_batch`
  행을 upsert합니다(status="success", 카운트 스냅샷, 시각/횟수 갱신). caller의
  `commit()`에 포함되어 posts와 **원자적으로** 커밋됩니다. dry_run이면 기록하지
  않습니다(아무 것도 쓰지 않는 dry_run 규약 유지).
- **실패 기록:** caller(`run_import`, `create_import`)가 예외를 잡아 `rollback()`
  한 뒤, **새 세션/트랜잭션**으로 `record_failed_batch(payload.batch, message)`를
  호출해 status="failed" 행을 upsert/commit합니다. 단 다음은 기록하지 않습니다:
  (1) payload가 파싱되지 않은 단계(스키마 위반 422 / CLI의 load 실패 — batch
  external_id를 신뢰할 수 없음), (2) **dry_run 실패**(dry_run은 성공/실패와
  무관하게 DB에 아무 것도 쓰지 않는다는 규약을 깨면 안 됨).
- **dry_run 불변식:** dry_run에서는 성공이든 실패든 `import_batch` 행을 절대
  쓰지 않습니다. 이는 기존 dry-run 기반 회귀 스크립트
  (`check_golden_samples.py`, `check_http_import.py`)의 "DB 미기록" 보장을 그대로
  유지하기 위한 핵심 제약입니다.
- 공통 헬퍼는 `import_external_posts.py`에 둡니다(예: `record_batch(session,
  batch, summary, *, status, error_message=None)`). import 로직 중복 없이 한 곳.

### 3) 읽기 API (조회)

기존 `imports_router`(`prefix="/api/imports"`)에 핸들러 추가. 신규 응답 스키마는
`app/schemas/external_import.py` 또는 `feed.py`에 pydantic으로 정의.

- **`GET /api/imports`** — batch 목록. `last_imported_at` 내림차순.
  - 항목: `external_id`, `source`, `status`, `batch_created_at`,
    `first_imported_at`, `last_imported_at`, `import_count`, 사건 카운트 요약
    (posts_created/updated/skipped 등), 그리고 **현재 이 batch에 귀속된 post 수**
    (`SELECT COUNT(*) FROM posts WHERE import_batch_external_id = ?`, live count).
  - 사건 카운트(스냅샷)와 live count의 의미 차이를 응답/문서에서 구분합니다:
    스냅샷 = "그 import에서 무엇이 일어났나", live = "지금 이 batch 소속 post 수"
    (재import로 덮일 수 있음).
  - 현 데이터 규모에선 pagination 없이 전량 반환으로 시작합니다(누적 시
    pagination은 후속 — UX_BACKLOG/ v0.4.x 후보).
- **`GET /api/imports/{batch_external_id}`** — batch 상세.
  - batch 행 전체 + 현재 귀속 post 목록(`id`, `external_id`, `title`,
    `account` handle/display_name, `created_at`, `imported_at`). 최신순.
  - 존재하지 않는 `batch_external_id` → **404**.

### 4) 최소 UI (`/imports`, API mode 전용)

- 신규 라우트 `/imports`. 좌측 네비 레일에 진입점 추가하되 **API mode에서만**
  노출(mock mode에선 항목 숨김 또는 "API mode 전용" 안내).
- 목록 화면: batch별 카드/행 — `external_id`(+source), status 배지(성공/실패),
  최근 import 시각, posts created/updated/skipped, 현재 귀속 post 수. 행 클릭 →
  상세.
- 상세 화면: batch 메타 + 사건 카운트 + 귀속 post 목록(각 post는 기존 PostDetail/
  PostCard로 연결). 실패 batch는 `error_message` 표시.
- mock mode 진입 시: 동결 정책에 따라 데이터 연동 없이 "API mode 전용" empty
  state를 보여줍니다(신규 mock 데이터/overlay 추가하지 않음).
- 기존 컴포넌트(EmptyState, 카드/배지, 네비 레일 패턴)를 재사용하고 새 디자인
  시스템을 들이지 않습니다.

## 회귀 안전장치

- **기존 회귀 스크립트는 그대로 통과(수정 불필요).** `check_golden_samples.py`,
  `check_http_import.py`는 모두 dry-run/거부 요청만 보냄 → 위 dry_run 불변식에 따라
  `import_batch`에 아무 것도 쓰지 않으므로 "DB 미기록" 보장과 통과 결과가 동일.
  사용하는 sample package도 동일(추가/변경 없음).
- 실제(non-dry-run) import에서만 `import_batch` 행이 생김. golden sample을
  `dry_run=false`로 import하면 post upsert 결과는 종전과 동일하고 batch 행이 함께
  기록되는지 확인(신규 pytest).
- 재import 안전성 유지: 같은 package 재import 시 post 중복 없음(종전과 동일),
  batch는 새 행 없이 갱신(`import_count`만 증가). format freeze의 "재import는 항상
  안전" 규칙을 깨지 않음.
- 신규 backend 테스트:
  1. 성공 import 후 `import_batch` 1행 생성(status="success", 카운트 일치).
  2. 같은 batch 재import 시 행이 **늘지 않고** 갱신(`import_count` 증가,
     `first_imported_at` 보존, `last_imported_at` 갱신).
  3. 의미 오류(중복 external_id / 미존재 account) import → posts 롤백되지만
     `import_batch`에 status="failed" 행 1개 기록(+error_message).
  4. dry_run은 `import_batch` 무변화.
  5. `GET /api/imports` 정렬/카운트(스냅샷 vs live) 정확, 빈 상태 200 + 빈 목록.
  6. `GET /api/imports/{id}` 상세 post 목록 정확, 미존재 id → 404.

## 정책 / 주의

- **external post package JSON format 변경 없음.** `import_batch`는 수신 형식이
  아니라 서버 측 운영 메타입니다. 기존 필드/스키마/upsert 규칙 그대로(format
  freeze 유지).
- **import 로직 중복 금지.** batch 기록은 `import_external_posts.py` 한 곳의
  헬퍼로 처리하고 route/CLI는 호출만 합니다. 트랜잭션 규약(success=원자적,
  failed=별도 트랜잭션)을 두 진입점에서 동일하게 맞춥니다.
- **core domain 유지.** `import_batch`는 ingestion 메타 테이블이며 core 7개념을
  바꾸지 않습니다(AGENTS.md Core Domain).
- **mock 동결.** UI는 API mode 전용. mock mode에 batch 기능/데이터를 추가하지
  않습니다.
- **인증 범위 밖.** 읽기 API는 기존 다른 GET과 동일한 (비인증) 노출 수준입니다.
  v0.3.0의 선택적 `IMPORT_API_TOKEN`은 쓰기(`POST /api/imports`) 전용이며 읽기에는
  적용하지 않습니다(정식 인증은 v0.6.x).
- asset 파일 복사/이동은 v0.3.1 범위 아님(v0.3.2).

## Non-goals

```text
incoming/archive/failed 자동 이동, folder watch, 스케줄 실행 — v0.3.2
asset 파일 managed storage 복사 — v0.3.2
batch 단위 재import/삭제/재처리 액션(쓰기 운영 버튼) — 후속(여기선 조회/표시만)
batch 목록 pagination/검색 — 후속(현 규모는 전량 반환)
정식 인증/JWT/session/role — v0.6.x
mock mode 연동 / mock batch 데이터
external package format 변경 / 새 필수 필드
부분 성공(partial) 상태 — 현 import은 트랜잭션 원자적이라 success/failed만
```

## 검증 요약

1. `cd backend && alembic upgrade head`로 `0006` 적용(테이블 생성), `downgrade`도
   동작. 기존 데이터 영향 없음.
2. `cd backend && pytest` 통과(신규 batch 모델/쓰기/조회 테스트 포함). 기존 회귀 0.
3. CLI import 후 `GET /api/imports`에 batch가 보이고, 재import 시 행이 늘지 않고
   갱신됨. dry_run은 batch 무변화.
4. HTTP import(`POST /api/imports`) 후에도 동일하게 batch 기록. 의미 오류 시
   posts는 롤백되고 failed batch가 기록됨.
5. API mode UI `/imports`에서 batch 목록/상세가 표시되고, 상세에서 귀속 post로
   이동 가능. mock mode에선 "API mode 전용" 안내.
6. `npm run build`(tsc + vite) 통과.
7. 완료 시 `appVersion.ts` 라벨 `v0.3.1`로 상향, `AGENTS.md` Completed Scope
   History·`docs/README.md` 색인·README들·`V0_3_X_INGESTION_PLAN.md` 현황 갱신.
