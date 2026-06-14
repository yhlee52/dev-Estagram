# feed-prototype 문서

현재 릴리즈: `v0.3.1` (Import Batch 이력). v0.3.x(Ingestion 신뢰성) 테마 **진행 중**
— v0.3.0(HTTP import)·v0.3.1(Import Batch 이력) 완료, 다음 후보는 v0.3.2. 진입
판단과 후보는 `V0_3_X_INGESTION_PLAN.md`, v0.3.0 상세는 `V0_3_0_HTTP_IMPORT_SCOPE.md`,
v0.3.1 상세는 `V0_3_1_BATCH_HISTORY_SCOPE.md` 참고.

## 현행 문서 (먼저 볼 것)

- `../README.md`: mock mode, API mode, external import mode 실행 guide
- `ROADMAP.md`: v0.0.0 이후 업데이트 로드맵 (버전 트리, 테마별 scope)
- `V0_3_X_INGESTION_PLAN.md`: v0.3.x(Ingestion 신뢰성) 진입 판단과 0.3.0~0.3.2
  후보 계획 (현재 테마)
- `V0_3_0_HTTP_IMPORT_SCOPE.md`: v0.3.0 HTTP Import API 상세 scope
  (`POST /api/imports`, dry_run, 에러 매핑, 최소 보호)
- `V0_3_1_BATCH_HISTORY_SCOPE.md`: v0.3.1 Import Batch 이력 상세 scope
  (`import_batch` 테이블, `GET /api/imports`·`/{id}`, `/imports` UI)
- `EXTERNAL_POST_PACKAGE_GUIDE.md`: external post package 작성 guide (format 중심)
- `GOLDEN_SAMPLE_REGRESSION.md`: external package golden sample dry-run 회귀 안내
- `UX_BACKLOG.md`: 사용 중 발견한 UX 불편/아이디어 기록 backlog
- `../data/external_posts/README.md`: external post package 작업 guide

## v0.0.0 릴리즈 문서 (v1.0.0 안정화 단계까지 유지)

- `RELEASE_0_0_RUNBOOK.md`: v0.0.0 local 실행 재현 runbook
- `RELEASE_0_0_CHECKLIST.md`: v0.0.0 릴리즈 직전 체크리스트

## Archive (완료 테마 / historical 참고)

완료된 테마의 scope 문서와 MVP-era 참고 문서, v0.0.0 historical 문서는 `archive/`
아래에 회귀 확인·기록 용도로 보관합니다. primary entry point가 아니며, 특정 회귀를
확인하는 경우가 아니라면 위의 현행 문서를 먼저 사용합니다.

완료 테마 scope 문서:

- `archive/V0_1_0_READ_AT_SCALE_SCOPE.md` ~ `archive/V0_1_3_MENTION_SCOPE.md`:
  v0.1.x(탐색과 발견) — pagination/날짜 필터/정렬/URL 동기화, 해시태그, 검색,
  @mention scope
- `archive/V0_2_0_DESKTOP_LAYOUT_SCOPE.md` ~ `archive/V0_2_3_TAB_ACTIVATION_2_SCOPE.md`:
  v0.2.x(레이아웃 & UI 개편) — 3컬럼 레이아웃, 헤더/검색 정리, Explore/Accounts/Me
  탭 활성화 scope

MVP-era 참고 문서:

- `archive/MVP10_EXTERNAL_POST_FORMAT.md`: MVP10 external post format history와 상세 참고
- `archive/MVP12_ASSET_VIEWER_SCOPE.md`: MVP12 asset viewer scope 상세 참고

historical MVP validation / v0.0.0 문서:

- `archive/MVP9_TEST_PROCEDURE.md`
- `archive/MVP10_TEST_PROCEDURE.md`
- `archive/MVP11_TEST_PROCEDURE.md`
- `archive/MVP12_TEST_PROCEDURE.md`
- `archive/RELEASE_CHECKLIST_v0.0.0.md`
- `archive/SMOKE_TEST_v0.0.0.md`
