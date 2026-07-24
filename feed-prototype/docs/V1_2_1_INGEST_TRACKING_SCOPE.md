# v1.2.1 Scope — PostgreSQL ingestion tracking + claim (v1.2.x)

> 상태: **구현 중.** v1.2.0(발견/검증) 위에 **DB 라이프사이클 + 안전한 동시 claim
> + idempotency + timeout/retry + `import_payload` 연결**을 얹는다. worker/CLI는
> v1.2.2, asset 서빙 endpoint는 v1.2.4로 남는다.

## Goals

1. **`import_batch` 확장** — nullable 컬럼 + 신규 `ingest_state`
   (pending/processing/completed/failed/ignored) 추가. 기존 `status`(success/
   failed 이벤트 스냅샷)와 `/api/imports` 히스토리는 무영향(legacy 행은 전부 null,
   `ImportBatchSummary`가 신규 컬럼을 무시).
2. **`post_assets` 확장** — S3 자산의 영구 object identity(`storage_backend,
   bucket, object_key, size_bytes, etag`). binary는 S3에 유지, DB엔 만료되지 않는
   식별정보만. 서빙 URL은 v1.2.4에서 이 컬럼으로 생성.
3. **Alembic migration 0013** — 위 두 테이블에 add-only nullable 컬럼 + `ingest_state`
   index. down = drop.
4. **`import_payload` 주입점** — optional `asset_identity_resolver`. filesystem/
   HTTP import은 None → 동작 무변경. S3만 자산에 object identity 부착.
5. **`app/services/s3_ingest.py`** — tracking + claim + import 오케스트레이션.
   - `decide_action(...)`: 순수 함수(DB/S3 불필요). None(비-S3 행)/completed/
     ignored → skip, pending → process, processing → timeout 시에만 process,
     failed → retry 정책.
   - `find_or_create_pending`: `external_id` unique로 중복 pending 방지(경합 시
     IntegrityError catch 후 재조회).
   - `claim_batch`: `SELECT … FOR UPDATE`로 잠근 채 `decide_action` 재확인 후
     processing 전이 + `attempt_count++`. 두 worker 중 하나만 claim.
   - `process_batch`: find/create → decide → claim → `validate_batch` →
     `import_payload` → completed. import+completed를 **한 트랜잭션**(부분 post
     방지). 실패 시 rollback 후 failed(error_code/message) 기록.

## Non-goals (이 MINOR에서 안 함)

- watch worker / one-shot CLI (v1.2.2)
- MinIO docker-compose, producer CLI (v1.2.3)
- asset proxy/presigned 응답 endpoint (v1.2.4) — object identity는 저장만
- S3 객체 rename/move/삭제 (영구 금지)

## idempotency / 동시성

- 배치: `import_batch.external_id` unique + `SELECT … FOR UPDATE` claim.
- post/asset: 기존 `external_id` unique upsert(`import_payload`) 재사용.
- S3 객체의 존재/이름을 lock으로 쓰지 않는다.
- 한 배치 처리에서 post만 생성되고 asset이 빠지는 상태 방지 → import+completed 단일
  트랜잭션.

## 검증 (scripts/check_s3_ingest_tracking.py)

DB/MinIO 없이도 대부분 실행된다.

1. `decide_action`/timeout/retry — 순수 로직(외부 의존성 없음)
2. asset identity resolver — fake object store
3. tracking + claim 상태머신 — SQLite에 `import_batch` 테이블만 생성(JSONB 없음)해
   find-or-create 멱등 / claim 후 재-claim skip / 두 worker 단일 claim / timeout 복구
   / completed skip / failed retry on·off·소진
4. 전체 `process_batch` import(posts/assets, completed, 재폴링 skip, asset identity
   저장) — `DATABASE_URL`이 Postgres일 때만 실행, 아니면 clean skip

```bash
python -m scripts.check_s3_ingest_tracking   # 1~3 run without Postgres/MinIO
```

## 호환성

- DB **add-only**(migration 0013), 기존 filesystem/HTTP import·`/api/imports`·
  frontend **무변경**. `feed_posts.json` 동결 유지.
