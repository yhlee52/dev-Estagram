# V0_3_2_AUTO_INGESTION_SCOPE.md

`feed-prototype` v0.3.2 — **자동 이동 + 디렉터리 일괄 처리 CLI + 폴링 Watch** 상세
scope 문서입니다.

`ROADMAP.md`의 v0.3.x(Ingestion 신뢰성) 테마 세 번째 MINOR이며, v0.3.0(HTTP
Import API)·v0.3.1(Import Batch 이력) 위에 **운영 자동화**를 얹습니다. ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서를 작성한 뒤 작업한다" 규칙과
`V0_3_X_INGESTION_PLAN.md` 3장 v0.3.2 후보를 구체화한 것입니다.

## 범위 분할 결정 (2026-06-14)

ROADMAP 원안의 v0.3.2는 ① incoming→archive/failed 자동 이동, ② folder watch/스케줄,
③ asset 파일 managed storage 복사를 한 묶음으로 두었습니다. "하나의 MINOR = 하나의
집중된 변경" 원칙에 맞춰 다음과 같이 분리했습니다.

- **v0.3.2 (이 문서):** ① 자동 이동 + 디렉터리 일괄 처리 CLI(`process_incoming`) +
  ② 단순 폴링 watch. **backend·CLI 전용, DB 스키마 변경 없음, frontend 변경 없음.**
- **v0.3.3 (분리):** ③ asset 파일 managed storage 복사(opt-in). import가 현재
  asset 파일을 읽지 않고 `url` 문자열만 저장하므로, 파일 해석·복사·서빙·URL
  재작성을 새로 설계해야 하는 가장 크고 위험한 작업이라 별도 MINOR로 격리.

## 배경

v0.3.0/v0.3.1로 CLI·HTTP 어느 경로로도 import할 수 있고 "무엇이 언제 들어왔는지"가
batch 이력으로 가시화됩니다. 그러나 **파일 기반 운영 흐름은 여전히 수동**입니다.
운영자가 package를 `data/external_posts/incoming/`에 두고, 파일마다
`python -m app.services.import_external_posts --input <path>`를 직접 실행하고,
처리한 파일을 손으로 `archive/`(성공)·`failed/`(실패)로 옮겨야 합니다.

`data/external_posts/{incoming,archive,failed}` 폴더 규약은 v0.0.0(MVP10)부터
존재하지만 자동 이동은 없었습니다(`data/external_posts/README.md`). v0.3.2는 이
폴더 규약을 실제로 구동하는 **디렉터리 일괄 처리기**를 추가합니다.

## 결정 사항 (진입 시 확정)

- **범위:** 자동 이동 + 디렉터리 일괄 처리 CLI + 단순 폴링 watch. asset managed
  storage 복사는 v0.3.3.
- **watch 메커니즘:** **단순 폴링 루프 CLI**(`--watch --interval N`). 외부 의존성
  추가 없음(watchdog 등 미사용). Windows/POSIX 공통으로 동작.
- **자동 이동 적용 대상:** **`incoming/` 디렉터리를 처리하는 `process_incoming`
  경로에서만** 파일을 이동합니다.
  - 기존 단일 파일 CLI(`import_external_posts --input <path>`)는 임의 경로(예:
    `examples/`)를 가리킬 수 있으므로 **이동하지 않습니다**(하위호환 유지).
  - HTTP import(`POST /api/imports`)는 디스크 파일이 없으므로 이동 대상이 아닙니다.
- **성공/실패 판정:** import 트랜잭션의 성공/예외로 판정하며, 이는 v0.3.1 batch
  status(success/failed)와 동일한 신호입니다. 성공→`archive/`, 실패→`failed/`.
- **이름 충돌:** 대상 폴더에 같은 이름이 있으면 덮어쓰지 않고 UTC 타임스탬프
  접미사를 붙여 이동합니다(`name-YYYYMMDDTHHMMSSZ`).

## 재사용 기반 (코드 현황)

- `app/services/import_external_posts.py`
  - `run_import(*, input_path, dry_run, database_url) -> ImportSummary`: 파일 1개를
    load→import→commit/rollback하고, 실패 시 failed batch까지 기록한 뒤 raise하는
    완결된 진입점. `process_incoming`은 package마다 이 함수를 호출하고 결과로
    이동 여부를 결정합니다. (배치 출력 정리를 위해 `print_result: bool = True`
    파라미터를 추가합니다.)
  - `load_payload`, `ImportErrorWithMessage`: 검증/에러 타입 재사용.
- `app/core/config.py`의 `Settings`: external_posts 루트 경로 설정
  `external_posts_dir`를 추가(기본값 = 리포 내 `data/external_posts`).
- 폴더 규약: `data/external_posts/{incoming,archive,failed,examples}` 이미 존재.
- 회귀 스크립트 패턴: `backend/scripts/check_*.py`(실제 DB에 쓰고 정리).

## Goals

### 1) 디렉터리 일괄 처리기 (`process_incoming`)

신규 모듈 `app/services/process_incoming.py`.

**package 단위 인식** — `incoming/` 바로 아래에서:

- `*.json` 파일 = package 1개(그 파일이 import 입력).
- `feed_posts.json`을 포함한 하위 디렉터리 = package 1개(그 `feed_posts.json`이
  입력). 디렉터리 전체가 이동 단위(assets 포함).
- 그 외 항목(json 아닌 파일, `feed_posts.json` 없는 디렉터리)은 **건너뜀**(경고
  로그). 처리 순서는 이름 정렬로 결정적.

**처리 흐름** — package마다:

1. `run_import(input_path=<json>, dry_run=dry_run, print_result=False)` 호출.
2. 성공(예외 없음) → package 단위를 `archive/`로 이동.
3. 실패(`ImportErrorWithMessage` 또는 기타 예외) → `failed/`로 이동하고 다음
   package로 계속(한 package 실패가 나머지를 막지 않음).
4. `dry_run`이면 **DB도 파일도 건드리지 않음**(검증/요약만, 이동 없음).

**불변식**

- **dry_run = 부작용 없음.** DB write 없음(기존 `run_import` 규약) + 파일 이동
  없음. 기존 dry-run 회귀(`check_golden_samples.py` 등) 보장과 동일.
- **DB가 진실의 원천.** import commit과 파일 이동은 원자적이지 않습니다. import는
  성공(batch 기록 완료)했는데 이동이 실패할 수 있고, 이때도 데이터는 정상입니다.
  이동은 best-effort 운영 정리이며, 실패 시 로그를 남기고 다음으로 진행합니다.
- **examples/ 불가침.** 처리는 `incoming/`만 대상으로 하며 `examples/`는 절대
  읽거나 이동하지 않습니다(golden sample 보호).

### 2) 단순 폴링 Watch

같은 모듈에 watch 루프. `--watch --interval N`(초, 기본 10):

- `incoming/`를 1회 처리 → `interval`초 대기 → 반복. `Ctrl-C`(KeyboardInterrupt)로
  깔끔히 종료.
- 외부 의존성 없음(`time.sleep` 기반 폴링). watchdog/inotify 미사용.
- 부분 기록(쓰다 만 파일) 회피는 운영 규약으로 안내: writer는 임시 파일에 쓴 뒤
  rename(atomic)하도록 문서화. (파일 안정성 감지 로직은 범위 밖.)

### 3) CLI 인터페이스

`python -m app.services.process_incoming`:

```text
--base-dir PATH     external_posts 루트 (기본: settings.external_posts_dir)
                    incoming/archive/failed를 이 아래에서 도출
--dry-run           검증/요약만, DB·파일 미변경
--watch             폴링 루프 모드
--interval N        watch 폴링 간격(초, 기본 10)
--database-url URL  선택적 DB override (run_import에 전달)
```

1회 실행 시 처리 요약 출력: 처리/성공/실패/건너뜀 개수와 package별 한 줄 결과
(이름, 상태, 실패 사유, 이동 위치).

## 회귀 안전장치

- **기존 회귀 스크립트 무변경 통과.** `check_golden_samples.py`,
  `check_http_import.py`, `check_batch_history.py`는 `incoming/`을 건드리지 않고
  dry-run/HTTP만 사용 → 영향 없음.
- **신규 회귀 스크립트** `scripts/check_process_incoming.py`(실제 DB에 쓰고 임시
  폴더 사용 후 정리). 커버:
  1. 유효 package(단일 `.json`)를 임시 `incoming/`에 두고 1회 처리 → import됨,
     `archive/`로 이동, `incoming/`에서 사라짐, batch status=success.
  2. 디렉터리형 package(`feed_posts.json` + `assets/`)도 동일하게 처리·이동.
  3. 의미 오류 package(중복 external_id 등) → `failed/`로 이동, failed batch 기록,
     다른 package 처리는 계속됨.
  4. dry-run → DB·파일 모두 무변경(package가 `incoming/`에 그대로).
  5. 이름 충돌 시 덮어쓰지 않고 타임스탬프 접미사로 이동.
  6. package 아닌 항목은 건너뛰고 그대로 남음.

## 정책 / 주의

- **external post package JSON format 변경 없음.** v0.3.2는 파일 운영만 추가하며
  수신 형식·검증·upsert 규칙을 바꾸지 않습니다(format freeze 유지).
- **import 로직 중복 금지.** 처리기는 `run_import`를 호출만 하고 검증/upsert/배치
  기록을 재구현하지 않습니다. 성공/실패·batch 기록 규약은 v0.3.0/v0.3.1 그대로.
- **core domain 유지.** 새 테이블·모델·도메인 개념 없음(AGENTS.md Core Domain).
- **mock 무관.** backend·CLI 전용. frontend/mock 변경 없음(mock 동결 정책 부합).
- **인증 범위 밖.** CLI는 셸 접근자 신뢰 모델. HTTP token(v0.3.0)과 무관.
- asset 파일 복사/이동(managed storage)은 v0.3.2 범위 아님(v0.3.3).

## Non-goals

```text
asset 파일 managed storage 복사 / URL 재작성 — v0.3.3
watchdog/inotify 등 OS 파일시스템 이벤트 기반 watch — 단순 폴링만
부분 기록(쓰다 만 파일) 자동 감지 — 운영 규약(atomic rename)으로 안내만
HTTP import의 파일 이동 — HTTP는 디스크 파일이 없어 대상 아님
기존 단일 파일 CLI(--input)의 자동 이동 — 하위호환 위해 이동 안 함
batch 단위 재처리/재import UI 버튼 — 후속
frontend 변경 / mock 연동
DB 스키마 변경 / 마이그레이션
external package format 변경 / 새 필수 필드
정식 인증/스케줄러 데몬화(systemd 등) — OS 스케줄러는 운영자 몫(문서 안내)
```

## 검증 요약

1. `incoming/`에 유효 package를 두고 `python -m app.services.process_incoming`
   실행 → import 반영, package가 `archive/`로 이동, batch 이력에 success로 보임.
2. 실패 package는 `failed/`로 이동하고 failed batch가 기록되며, 같은 실행의 다른
   package 처리는 계속됨.
3. `--dry-run`은 DB·파일 모두 무변경(package가 `incoming/`에 그대로).
4. `--watch --interval N`이 주기적으로 `incoming/`을 처리하고 `Ctrl-C`로 종료.
5. 기존 단일 파일 CLI(`import_external_posts --input`)와 HTTP import는 종전과
   동일(파일 이동 없음, 회귀 0).
6. `python -m scripts.check_process_incoming` 통과(+ 기존 check_* 회귀 0).
7. `npm run build`(tsc + vite) 통과(frontend 변경 없음).
8. 완료 시 `appVersion.ts` 라벨 `v0.3.2`로 상향, `AGENTS.md` Completed Scope
   History·`docs/README.md` 색인·README들·`PROJECT_GOALS.md`·
   `V0_3_X_INGESTION_PLAN.md` 현황·`data/external_posts/README.md` 갱신.
