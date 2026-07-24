# v1.2.3 Scope — MinIO 로컬 개발환경 + producer 업로드 CLI (v1.2.x)

> 상태: **구현 완료(코드), 라이브 검증은 사용자 최종 확인 단계로 이연.** MinIO를
> 실제로 띄우고 producer→worker→feed end-to-end를 눈으로 확인하는 단계는
> v1.2.x 전체를 마친 뒤 사용자가 한 번에 수행한다(runbook 제공).

## Goals

1. **`docker-compose.minio.yml`** — 프로젝트에 base compose가 없으므로 독립
   compose. MinIO(S3 API 9000 / 콘솔 9001) + 영속 named volume + 멱등 bucket-init
   헬퍼(`estagram` 생성). 개발 전용 자격증명(`.env.example` home-MinIO 블록과 일치).
2. **producer 업로드 CLI `scripts/upload_post_batch.py`** — 배치 디렉터리를
   **asset → feed_posts.json → _READY.json 순서**로 업로드(미완성 배치가 발견되지
   않도록). `build_upload_plan`이 manifest 검증 + batch-relative asset 해석/존재
   확인 + `_READY.json`(manifest sha256, worker와 동일한 occurrence 기준 asset_count)
   생성. 자격증명은 env(`S3_ACCESS_KEY_ID/SECRET`) 또는 `--profile`, 플래그 노출 안 함.
   `--overwrite` 가드 / `--dry-run`.
3. **샘플 배치 fixture** — `data/external_posts/s3_samples/s3_sample_batch_001/`
   (examples/ 밖이라 golden-sample 검사와 무관). batch-relative CSV 자산 1 + 원격
   링크 자산 1.
4. **runbook** — `docs/MINIO_LOCAL_DEV.md` 에 Docker Desktop 설치(Windows) →
   MinIO 기동 → `.env` 배선 → `alembic upgrade head` → 업로드 → worker → 확인 →
   재처리까지 전 과정.

## Non-goals

- asset URL proxy/serializer(브라우저 렌더) — v1.2.4
- 전체 스택 docker compose(MinIO 전용만)
- S3 객체 rename/move/삭제
- MinIO integration을 CI 필수 자동 테스트로 편입(수동 runbook + gated 테스트로 충분)

## 검증

- `scripts/check_upload_post_batch.py` — build_upload_plan + 업로드 순서(fake
  client), boto3/MinIO/DB 없이 **7/7**.
- 라이브 end-to-end는 `docs/MINIO_LOCAL_DEV.md §4` runbook으로 사용자가 최종 확인.
  (worker→DB import 경로의 자동 커버리지는 v1.2.1 `check_s3_ingest_tracking`의
  Postgres-gated 테스트가 담당.)

## 호환성

- 신규 파일 위주(compose/CLI/샘플/문서). DB/모델/migration/frontend 변경 없음.
- 기존 filesystem ingestion·`/api/imports`·golden samples 무영향.
