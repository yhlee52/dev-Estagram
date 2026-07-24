# v1.2.2 Scope — S3 watch worker + one-shot CLI (v1.2.x)

> 상태: **구현 중.** v1.2.0(발견/검증) + v1.2.1(tracking/claim/import)을 실제로
> 돌리는 실행 진입점. MinIO는 아직 불필요(fake store로 orchestration 검증). 실제
> MinIO end-to-end는 v1.2.3.

## Goals

- **`app/services/process_s3_incoming.py`** — 기존 filesystem `process_incoming`
  구조를 미러링한 별도 모듈/CLI. discovery=`s3_discovery`, 처리=`s3_ingest.process_batch`.
  기존 filesystem 경로는 **무손상**.
  - `process_once(...)` — discover → `limit` 적용 → 배치별 새 session으로
    `process_batch` → 통계 집계. 한 배치의 예외가 나머지를 막지 않음(worker_error
    outcome).
  - `watch(...)` — interval polling, **graceful shutdown**(SIGINT/SIGTERM/SIGBREAK/
    KeyboardInterrupt → stop_event, 현재 배치까지 끝내고 종료), interruptible sleep.
  - `WorkerHealth` — last_poll_at / last_success_at / last_error_at /
    last_error_message / currently_processing_batch + 누적 polls/completed/failed/
    skipped.
  - structured logging(배치별 상태·code, poll 요약). **secret 미출력**(자격증명은
    로그에 넣지 않음).
  - CLI: one-shot / `--watch` / `--interval` / `--limit` / `--database-url`.
    기본 interval·limit은 `S3_WATCH_INTERVAL_SECONDS`·`S3_WATCH_BATCH_LIMIT`.

## Non-goals

- MinIO docker-compose / bucket init / producer CLI (v1.2.3)
- asset proxy/presigned 응답 (v1.2.4)
- S3 객체 rename/move/삭제 (영구 금지)
- FastAPI 프로세스 내 백그라운드 실행(별도 worker 프로세스로만; health를 API에
  노출할지는 v1.2.4 이후 판단)

## 검증 (scripts/check_s3_watch.py)

DB/MinIO/boto3 없이 실행. `process_batch` 자체는 check_s3_ingest_tracking이 커버하므로
여기서는 orchestration만 fake `process_fn`/session으로 검증:

- process_once 집계 + health 갱신(completed/failed/skipped, last_* 타임스탬프)
- `limit` 적용(정렬된 앞 N개만)
- 한 배치 crash가 격리되어 worker_error outcome으로 계속 진행
- watch가 N폴 후 stop_event로 정지
- graceful shutdown: 배치 사이에서 정지(현재 poll의 남은 배치 skip)
- 사전 stop 시 no-op(polls 0)

```bash
python -m scripts.check_s3_watch            # no DB/MinIO
python -m app.services.process_s3_incoming             # one pass (needs S3_* + DATABASE_URL)
python -m app.services.process_s3_incoming --watch --interval 10 --limit 20
```

## 호환성

- 신규 파일만 추가(모듈 1 + 테스트 1 + 문서). DB/모델/migration/frontend 변경 없음.
- 기존 filesystem `process_incoming`·HTTP import·`/api/imports` 무영향.
