# S3 / MinIO Ingestion 검증 RUNBOOK

내 PC의 파일을 **S3 인터페이스(로컬 MinIO)** 로 올려서, backend watch worker가
발견→검증→DB import 하고 feed에서 보이는 것까지 **처음부터 끝까지** 확인하는
절차입니다. PostgreSQL 초기화부터 다룹니다.

> 이 문서는 v1.2.x(외부/객체 스토리지 Ingestion) 테마의 통합 검증 가이드입니다.
> MinIO 설치 자체는 `MINIO_LOCAL_DEV.md`, 아키텍처는 `S3_INGESTION_ARCHITECTURE.md`
> 를 참고하세요.

명령은 Windows PowerShell 기준입니다. 모든 backend 명령은 `feed-prototype/backend`
에서 venv를 활성화한 상태로 실행합니다.

---

## 0. 사전 준비 (한 번만)

- **Docker Desktop** 실행 중 (MinIO용)
- **PostgreSQL** 로컬 실행 중
- **Python 환경** + 의존성

### Docker Desktop 실행

엔진이 떠 있어야 MinIO가 뜹니다. 확인:

```powershell
docker info --format "{{.ServerVersion}}"   # 버전이 찍히면 준비 완료
```

`npipe:////./pipe/dockerDesktopLinuxEngine ... cannot find the file` 가 나오면
**설치 문제가 아니라 엔진이 꺼져 있는 것**입니다. 시작 메뉴에서 실행하거나:

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
```

> 설치 위치는 환경마다 다릅니다(`C:\Program Files\Docker\Docker\` 인 경우도,
> 위처럼 `%LOCALAPPDATA%\Programs\DockerDesktop\` 인 경우도 있습니다).
> 엔진 기동에 30~60초 걸립니다.

### Python 환경

venv든 conda든 무방합니다. 이후 **모든 backend 명령은 이 환경을 활성화한 상태로
`feed-prototype/backend`에서** 실행합니다.

```powershell
# venv
cd feed-prototype\backend
python -m venv .venv           # 이미 있으면 생략
.\.venv\Scripts\activate

# 또는 conda
conda activate <env-name>
cd feed-prototype\backend
```

```powershell
pip install -r requirements.txt   # boto3 포함
```

> `requirements.txt`의 `httpx2` 는 레포 어디서도 import하지 않는 잔여 항목입니다.
> 설치가 거기서 실패하면 그 줄만 지우고 재실행하세요.

> 이미 한 번 세팅을 마쳤고 **PC를 재부팅한 뒤 다시 시작**하는 경우라면
> 0~3단계를 반복할 필요 없이 13절(재부팅 후 재개)로 가세요.

---

## 1. PostgreSQL 초기화 (깨끗한 상태로)

두 방법 중 하나. **방법 A**가 가장 간단합니다.

### 방법 A — 스키마만 리셋 (DB는 그대로, alembic으로)

```powershell
alembic downgrade base     # 우리 마이그레이션이 만든 모든 테이블 제거
alembic upgrade head       # 0001~0013 재생성 (0013 = S3 tracking 컬럼)
```

### 방법 B — DB 자체를 새로 (완전 초기화)

pgAdmin 또는 psql에서:

```sql
DROP DATABASE feed_prototype;
CREATE DATABASE feed_prototype;
```

그다음:

```powershell
alembic upgrade head
```

### 시드(데모 로그인 유저)

```powershell
python -m app.services.seed
```

- 데모 로그인 계정: `ari`/`ari`, `mika`/`mika`, `nova`/`nova` (frontend 로그인용)
- 시드는 write-once라 이미 있으면 덮지 않습니다.

> `alembic upgrade head`가 `0013_s3_ingest_tracking`까지 올라갔는지 꼭 확인하세요.
> S3 배치 tracking은 이 마이그레이션의 컬럼(`ingest_state` 등)을 사용합니다.

---

## 2. MinIO 기동

`feed-prototype/` 에서:

```powershell
cd ..
docker compose -f docker-compose.minio.yml up -d
docker compose -f docker-compose.minio.yml logs --tail 20
cd backend
```

- 콘솔: http://localhost:9001 (`localadmin` / `localpassword`)
- `estagram` 버킷이 자동 생성됩니다.

---

## 3. backend `.env` 설정

`feed-prototype/backend/.env` 에 아래가 있어야 합니다. `DATABASE_URL`은 본인 값으로.

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype

INGEST_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=localadmin
S3_SECRET_ACCESS_KEY=localpassword
S3_REGION=us-east-1
S3_BUCKET=estagram
S3_ROOT_PREFIX=estagram
S3_FORCE_PATH_STYLE=true

# 브라우저에서 S3 자산을 부르는 proxy base (backend origin). 기본값이면 생략 가능.
ASSET_PROXY_BASE_URL=http://127.0.0.1:8000
```

> worker와 backend는 `.env`를 읽습니다. **producer 업로드 CLI는 `.env`가 아니라
> 셸 환경변수/플래그를 읽습니다** (5단계 참고).

---

## 4. backend 실행

새 터미널(venv 활성화)에서:

```powershell
uvicorn app.main:app --reload
```

확인:

```powershell
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/imports
```

(frontend까지 보려면 또 다른 터미널에서 `feed-prototype`에서 `npm install` 후
`npm run dev` → http://localhost:5173, `ari`/`ari`로 로그인.)

---

## 5. 내 파일로 배치 만들기

producer는 **배치 디렉터리**를 통째로 올립니다. 디렉터리 구조는:

```text
my_batch_001/
├─ feed_posts.json        # manifest (아래 형식)
└─ assets/
   ├─ photo1.png          # feed_posts.json이 "assets/photo1.png" 로 참조
   └─ data1.csv
```

`feed_posts.json` 은 동결된 external package format입니다(자세히는
`EXTERNAL_POST_PACKAGE_GUIDE.md`). 최소 템플릿:

```json
{
  "batch": { "external_id": "my_batch_001", "source": "my-pc" },
  "accounts": [
    { "external_id": "acct-me", "handle": "my_bot", "display_name": "My Bot" }
  ],
  "posts": [
    {
      "external_id": "my-post-001",
      "account_external_id": "acct-me",
      "title": "첫 S3 포스트",
      "text": "내 PC 파일을 MinIO로 올려서 만든 포스트.",
      "tags": ["s3", "my-files"],
      "metadata_json": { "source": "my-pc" },
      "assets": [
        { "external_id": "a-001-img", "type": "image", "url": "assets/photo1.png", "sort_order": 1 },
        { "external_id": "a-001-csv", "type": "table", "url": "assets/data1.csv", "sort_order": 2 }
      ]
    }
  ]
}
```

규칙:

- `batch.external_id` = **배치 디렉터리 이름**과 같게(= S3 prefix 이름). 다르면 업로드가 거부됩니다.
- 각 asset의 `url` 은 **배치 상대경로**(`assets/파일명`)만. 절대경로/`..`/`http://`/`s3://` 금지.
  (원격 링크를 넣고 싶으면 `type: "link"` + `url: "https://..."` — 이건 업로드 대상이 아니라 그대로 링크로 저장됩니다.)
- `type` 은 `image | plot | table | file | link` 중 하나.
- 실제 파일들을 `assets/` 아래에 두고, 파일명이 manifest와 일치해야 합니다.

> 팁: 레포에 예시 배치가 있습니다 —
> `data/external_posts/s3_samples/s3_sample_batch_001/`. 먼저 이걸로 연습한 뒤
> 본인 파일로 바꾸세요.

---

## 6. 배치를 MinIO에 업로드 (producer)

먼저 **dry-run**으로 계획만 확인(자격증명 불필요):

```powershell
python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001 --bucket estagram --dry-run
```

문제 없으면 실제 업로드. producer는 자격증명을 셸 env에서 읽으므로 PowerShell에서:

```powershell
$env:S3_ENDPOINT_URL="http://localhost:9000"
$env:S3_ACCESS_KEY_ID="localadmin"
$env:S3_SECRET_ACCESS_KEY="localpassword"
$env:S3_REGION="us-east-1"
$env:S3_BUCKET="estagram"
$env:S3_ROOT_PREFIX="estagram"
$env:S3_FORCE_PATH_STYLE="true"

python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001
```

`$env:` 는 **그 터미널 세션에만** 유지됩니다. 같은 터미널에서는 몇 번을 업로드하든
한 번만 설정하면 되지만, 터미널을 닫으면 사라집니다.

### 값별 출처 (전부 env로 줄 필요는 없음)

| 값 | 플래그 대체 | 비고 |
|---|---|---|
| `S3_ACCESS_KEY_ID` | 없음 (env 전용) | 필수 |
| `S3_SECRET_ACCESS_KEY` | 없음 (env 전용) | 필수 |
| `S3_FORCE_PATH_STYLE` | 없음 (env 전용) | **MinIO는 사실상 필수** (아래) |
| `S3_BUCKET` | `--bucket` | 둘 중 하나 필수 |
| `S3_ENDPOINT_URL` | `--endpoint-url` | |
| `S3_ROOT_PREFIX` | `--root-prefix` | 기본 `estagram` |
| `S3_REGION` | 없음 (env 전용) | 기본 `ap-northeast-2`, **생략 가능** |

따라서 최소 구성은 env 3개 + 플래그입니다:

```powershell
$env:S3_ACCESS_KEY_ID="localadmin"
$env:S3_SECRET_ACCESS_KEY="localpassword"
$env:S3_FORCE_PATH_STYLE="true"

python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001 `
  --bucket estagram --endpoint-url http://localhost:9000
```

- **`S3_FORCE_PATH_STYLE=true` 를 빼먹는 것이 가장 흔한 실패**입니다. 없으면 boto3가
  virtual-host 방식으로 `estagram.localhost:9000` 에 접속을 시도해 DNS 해석에서
  죽습니다. MinIO는 path-style이 필요합니다.
- **`S3_REGION` 은 물리적 위치와 무관합니다.** MinIO는 본인 PC의 `localhost:9000`
  에서 돌고, region은 SigV4 서명 문자열 생성에만 쓰이며 MinIO는 값을 검증하지
  않습니다. `us-east-1`이든 `ap-northeast-2`든 동작하고 생략해도 됩니다. region이
  실제로 중요해지는 건 11절(회사 S3 전환) 때이며, 그때는 버킷이 실제로 위치한
  리전을 정확히 넣어야 합니다.

### 반복 입력이 귀찮으면

`set-minio-env.ps1` 같은 스크립트를 만들어두고 새 터미널마다 **dot-source** 합니다
(앞의 점이 있어야 현재 세션에 적용됩니다):

```powershell
. .\set-minio-env.ps1
```

> 이 파일에는 자격증명이 들어가므로 커밋되지 않게 하세요. 레포의 `.gitignore`가
> `backend/set-minio-env.ps1` 를 무시하도록 되어 있습니다.

업로드 순서는 **asset → feed_posts.json → _READY.json(마지막)** 으로 보장됩니다.
MinIO 콘솔(http://localhost:9001)의 `estagram/batches/my_batch_001/` 아래에
파일들이 보이면 성공입니다.

옵션:

- `--dry-run` : 업로드 없이 계획만
- `--overwrite` : 같은 batch id 재업로드 (기본은 이미 있으면 거부)
- `--batch-id <id>` : 디렉터리명과 다른 id를 쓸 때(단, manifest의 `batch.external_id`와 일치해야 함)

---

## 7. worker로 발견 → import

한 번만 처리(one-shot):

```powershell
python -m app.services.process_s3_incoming
```

또는 폴링(Ctrl-C로 graceful 종료):

```powershell
python -m app.services.process_s3_incoming --watch --interval 10
```

로그에 `s3_watch poll discovered=1 completed=1 ...` 가 나오면 import 성공입니다.

---

## 8. 검증

### API로 (로그인 불필요)

```powershell
# 배치 tracking 상세 (상태 completed, 귀속 포스트)
curl http://127.0.0.1:8000/api/imports/my_batch_001

# 전체 포스트 목록에서 내 포스트 확인
curl "http://127.0.0.1:8000/api/posts?keyword=S3"
```

### 자산 렌더 (proxy)

포스트 응답의 asset `url` 이 `http://127.0.0.1:8000/api/assets/<asset_id>` 형태입니다.
브라우저나 curl로 열면 backend가 MinIO에서 스트리밍합니다:

```powershell
curl -L http://127.0.0.1:8000/api/assets/<asset_id> --output out.png
```

### frontend로

http://localhost:5173 로그인(`ari`/`ari`) → **Explore/Posts(Browse)** 에서 모든
포스트가 보이므로 방금 import한 포스트와 이미지가 표시됩니다. (Home 피드는 팔로우한
계정만 나오므로, 내 봇 계정을 팔로우하거나 Browse에서 확인하세요.)

### 멱등성 (중복 방지)

worker를 다시 실행:

```powershell
python -m app.services.process_s3_incoming
```

로그가 `skipped=1` (또는 completed 0)이고, `/api/imports/my_batch_001` 의 포스트
수가 그대로면 정상입니다(중복 생성 없음).

### Immutability (객체 불변)

MinIO 콘솔에서 `estagram/batches/my_batch_001/` 의 객체(assets/manifest/_READY)가
import 전후로 **그대로** 있는지 확인합니다. worker는 S3를 읽기만 하고 이름/위치를
바꾸거나 지우지 않습니다.

---

## 9. 재처리 / 정리

- **completed 배치는 자동 재처리되지 않습니다.** 다시 돌리려면:
  - PostgreSQL에서 해당 `import_batch.ingest_state` 를 `pending`으로 변경, 또는
  - 새 revision id로 업로드: `my_batch_001_v2` (디렉터리·`batch.external_id` 함께 변경)
- MinIO 데이터 삭제: `docker compose -f docker-compose.minio.yml down -v`
- DB 리셋: 1단계 반복.

---

## 10. 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| `docker: command not found` | Docker Desktop 미실행/미설치. 실행 후 새 터미널. |
| `cannot find the file ... dockerDesktopLinuxEngine` | Docker **엔진이 꺼진 것**(설치 문제 아님). 0절 참고. |
| producer가 `estagram.localhost` 로 붙으며 DNS 실패 | `S3_FORCE_PATH_STYLE=true` 누락. env 전용이라 플래그로 못 줍니다. |
| 재부팅 후 `docker ps` 에 estagram-minio 없음 | 종료 전 `compose down` 을 했다면 컨테이너가 삭제된 것. `up -d` 재실행(데이터는 volume에 보존). |
| producer `bucket is required` | 셸에 `S3_BUCKET` 없음 or `--bucket` 누락. |
| producer `batch already uploaded` | 이미 올린 배치. `--overwrite` 또는 새 id. |
| worker `S3_BUCKET is required` | `.env`에 `S3_*`/`INGEST_STORAGE_BACKEND=s3` 누락. |
| worker `discovered=0` | `_READY.json` 미업로드(순서/실패) 또는 prefix 불일치. 콘솔에서 객체 확인. |
| import `manifest_schema_invalid` | `feed_posts.json` 형식 오류. `--dry-run`으로 먼저 검증. |
| import `asset_missing` | manifest가 참조한 `assets/파일`이 실제로 없음. |
| 자산이 안 열림(404) | migration 0013 미적용 or 비-S3 자산. `/api/assets/{id}`는 S3 자산 전용. |
| 이미지가 깨짐 | `ASSET_PROXY_BASE_URL`이 backend origin과 다름. 기본 `http://127.0.0.1:8000` 확인. |

---

## 11. 회사 S3로 전환 (코드 변경 없이)

`.env`의 `S3_*` 만 바꾸면 됩니다(동일 boto3 코드):

```env
INGEST_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=            # 실제 AWS S3면 비움(리전으로 해석). S3-compatible이면 endpoint 지정
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=ap-northeast-2
S3_BUCKET=company-estagram
S3_ROOT_PREFIX=estagram
S3_FORCE_PATH_STYLE=false
```

실제 secret은 커밋하지 않습니다(`.env`는 gitignore).

---

## 12. 자동 단위 테스트 (외부 서비스 불필요, 참고)

라이브 검증과 별개로, 언제든 아래로 로직을 검증할 수 있습니다(MinIO/DB 불필요):

```powershell
python -m scripts.check_s3_ingest
python -m scripts.check_s3_ingest_tracking
python -m scripts.check_s3_watch
python -m scripts.check_upload_post_batch
python -m scripts.check_asset_url
```

> 주의: 이 스크립트들은 SQLModel 메타데이터로 테이블을 만들고 **alembic 체인을 타지
> 않습니다.** 즉 마이그레이션 자체의 회귀는 잡지 못하므로, 마이그레이션을 건드렸다면
> 빈 DB에서 `alembic upgrade head` → `downgrade base` → `upgrade head` 왕복을
> 따로 확인하세요.

---

## 13. 재부팅 후 재개

한 번 세팅을 마친 뒤 PC를 재시작한 경우입니다. **데이터는 전부 보존되고, 프로세스만
다시 띄우면 됩니다.**

### 자동으로 복구되는 것

| 항목 | 이유 |
|---|---|
| PostgreSQL (DB/스키마/seed/import된 포스트) | 서비스가 `StartType=Automatic` 이면 부팅 시 자동 시작 |
| MinIO 데이터 (버킷·업로드한 배치 객체) | Docker named volume(`*_minio-data`)에 보존 |
| MinIO 컨테이너 | compose의 `restart: unless-stopped` — **Docker 엔진이 뜨면** 자동 복귀 |

### 수동으로 해야 하는 것

1. **Docker Desktop 실행** — 자동 시작이 꺼져 있으면 이걸 안 켜는 한 MinIO도 안
   옵니다(`restart: unless-stopped` 는 엔진이 떠야 발동). 0절 참고.
   ```powershell
   docker info --format "{{.ServerVersion}}"   # 엔진 확인
   docker ps                                   # estagram-minio 가 Up 인지
   ```
   컨테이너가 아예 없으면(종료 전 `compose down` 을 한 경우):
   ```powershell
   docker compose -f docker-compose.minio.yml up -d
   ```
2. **셸 환경변수 재설정** — `$env:` 는 세션 한정이라 반드시 날아갑니다(6절).
3. **프로세스 3개 재기동** — backend(uvicorn), worker(`--watch`), frontend(`npm run dev`).

### 복구 확인

```powershell
curl http://127.0.0.1:8000/api/imports
```

이전에 import한 배치 이력이 그대로 보이면 PostgreSQL·MinIO 둘 다 정상입니다.
`completed` 배치는 재처리되지 않으므로 worker를 다시 띄워도 **중복 포스트는 생기지
않습니다**(9절).

> **`docker compose down -v` 는 volume까지 지웁니다** — 업로드한 배치 객체가 전부
> 사라지므로, 의도적으로 초기화할 때만 사용하세요. `down` (=`-v` 없이)은 데이터를
> 보존합니다.
