# v1.2.0 Scope — Storage 추상화 + S3 discovery (기반)

> 상태: **구현 중.** v1.2.x(외부/객체 스토리지 Ingestion) 테마의 기반 MINOR.
> 이 MINOR는 **읽기 전용 S3 접근 계층과 배치 발견/검증까지만** 다룬다. DB 반영
> (tracking record, import 트랜잭션)과 watch worker는 각각 v1.2.1 / v1.2.2에서
> 이어진다. 따라서 이 MINOR에는 **DB 스키마 변경도, Alembic migration도 없다.**

## 전제

- 기존 external ingestion 코어(`app/services/import_external_posts.py::import_payload`)를
  재사용한다. 이 MINOR는 아직 import를 호출하지 않고, 그 앞단(배치 발견 + 검증)만
  만든다.
- S3 manifest = 동결된 `feed_posts.json` 포맷(`app/schemas/external_import.py`).
  이 MINOR는 manifest를 새로 정의하지 않고 기존 스키마로 파싱한다.
- `_READY.json`은 신규 아티팩트다(동결 포맷과 무관).

## Goals (이 MINOR에서 하는 것)

1. **S3 설정** — `Settings`에 `INGEST_STORAGE_BACKEND` + `S3_*` 환경변수를 추가
   (add-only, 전부 기본값 보유). secret은 `.env`에만, `.env.example`엔 placeholder.
2. **`_READY.json` 스키마 + 검증** — `app/schemas/s3_ready.py::ReadyMarker` +
   `parse_ready_marker(...)`. 검증: 정상 JSON, 필수 필드, 지원 schema version,
   `batch_external_id`가 batch prefix 이름과 일치, `manifest_key`가 batch prefix
   내부 상대경로(절대경로·`../` traversal 차단).
3. **읽기 전용 object store 추상화** — `app/services/s3_storage.py`. `ObjectStore`
   Protocol + boto3 구현 `S3ObjectStore`(boto3 **지연 import**). 메서드: list
   (pagination), get_bytes, get_json, head, exists, presign, key 헬퍼. **rename/
   move/copy/delete 없음.**
4. **S3 배치 발견 + 검증** — `app/services/s3_discovery.py`.
   `discover_ready_batches(store, config)`가 `{root}/{batches}/*/_READY.json`를
   pagination으로 나열해 배치 후보를 만들고, `validate_batch(...)`가 ready marker
   + manifest 존재 + manifest 파싱 + batch-relative asset 존재 + optional
   checksum/asset_count를 검증해 "import 준비된 배치"를 돌려준다.
5. **단위 테스트** — `scripts/check_s3_ingest.py`. **MinIO/DB 없이** fake object
   store로 실행. botocore Stubber로 path-style client 구성도 (boto3 설치 시) 확인.

## Non-goals (이 MINOR에서 안 하는 것)

- PostgreSQL tracking record 생성/상태 전이 (v1.2.1)
- import_payload 호출 및 DB 반영 (v1.2.1)
- Alembic migration / 모델 컬럼 추가 (v1.2.1)
- watch worker, one-shot CLI (v1.2.2)
- MinIO docker-compose, producer CLI (v1.2.3)
- asset URL proxy/presigned 응답 (v1.2.4)
- S3 객체 rename/move/lifecycle/삭제 (테마 전체에서 영구 금지)
- 외부 URL fetch, frontend 변경

## 설계 결정 (테마 전반, 이 MINOR에서 확정)

1. **tracking 테이블**: 기존 `import_batch`를 nullable 컬럼 + 신규 `ingest_state`
   컬럼으로 확장한다(신규 테이블 없음). — v1.2.1에서 반영.
2. **asset 서빙**: backend asset proxy endpoint + serializer가 절대 URL 생성,
   DB엔 canonical object identity 저장(presigned는 대안). — v1.2.4에서 반영.
3. **worker 진입점**: 기존 `process_incoming`을 건드리지 않고 별도
   `process_s3_incoming` 모듈. — v1.2.2에서 반영.

## 검증 (scripts/check_s3_ingest.py 커버리지)

- `_READY.json` 정상 parsing
- 필수 필드 누락 / 잘못된 schema version
- batch_external_id ↔ prefix 불일치
- manifest_key 절대경로 / `../` traversal 차단
- manifest 누락 / malformed manifest
- asset 일부 누락
- ready marker 없는 배치 skip (discovery가 후보로 잡지 않음)
- asset key resolution (batch-relative → `{root}/batches/{batch}/{url}`)
- optional manifest_sha256 checksum 일치/불일치
- optional asset_count 일치/불일치
- pagination (여러 페이지에 걸친 ready marker 나열)
- MinIO path-style endpoint 설정 (`S3_FORCE_PATH_STYLE=true`)
- 실제 AWS endpoint 미지정 설정 (`S3_ENDPOINT_URL` 없음)
- secret이 로그/repr에 노출되지 않음

## 실행

```bash
# from feed-prototype/backend (no DB, no MinIO needed)
python -m scripts.check_s3_ingest
```
