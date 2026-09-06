# QUICK RUN GUIDE : LOCAL

---

# PHASE 0. 사전 준비

사전 환경 설정을 준비 및 체크한다.

1. Docker desktop 실행. 

localadmin / localpassword

데스크탑 도커는 시작 메뉴에서 찾아서 실행하면 됨

2. PostgreSQL(pgadmin) 실행 및 feed_ops DB 존재 확인

3. 가상환경 및 기타 의존성 설치 확인

pip install -r requirements.txt

# PHASE 1. backend/.env 작성

```
feed-prototype/backend/.env
```

```
DATABASE_URL=postgresql+psycopg://postgres:<비밀번호>@localhost:5432/feed_ops

INGEST_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=localadmin
S3_SECRET_ACCESS_KEY=localpassword
S3_REGION=us-east-1
S3_BUCKET=estagram
S3_ROOT_PREFIX=estagram
S3_FORCE_PATH_STYLE=true
ASSET_PROXY_BASE_URL=http://127.0.0.1:8000
```

alembic이 이 .env 파일의 DATABASE_URL을 읽으므로 이 파일을 먼저 만들어야 함

# PHASE 2. DB 스키마 + 시드

DB가 비어있다면 downgrade 없이 바로

```
alembic upgrade head
```

잘 만들어졌는지 체크를 위해선
```
alembic current
```

로그인용 데모 계정 ari/mika/nova 생성
```
python -m app.services.seed
```

추가:

DB 다운그레이드
```
alembic downgrade base
```

# PHASE 3. MinIO 기동

feed-prototype 폴더에서...

```
docker compose -f docker-compose.minio.yml up -d
```
```
docker compose -f docker-compose.minio.yml logs --tail 20
```

아래 문구가 뜨면 정상

```
MinIO ready. bucket: estagram
```

http://localhost:9001/ 에 접속해 확인한다.

# PHASE 4. backend + frontend 기동

- 터미널 A (venv) 

feed-prototype/backend 위치에서

```
uvicorn app.main:app --reload
```

- 터미널 B

feed-prototype/.env 생성한 뒤

```
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:8000
```

작성 후

첫 실행 시엔

```
npm install
```

을 수행.

이후

```
npm run dev
```

반드시 
```
http://localhost:5173
```
으로 접속해야 한다.

# PHASE 5. 배치 폴더 만들기

```
my_batch_001/
├─ feed_posts.json
└─ assets/
   ├─ photo1.png
   └─ data1.csv
```

아래는 핵심 규칙으로, 어기면 업로드를 거부한다.

- batch.external_id == 폴더 이름
- asset url은 배치 상대경로(assets/파일명)만 — 절대경로 / .. / http:// / s3:// 금지
- type은 image | plot | table | file | link 중 하나
- manifest가 참조하는 파일이 assets/에 실제로 존재

# PHASE 7. MinIO에 업로드(producer)

새로운 터미널 C(venv)를 사용. 주의점은 이 producer는 .env가 아니라 셀 환경변수를 읽음

1. 먼저 dry-run을 통해 manifest 검증하고 계획만 출력한다

```
python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001 --bucket estagram --dry-run
```

2. 실제 업로드
```
$env:S3_ENDPOINT_URL="http://localhost:9000"
$env:S3_ACCESS_KEY_ID="localadmin"
$env:S3_SECRET_ACCESS_KEY="localpassword"
$env:S3_REGION="us-east-1"
$env:S3_BUCKET="estagram"
$env:S3_ROOT_PREFIX="estagram"
$env:S3_FORCE_PATH_STYLE="true"
python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001
```

이후 MinIO 콘솔에서 위 파일들을 확인하면 됨

각 터미널마다 위 환경변수가 적용되므로, 새 터미널을 사용할 때엔 다시 입력해야 함.

환경변수 파일 set-minio-env.ps1 을 만든 뒤,
```
$env:S3_ENDPOINT_URL="http://localhost:9000"
$env:S3_ACCESS_KEY_ID="localadmin"
$env:S3_SECRET_ACCESS_KEY="localpassword"
$env:S3_BUCKET="estagram"
$env:S3_ROOT_PREFIX="estagram"
$env:S3_FORCE_PATH_STYLE="true"
```

을 적어넣은 뒤, 
```
. ./set-minio-env.ps1
```
을 실행한 뒤 업로드를 진행하는 것이 편리.

## 배치가 여러 개일 때 (`--batch-root`)

배치 폴더가 수십~수백 개라면 `--batch-dir` 를 반복하는 대신 상위 폴더 하나를
`--batch-root` 로 지정하면 그 아래 배치를 전부 한 번에 올린다. 하위 폴더를
재귀적으로 뒤져 manifest(`feed_posts.json`)를 가진 디렉터리를 배치로 인식하므로,
깊이가 섞여 있어도 된다.

먼저 dry-run으로 전부 검증만:

```
python -m scripts.upload_post_batch --batch-root C:\path\to\batches --bucket estagram --dry-run
```

문제가 없으면 실제 업로드:

```
python -m scripts.upload_post_batch --batch-root C:\path\to\batches
```

끝나면 아래처럼 요약이 나온다.

```
summary: uploaded=173 skipped=2 failed=1 of 176
```

- 배치 하나가 실패해도 나머지는 계속 진행된다. 실패 목록은 마지막에 따로 출력된다.
- 이미 올라간 배치는 `failed` 가 아니라 `skipped` 로 집계된다. 그래서 중간에 끊겨도
  같은 명령을 다시 실행하면 안 올라간 것만 채워진다.
- `failed` 가 하나라도 있으면 종료 코드가 1이다.
- `--batch-id` 는 배치 하나를 지정하는 옵션이라 `--batch-root` 와 같이 쓸 수 없다.

# PHASE 8. watch worker 기동 (감지 -> import)

새로운 터미널 D(venv) 를 연 뒤, backend 폴더로 간다

```
python -m app.services.process_s3_incoming --watch --interval 10
```

실행하여 로그에 s3_watch poll discovered=1 completed=1 가 보이면 import 성공

테스트 팁 : PHASE 8 worker를 PHASE 7 보다 먼저 실행해 놓으면 watch 모드 검증에 더 적합함

---

# 기타 팁

시스템 재시작 시 자동으로 복구되는 것들

- PostgreSQL (feed_ops, 스키마, seed, import 된 포스트)
- MinIO 데이터 (버킷, 업로드한 배치 객체)
- MinIO 컨테이너

수동으로 다시 해야 하는 것들

- Docker Desktop 실행
- 환경변수 재설정 (. ./set-minio-env.ps1)
- 프로세스 재기동 (backend, worker, frontend)

주의! 만일 의도적으로 MinIO에 올린 배치 객체를 전부 초기화하고 싶다면?

feed-prototype 폴더에서 (`-f` 를 빼면 설정 파일을 못 찾아 실패한다)

```
docker compose -f docker-compose.minio.yml down -v
```

만일 파일에 문제가 있거나, 포스트 에러가 있어서 다시 작성 후 동일한 배치 폴더 이름으로 만들어 올린다면, 다음을 수행한다.

```
1) 고친 배치를 덮어쓰기로 다시 올린다
python -m scripts.upload_post_batch --batch-dir D:\...\my_batch_001 --overwrite

2) 상태를 pending으로 되돌린다  ← SQL 대신
python -m scripts.reset_batch_state --batch-dir D:\...\my_batch_001
```

여러 개를 고쳤다면 batch-root를 사용할 수 있다.
```
python -m scripts.upload_post_batch --batch-root D:\...\batches --overwrite
python -m scripts.reset_batch_state  --batch-root D:\...\batches
```

왜 두 번  실행하냐면, 첫 번째 코드는 MinIO의 배치 객체를, 두 번째 코드는 Postgres의 ingest_state를 변경하기 때문이다.

# 완전 재개시 방법

⚠️ 먼저 워커를 멈추세요
가장 흔한 함정입니다. Postgres만 초기화하면 MinIO에 _READY.json이 176개 그대로 있으므로, 워커가 다음 poll에서 전부 다시 import합니다. 게다가 지금 .env에 S3_WATCH_BATCH_LIMIT=0이 들어가 있어서 한 번에 전부 들어옵니다.

반대로 MinIO만 지우면 import_batch가 completed로 남아 포스트가 그대로 있습니다. 둘은 반드시 같이 초기화해야 합니다.

1. 프로세스 정지
터미널 A(uvicorn)와 D(worker)를 Ctrl+C. 프론트(터미널 B)는 켜두셔도 됩니다.

2. MinIO 초기화 — feed-prototype 폴더에서

```
docker compose -f docker-compose.minio.yml down -v
docker compose -f docker-compose.minio.yml up -d
docker compose -f docker-compose.minio.yml logs --tail 20
```
-v가 핵심입니다. MinIO는 minio-data라는 Docker named volume을 쓰는데, -v 없이는 볼륨이 남아 데이터가 그대로 살아납니다. 로그에 MinIO ready. bucket: estagram이 다시 뜨면 빈 버킷으로 재생성된 겁니다.

3. Postgres 초기화 — feed-prototype/backend 폴더에서

```
alembic downgrade base
alembic upgrade head
python -m app.services.seed
```
migration 0001~0013 전부 downgrade가 제대로 구현돼 있어서 downgrade base면 테이블이 깨끗이 지워집니다. 확인은 alembic current.

(뭔가 꼬이면 pgAdmin에서 feed_ops DB를 drop 후 재생성하고 alembic upgrade head부터 하셔도 됩니다.)

4. 재기동

```
uvicorn app.main:app --reload                                    # 터미널 A
python -m app.services.process_s3_incoming --watch --interval 10 # 터미널 D
```

5. 브라우저
localStorage에 이전 user id/handle이 남아 있어서 로그인 상태가 어긋날 수 있습니다. localhost:5173에서 로그아웃하거나 사이트 데이터를 지우고 데모 계정(ari/mika/nova)으로 다시 로그인하세요.

