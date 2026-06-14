# V0_3_X_INGESTION_PLAN.md

`feed-prototype` v0.3.x — **Ingestion 신뢰성 (Ingestion Hardening)** 테마 진입
판단과 0.3.0~0.3.2 후보 계획 문서입니다.

이 문서는 v0.2.x post-dev 점검(2026-06-14)에서 작성되었습니다. `ROADMAP.md`의
v0.3.x 항목을 코드 현황에 맞춰 구체화하고, 진입 전 확인할 사항을 정리합니다.

> **테마 진행 현황 (2026-06-14 갱신)**
> - v0.3.0 — HTTP Import API: **완료**. 상세는 `V0_3_0_HTTP_IMPORT_SCOPE.md`.
> - v0.3.1 — Import Batch 이력 API + 최소 UI: **완료**. 상세는
>   `V0_3_1_BATCH_HISTORY_SCOPE.md`, 요약은 `AGENTS.md` Completed Scope History.
> - v0.3.2 — 자동 이동 / Watch / Asset Managed Storage: 후보(다음 MINOR).
> - 버전 라벨(`appVersion.ts`의 `APP_RELEASE_LABEL`)은 `v0.3.1`.

## 1. v0.2.x 완료 / 진입 판단

v0.2.x(레이아웃 & UI 개편) 테마는 완료되었습니다.

- v0.2.0 데스크톱 3컬럼 셸, v0.2.1 헤더/UserMenu 정리, v0.2.2 Explore·Accounts
  탭, v0.2.3 Me 탭 + UX backlog 반영 — 4개 MINOR 모두 구현.
- 테마의 마지막 MINOR(UX backlog 반영) 슬롯 사용 완료.
- `npm run build`(tsc + vite) 통과. lint는 기존 baseline 5건 유지(신규 회귀 0).
  - baseline: `AssetRenderer.tsx` set-state-in-effect 2건, `PostFilterPanel.tsx`
    react-refresh 3건. v0.2.x 이전부터 존재. 기능 영향 없음.
- 차단(blocking) 버그 없음. UX_BACKLOG의 Open 3건은 의도적으로 v0.3.x/v0.5.x로
  이연된 항목(회귀 아님).

**판단: v0.3.x 진입 가능.**

> 참고: v0.2.x post-dev 논의에서 v0.3.x 다음 테마로 **v0.4.x 메타데이터 일급화 &
> 트리아지(Metadata-first Reading)**를 신설하기로 했습니다(기존 협업/인증은 한 칸씩
> v0.5.x/v0.6.x로 이동). v0.3.1의 batch 이력은 그 테마의 후속 후보(batch/source
> 단위 읽기)의 기반이 됩니다. 자세한 트리는 `ROADMAP.md` 참고.

### 진입과 함께 적용되는 정책

- `ROADMAP.md`에 따라 v0.3.0부터 mock mode는 **"UI 데모 전용 동결"** 상태로
  전환됩니다. 신규 기능은 API mode에만 추가해도 되며, mock mode를 제거하지는
  않습니다. (mock/API 동시 동작 보장 의무는 v0.2.x까지였습니다.)
- external post package JSON format **동결 유지**. v0.3.x는 전송 수단(HTTP)과
  운영(이력/이동/복사)을 추가할 뿐, 기존 package 형식을 바꾸지 않습니다.

## 2. 코드 현황 (재사용 기반)

v0.3.x는 대부분 기존 자산 위에 얇게 얹는 작업입니다.

- **import 로직 분리됨**: `app/services/import_external_posts.py`의
  `import_payload(session, payload, *, dry_run) -> ImportSummary`가 검증된
  `ExternalImportPayload`와 session만 받습니다. CLI(`run_import`)와 동일 로직을
  HTTP route에서 그대로 호출할 수 있습니다.
- **검증 스키마 존재**: `app/schemas/external_import.py`의 `ExternalImportPayload`
  (pydantic). HTTP body 검증에 재사용.
- **batch 추적 필드 존재**: `Post.import_batch_external_id`가 import 시 저장됨
  (migration `0003_add_mvp10_external_import_fields`). batch 이력 집계의 기반.
- **요약 구조 존재**: `ImportSummary`(accounts/users/posts/assets created·updated·
  skipped, errors). HTTP 응답·이력 레코드에 그대로 쓸 수 있음.
- **폴더 규약 존재**: `data/external_posts/{incoming,archive,failed,examples}`.
  현재 자동 이동은 없음(수동).

## 3. v0.3.x 후보 (MINOR 분해)

`ROADMAP.md` v0.3.x 항목을 코드 현황에 맞춰 구체화한 것입니다. 각 MINOR는 하나의
집중된 변경 묶음입니다.

### v0.3.0 — HTTP Import API (테마 기반 작업, x.y.0) — ✅ 완료

> 구현 완료. 결정 사항은 `V0_3_0_HTTP_IMPORT_SCOPE.md`에서 확정됨: 경로는
> `POST /api/imports`, 보호는 선택적 `IMPORT_API_TOKEN`(`X-Import-Token` 헤더,
> 미설정 시 검사 없음). 아래는 진입 당시 후보 정의로 기록 보존.

목표: 동일한 package JSON을 HTTP로 수신해 import. CLI import는 그대로 유지.

- `POST /api/imports` (경로명은 scope 문서에서 확정): body = 기존 package JSON.
- `ExternalImportPayload`로 검증 → `import_payload(session, payload, dry_run=...)`
  호출 → commit/rollback → `ImportSummary` 응답.
- `dry_run` query/flag 지원(CLI `--dry-run`과 동일 동작, DB write 없이 요약).
- 검증 실패(`ImportErrorWithMessage`)는 4xx + 메시지, 그 외는 5xx로 매핑.
- CLI(`python -m app.services.import_external_posts`) workflow 제거하지 않음.
- 회귀 안전장치: `examples/` golden sample을 HTTP dry-run으로도 통과 확인
  (기존 `scripts/check_golden_samples.py`와 동일한 sample 사용).

비고/결정 필요:
- 인증은 범위 밖(인증은 v0.6.x). 단, 쓰기 엔드포인트이므로 최소한의 보호
  (예: local-only 바인딩, 또는 단순 shared token env)를 둘지 scope에서 결정.

### v0.3.1 — Import Batch 이력 API + 최소 UI — ✅ 완료

> 구현 완료. 결정 사항은 `V0_3_1_BATCH_HISTORY_SCOPE.md`에서 확정됨: 별도
> `import_batch` 테이블 신설 / `GET /api/imports`·`GET /api/imports/{batch_external_id}`
> / 실패 batch는 rollback 후 별도 트랜잭션 기록 / 최소 UI는 신규 `/imports`
> 라우트(API mode 전용). 아래는 진입 당시 후보 정의로 기록 보존.

목표: "무엇이 언제 들어왔는지" 가시화.

- batch 이력 조회: `import_batch_external_id` 기준 집계(배치별 post 수, 최초/최근
  import 시각). 별도 batch 테이블을 새로 둘지, post 집계로 충분한지 scope에서
  결정(현 데이터 규모에선 집계로 시작 가능).
- `GET /api/imports` (목록) / `GET /api/imports/{batch_external_id}`(상세) 후보.
- 최소 UI: batch별 성공/실패/post 수 표시. 위치 후보 — 신규 라우트(예: `/imports`)
  또는 Me 탭 하위 섹션. **API mode 전용**(mock 동결 정책에 부합).
- 성공/실패 구분이 의미를 가지려면 v0.3.0에서 실패 batch를 어떻게 기록할지와
  연계 설계(아래 v0.3.2의 failed 이동과도 연결).

### v0.3.2 — 자동 이동 / Watch / Asset Managed Storage

목표: 운영 자동화와 asset 내구성(opt-in).

- import 결과에 따라 package를 `incoming` → `archive`(성공) / `failed`(실패)로
  자동 이동.
- folder watch 또는 스케줄 실행으로 `incoming` 자동 처리(폴링/watchdog 등 수단은
  scope에서 결정).
- asset 파일 **managed storage 복사(opt-in)**: 기존 URL 방식은 계속 지원하고,
  옵션 활성화 시 파일을 backend 관리 경로로 복사. 기존 `/assets/...` 경로 package는
  계속 동작해야 함(format 동결·하위호환 유지).

### v0.3.x 마지막 MINOR — UX backlog 예약 슬롯

`ROADMAP.md` 규칙대로 테마 마지막 MINOR는 `UX_BACKLOG.md` 반영용으로 예약.
현재 관련 Open 후보(이연됨): Me 탭 페이지네이션(데이터 누적 대응), 공용
ConfirmDialog(브라우저 `window.confirm` 대체).

## 4. v0.3.x 제약 (ROADMAP 재확인)

```text
HTTP import는 기존 package JSON과 동일한 형식을 받는다 (전송 수단만 추가)
asset 파일 복사는 opt-in이며 기존 /assets/... 경로 package는 계속 동작한다
기존 CLI import workflow를 제거하지 않는다
external post package JSON format은 동결 유지 (새 필드는 optional로만)
mock mode는 v0.3.0부터 데모 전용 동결 (제거하지 않음)
인증/JWT/session/OAuth는 범위 밖 (v0.6.x)
```

## 5. 진입 전 권장 정리 (선택)

진행에 필수는 아니지만 v0.3.x 작업 품질을 높이는 정리:

- baseline lint 5건은 별도 cleanup 작업으로 분리 처리 가능(이번 post-dev에서는
  보류 결정). HTTP import는 backend라 영향 없음.
- `RELEASE_0_0_RUNBOOK.md` / `RELEASE_0_0_CHECKLIST.md`는 v0.0.0 기준 문서로
  남아 있음. v1.0.0 안정화 단계에서 최신 릴리즈 runbook으로 재정비 예정(현 단계
  유지).

## 6. 다음 행동

v0.3.0(HTTP Import API)·v0.3.1(Import Batch 이력)은 완료되었습니다. 다음은
v0.3.2입니다.

1. `V0_3_2_*_SCOPE.md` 작성 후 구현 착수. 위 3장 v0.3.2 후보(incoming→archive/
   failed 자동 이동, folder watch/스케줄, asset managed storage 복사 opt-in)에서
   결정 필요 항목을 scope에서 확정. v0.3.1의 batch status(success/failed)가
   자동 이동의 상태 판단 기반이 됨.
2. 테마의 마지막 MINOR는 `UX_BACKLOG.md` 반영용 예약 슬롯(현재 후보: Me 탭
   페이지네이션, 공용 ConfirmDialog).
