# v1.2.5 Scope — v1.2.x 테마 wrap-up

> 상태: **구현 완료(문서/정리).** 테마의 마지막 MINOR. 신규 기능 없이 문서 정리 +
> 전체 검증 체크리스트로 v1.2.x(외부/객체 스토리지 Ingestion)를 닫는다. UX_BACKLOG에
> 이 테마 관련 open 항목은 없다(backend ingestion 테마).

## 한 일

- 아키텍처/운영 문서 확정(`S3_INGESTION_ARCHITECTURE.md`, Mermaid 포함 — v1.2.4에서
  추가).
- `docs/README.md` 문서 색인에 S3 ingestion 문서 추가.
- `ROADMAP.md` v1.2.x 각 MINOR에 완료 표기.
- `AGENTS.md` Completed Scope History에 v1.2.x 요약 추가.
- 아래 **테마 전체 검증 체크리스트** 정리.

## 하지 않은 일 (의도)

- `APP_RELEASE_LABEL` bump — 보류. 현재 `v1.0.1`이고 로드맵상 v1.1.x(Rich Asset)가
  아직 미구현인 채 v1.2.x를 먼저 구현했으므로, 버전 라벨을 어떻게 매길지(예:
  v1.2.x로 점프 vs 별도 정리)는 라이브 검증 후 사용자가 결정한다.
- S3 객체 변경/이동/삭제(영구 금지), frontend 변경.

## 테마 전체 검증 체크리스트

### 1. 자동 단위 테스트 (외부 서비스 불필요)

`feed-prototype/backend` 에서:

```bash
python -m scripts.check_s3_ingest            # 발견/검증 (19)
python -m scripts.check_s3_ingest_tracking   # tracking/claim/idempotency (10)
python -m scripts.check_s3_watch             # watch worker orchestration (6)
python -m scripts.check_upload_post_batch    # producer 업로드 계획/순서/batch-root (12)
python -m scripts.check_reset_batch_state    # 배치 재처리용 상태 리셋 규칙 (9)
python -m scripts.check_asset_url            # asset proxy URL 직렬화 (3)
```

기존 회귀도 확인:

```bash
python -m scripts.check_golden_samples       # 기존 package dry-run
python -m scripts.check_process_incoming     # filesystem ingestion (DB 필요)
```

### 2. 라이브 end-to-end (MinIO + Postgres)

`docs/MINIO_LOCAL_DEV.md §4` 절차 요약:

1. `docker compose -f docker-compose.minio.yml up -d` (MinIO + `estagram` 버킷)
2. `backend/.env` 에 `INGEST_STORAGE_BACKEND=s3` + `S3_*`(MinIO) + `DATABASE_URL`
3. `pip install -r requirements.txt` (boto3) + `alembic upgrade head` (0013)
4. 업로드: `python -m scripts.upload_post_batch --batch-dir
   ../data/external_posts/s3_samples/s3_sample_batch_001`
5. worker: `python -m app.services.process_s3_incoming` → `completed=1`
6. 확인: `GET /api/imports/s3_sample_batch_001`, feed에 포스트, 이미지/파일이
   `/api/assets/{id}` 로 렌더
7. 멱등성: worker 재실행 → `skipped=1`, 중복 없음
8. immutable 확인: MinIO 콘솔에서 배치 객체가 처리 전후로 그대로 유지

### 3. 완료 조건 (요청사항 §25 대응)

- [x] 집에서 MinIO로 무료 S3-compatible 개발
- [x] 회사 S3는 환경변수만 변경(코드/boto3 동일)
- [x] 처리 후에도 객체 key 그대로(immutable) — 런타임 계층에 write/삭제 없음
- [x] PostgreSQL이 상태의 source of truth (`ingest_state`)
- [x] `_READY.json` 없는 배치는 미처리
- [x] completed 배치 반복 polling 시 재처리 안 함
- [x] worker 재시작/2-worker 동시 실행 시 중복 없음 (unique + FOR UPDATE)
- [x] 기존 filesystem ingestion·feed API·frontend 유지
- [x] unit test가 외부 S3 없이 통과
- [x] MinIO 검증 절차 문서화 (라이브 실행은 사용자 최종 확인)
