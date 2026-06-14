# V0_3_0_HTTP_IMPORT_SCOPE.md

`feed-prototype` v0.3.0 — **HTTP Import API** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.3.x(Ingestion 신뢰성) 테마 중 첫 기반 버전(x.y.0)이며, ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤
작업한다" 규칙과 `V0_3_X_INGESTION_PLAN.md`의 v0.3.0 후보를 구체화한 것입니다.

## 배경

현재 외부 package import는 backend **CLI 작업 흐름**만 존재합니다. 운영자가
package JSON을 준비해 `data/external_posts/incoming`에 두고
`python -m app.services.import_external_posts --input <path>`를 직접 실행해야
DB에 반영됩니다. 즉, import를 트리거하려면 사람이 backend 셸에 접근해 명령을
실행해야 합니다.

v0.3.0은 **동일한 package JSON을 HTTP로 수신해 import하는 엔드포인트**를
추가합니다. 외부 프로그램(post 생성기)이나 자동화 스크립트가 셸 접근 없이
네트워크로 import를 트리거할 수 있게 됩니다. 이는 v0.3.1(batch 이력 API/UI),
v0.3.2(자동 이동 / folder watch)의 기반입니다.

핵심은 **전송 수단(HTTP)만 추가**하는 것입니다. package JSON 형식, 검증 규칙,
upsert 로직은 그대로 재사용하며 바꾸지 않습니다.

## 재사용 기반 (코드 현황)

- `app/services/import_external_posts.py`의
  `import_payload(session, payload, *, dry_run) -> ImportSummary`: 검증된
  `ExternalImportPayload`와 session만 받는 순수 import 로직. HTTP route가 그대로
  호출합니다.
- `run_import(...)`의 트랜잭션 규약(dry_run → `rollback`, 성공 → `commit`, 예외 →
  `rollback` 후 raise)을 route에서 동일하게 따릅니다. `import_payload` 자체는
  commit하지 않습니다.
- `app/schemas/external_import.py`의 `ExternalImportPayload`(pydantic): HTTP body
  검증에 그대로 사용. FastAPI가 body를 이 모델로 검증합니다.
- `ImportSummary`(dataclass): 응답 본문의 소스. 단, 응답 직렬화를 위해 대응하는
  pydantic 응답 스키마를 추가합니다(아래 참조).
- `ImportErrorWithMessage`: payload 단위 의미 오류(중복 external_id, 미존재
  account 참조 등). HTTP 에러 매핑의 기준.
- 라우터 등록 패턴: `app/api/routes/<name>.py`에 `APIRouter(prefix="/api/...")`를
  만들고 `app/api/routes/init.py`의 `api_router.include_router(...)`에 추가.
- `app/api/deps.py`의 `get_session` 의존성으로 세션 주입.

## Goals

### 엔드포인트

- **`POST /api/imports`** 를 추가합니다. (v0.3.1의 `GET /api/imports` 목록 /
  `GET /api/imports/{batch_external_id}` 상세와 같은 리소스 경로를 공유하도록
  `imports`로 확정.)
- 신규 라우터 모듈 `app/api/routes/imports.py`에 정의하고 `init.py`에 등록합니다.

### 요청 (Request)

- body: 기존 package JSON. FastAPI가 `ExternalImportPayload`로 검증합니다.
  (CLI가 파일에서 읽던 것과 **동일한 형식·동일한 스키마**.)
- `dry_run`: query parameter `?dry_run=true|false`(기본 `false`). CLI `--dry-run`과
  동일 의미 — 검증·요약만 수행하고 DB write 없음.
- Content-Type: `application/json`.

### 처리 (Handler)

1. FastAPI가 body를 `ExternalImportPayload`로 검증(실패 시 자동 422).
2. `import_payload(session, payload, dry_run=dry_run)` 호출.
3. 트랜잭션: `dry_run`이면 `session.rollback()`, 아니면 `session.commit()`.
   처리 중 예외가 나면 `rollback()` 후 에러 매핑. (`run_import`와 동일 규약.)
4. `ImportSummary`를 응답 스키마로 변환해 반환.

### 응답 (Response)

- 성공 시 **200 OK** + 요약 본문. (생성/수정/스킵이 섞인 upsert이므로 201은
  쓰지 않습니다.) 본문은 신규 pydantic 스키마 `ImportSummaryResponse`로
  직렬화하며 다음을 포함합니다:
  - `batch_external_id`(payload.batch.external_id 에코), `dry_run`(bool)
  - `ImportSummary`의 카운트 전부: accounts/users/posts created·updated(+posts
    skipped), asset_replace_target_posts, assets_deleted, assets_created, errors
- 응답 스키마는 `app/schemas/external_import.py` 또는 `app/schemas/feed.py`에
  추가하고, dataclass `ImportSummary` → 응답 모델 변환은 단순 필드 매핑으로
  처리합니다.

### 에러 매핑

- body가 `ExternalImportPayload` 스키마 위반(필수 필드 누락, 타입 오류, asset
  type 미허용, Windows 절대경로 url 등) → **422** (FastAPI 기본 검증 응답).
- `import_payload`가 던지는 `ImportErrorWithMessage`(payload 내 중복 external_id,
  미존재 account_external_id 참조 등) → **400** + 예외 메시지를 `detail`에.
- 그 외 예기치 못한 예외 → **500**. 내부 상세를 그대로 노출하지 않습니다.

### CLI 유지

- `python -m app.services.import_external_posts` CLI workflow는 **제거하지
  않습니다.** HTTP는 같은 `import_payload`를 호출하는 또 다른 진입점일 뿐입니다.

## 보호 장치 (최소, 결정 사항)

쓰기 엔드포인트이므로 최소한의 보호를 둡니다. v0.3.0 범위에서는 **가장 가벼운**
형태로 시작합니다(정식 인증은 v0.6.x).

**채택(권장): 선택적 shared-token 헤더 + local 바인딩 전제.**

- `Settings`(`app/core/config.py`)에 `import_api_token: str | None = None`을
  추가합니다.
- 토큰이 **설정된 경우에만** `POST /api/imports`가 요청 헤더(예: `X-Import-Token`)
  값과 일치하는지 검사하고, 불일치 시 **401**을 반환합니다.
- 토큰이 **미설정(기본값)**이면 검사하지 않습니다 — 현재 local CLI의 신뢰 모델
  (셸 접근 가능자 = 신뢰)을 HTTP에서도 그대로 유지하고, 개발 편의를 깨지 않기
  위함입니다.
- 이는 정식 인증이 아니며, backend는 local(127.0.0.1) 바인딩 전제임을 문서화
  합니다. CORS는 기존 localhost 설정을 유지합니다(브라우저 노출용 surface를 새로
  넓히지 않음).

> 이 선택은 "보호는 두되 지금은 최소로"라는 방침에 맞춘 것입니다. 더 강한 보호가
> 필요하면 토큰을 필수화하거나 별도 인증으로 교체할 수 있으며, 그 변경은 이
> 엔드포인트에 국한됩니다.

## 회귀 안전장치

- `examples/`의 golden sample package를 **HTTP dry-run으로도** import 통과하는지
  확인합니다. 기존 `scripts/check_golden_samples.py`(또는
  `GOLDEN_SAMPLE_REGRESSION.md` 절차)와 **동일한 sample**을 사용해, CLI dry-run과
  HTTP dry-run의 요약이 일치함을 확인합니다.
- 신규 backend 테스트: `POST /api/imports`의 (1) dry-run 요약, (2) 실제 import 후
  DB 반영 + 재요청 시 upsert(중복 생성 없음), (3) 스키마 위반 422, (4)
  중복 external_id / 미존재 account 참조 시 400, (5) 토큰 설정 시 401/통과.

## 정책 / 주의

- **external post package JSON format 변경 없음.** format freeze 유지(기존 필드
  변경/삭제/필수화 금지, 새 필드는 optional로만). HTTP는 형식이 아니라 전송 수단만
  추가합니다.
- 이미 생성된 package는 HTTP/CLI 어느 경로로도 재import 가능해야 합니다.
- **import 로직 중복 금지.** route는 `import_payload`를 호출만 하고, 검증·upsert
  규칙을 새로 구현하지 않습니다. 트랜잭션 규약도 `run_import`와 동일하게 맞춥니다.
- **mock mode 무관.** 이 변경은 backend 전용입니다. mock mode는 v0.3.0부터
  "UI 데모 전용 동결"이며 이 기능을 추가하지 않습니다.
- core domain(User/Account/Post/Feed/Follow/Asset/Metadata)을 유지합니다
  (AGENTS.md Core Domain).
- asset 파일 복사·이동은 v0.3.0 범위가 아닙니다. `asset.url`은 기존대로
  브라우저 접근 가능한 URL/path여야 합니다(스키마의 기존 검증 유지).

## Non-goals

```text
batch 이력 조회 API / UI (GET /api/imports*, 최소 UI) — v0.3.1
incoming/archive/failed 자동 이동, folder watch, 스케줄 실행 — v0.3.2
asset 파일 managed storage 복사 — v0.3.2
정식 인증/JWT/session/OAuth/role — v0.6.x (여기서는 선택적 shared-token 최소 보호만)
파일 업로드(multipart) 수신 — JSON body만 받음 (asset은 기존 URL 방식 유지)
external package format 변경 / 새 필수 필드 추가
mock mode 연동 / frontend 변경
CLI import workflow 제거
```

## 검증 요약

1. `cd backend && pytest` 통과(신규 import API 테스트 포함). 기존 테스트 회귀 0건.
2. `uvicorn app.main:app --reload` 후 `POST /api/imports`에 sample package JSON을
   보내면 `ImportSummary` 본문이 반환되고, `?dry_run=true`는 DB write 없이 동일
   요약을 반환.
3. 실제 import(`dry_run=false`) 후 API mode UI에서 post가 보이고, 같은 payload를
   다시 보내면 중복 생성 없이 update/skip으로 집계됨(upsert).
4. 스키마 위반 body → 422, payload 의미 오류(중복 id·미존재 account) → 400 +
   메시지, 예기치 못한 오류 → 500.
5. `import_api_token` 설정 시 헤더 불일치 401 / 일치 통과, 미설정 시 토큰 검사
   없이 동작.
6. golden sample을 HTTP dry-run으로 import 통과(CLI dry-run 요약과 일치).
7. CLI(`python -m app.services.import_external_posts`)가 그대로 동작(회귀 없음).
