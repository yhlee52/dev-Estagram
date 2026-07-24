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

## 4. 다음 단계 (같은 v1.2.3에서 이어짐)

- producer 업로드 예제 CLI(`scripts/upload_post_batch.py`)로 배치를 MinIO에 올리고,
- watch worker(`python -m app.services.process_s3_incoming --watch`)가 발견→import
  하는 end-to-end 절차를 이 문서에 이어서 추가합니다.
