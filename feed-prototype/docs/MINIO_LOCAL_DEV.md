# 로컬 MinIO 개발환경 (v1.2.3)

집 개발환경에서 S3-compatible object storage를 무료로 쓰기 위한 로컬 MinIO 설정
가이드입니다. 회사 환경에서는 이 MinIO 대신 실제 S3 endpoint로 `S3_*` 환경변수만
바꾸면 동일하게 동작합니다(코드/boto3 동일).

## 0. 전제

- Windows에 **Docker Desktop**이 설치되어 실행 중이어야 합니다.
- 설치가 처음이라면 아래 "Docker Desktop 설치" 절을 먼저 따르세요.

## 1. Docker Desktop 설치 (Windows 10/11)

Windows 10 Home은 WSL2 백엔드를 사용합니다.

1. **WSL2 활성화** — PowerShell을 **관리자 권한**으로 열고:
   ```powershell
   wsl --install
   ```
   필요한 Windows 기능(Virtual Machine Platform, WSL)과 Ubuntu가 설치됩니다.
   끝나면 **재부팅**합니다. (실패 시 BIOS에서 가상화(Virtualization)를 활성화)
2. **Docker Desktop 다운로드/설치** — https://www.docker.com/products/docker-desktop/
   에서 Windows용 설치 파일을 받아 실행합니다. 설치 중 "Use WSL 2 instead of
   Hyper-V" 옵션을 켠 채로 진행합니다.
3. 설치 후 필요하면 재부팅하고 **Docker Desktop을 실행**합니다. 우측 하단 고래
   아이콘이 안정 상태(Engine running)가 될 때까지 기다립니다.
4. **확인** — 새 터미널에서:
   ```bash
   docker --version
   docker run --rm hello-world
   ```
   `hello-world`가 정상 출력되면 준비 완료입니다.

## 2. MinIO 기동

`feed-prototype/` 폴더에서:

```bash
docker compose -f docker-compose.minio.yml up -d
docker compose -f docker-compose.minio.yml logs -f   # "MinIO ready. bucket: estagram" 확인 후 Ctrl-C
```

- 웹 콘솔: http://localhost:9001 (로그인 `localadmin` / `localpassword`)
- S3 API: http://localhost:9000
- 콘솔에 `estagram` 버킷이 자동 생성되어 있으면 성공입니다.

중지/삭제:

```bash
docker compose -f docker-compose.minio.yml down      # 중지(데이터 유지)
docker compose -f docker-compose.minio.yml down -v   # 중지 + 데이터 삭제
```

데이터는 Docker named volume(`minio-data`)에 보존되어 컨테이너를 지워도
남습니다. Windows 폴더에 두고 싶으면 compose의 volume 라인을 bind mount로
바꾸세요(파일 주석 참고).

## 3. backend 연결 설정

`backend/.env`(gitignore됨)에 아래를 넣습니다. `.env.example`의 "home MinIO"
블록과 동일합니다.

```env
INGEST_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=localadmin
S3_SECRET_ACCESS_KEY=localpassword
S3_REGION=us-east-1
S3_BUCKET=estagram
S3_ROOT_PREFIX=estagram
S3_FORCE_PATH_STYLE=true
```

boto3가 아직 설치돼 있지 않다면:

```bash
cd backend
pip install -r requirements.txt
```

## 4. End-to-end 실행 (producer → MinIO → worker → feed)

MinIO(2절)와 backend PostgreSQL, 그리고 `backend/.env`(3절)가 준비된 상태에서
아래를 순서대로 실행합니다. 모두 `feed-prototype/backend`에서, backend venv가
활성화된 상태로 실행하세요.

### 4-1. 의존성 + 마이그레이션

```bash
pip install -r requirements.txt      # boto3 포함
alembic upgrade head                 # v1.2.1의 0013(S3 tracking 컬럼) 적용
```

### 4-2. 샘플 배치를 MinIO에 업로드

레포에 포함된 샘플 배치를 producer CLI로 올립니다. 자산 → manifest → `_READY.json`
순서로 업로드됩니다(자격증명은 `.env`가 아니라 셸 env에서 읽으므로, 아래처럼
env를 넘겨주거나 미리 export 하세요).

```bash
# dry-run으로 먼저 계획만 확인 (업로드 안 함, 자격증명 불필요)
python -m scripts.upload_post_batch \
  --batch-dir ../data/external_posts/s3_samples/s3_sample_batch_001 \
  --bucket estagram --dry-run

# 실제 업로드 (S3_* 를 env로 전달)
S3_ENDPOINT_URL=http://localhost:9000 \
S3_ACCESS_KEY_ID=localadmin S3_SECRET_ACCESS_KEY=localpassword \
S3_REGION=us-east-1 S3_BUCKET=estagram S3_ROOT_PREFIX=estagram S3_FORCE_PATH_STYLE=true \
python -m scripts.upload_post_batch \
  --batch-dir ../data/external_posts/s3_samples/s3_sample_batch_001
```

> Windows PowerShell에서는 `env VAR=값 ...` 대신 `$env:S3_ENDPOINT_URL="http://localhost:9000"`
> 형태로 먼저 설정한 뒤 `python -m scripts.upload_post_batch ...` 를 실행하세요.
> 또는 `--bucket`/`--endpoint-url`은 플래그로, 자격증명만 `$env:` 로 주면 됩니다.

MinIO 콘솔(http://localhost:9001)의 `estagram` 버킷에
`estagram/batches/s3_sample_batch_001/` 아래로 `assets/summary.csv`,
`feed_posts.json`, `_READY.json` 이 보이면 성공입니다.

### 4-3. worker로 발견 → import

`.env`에 `INGEST_STORAGE_BACKEND=s3` 와 `S3_*`, `DATABASE_URL`이 있으면 worker는
그 설정을 읽습니다.

```bash
# 한 번만 처리 (one-shot)
python -m app.services.process_s3_incoming

# 또는 폴링 (Ctrl-C로 graceful 종료)
python -m app.services.process_s3_incoming --watch --interval 10
```

로그에 `s3_watch poll discovered=1 completed=1 ...` 이 보이면 import 성공입니다.

### 4-4. 확인

- 배치 이력: `GET http://127.0.0.1:8000/api/imports` (backend 실행 중일 때) 또는
  `GET /api/imports/s3_sample_batch_001` 에서 배치가 보입니다.
- feed/posts: import된 `S3 ingestion sample` 포스트가 조회됩니다.
- **멱등성 확인:** worker를 다시 실행하면 같은 배치는 `completed`라 **skip**되고
  중복 포스트가 생기지 않습니다(로그 `skipped=1`).

> 참고: 이 시점(v1.2.3)에서는 S3 자산의 **object identity만 DB에 저장**되고, 브라우저에서
> 실제 이미지/파일을 보여주는 asset URL 서빙은 **v1.2.4**에서 붙습니다. 즉 포스트/배치는
> 정상 import되지만, S3 자산의 인라인 렌더는 v1.2.4 이후에 동작합니다.

### 4-5. 재처리(필요 시)

`completed` 배치는 자동 재처리되지 않습니다. 다시 돌리려면 PostgreSQL에서 해당
`import_batch`의 `ingest_state`를 `pending`으로 되돌리거나, 새 revision id
(`s3_sample_batch_001_v2`)로 다시 업로드하세요. S3 객체는 어떤 경우에도 수정하지
않습니다.
