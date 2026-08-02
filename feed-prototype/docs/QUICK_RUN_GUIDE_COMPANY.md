# QUICK RUN GUIDE : COMPANY (사내 S3 + 서빙 PC)

회사 환경에서 구동하는 가이드입니다. 개인 PC용은 `QUICK_RUN_GUIDE_LOCAL.md`를
보세요. 두 문서는 같은 순서를 따르며, **다른 부분만** 이 문서에서 다시 설명합니다.

이 가이드가 만드는 최종 상태:

- **서빙 PC(또는 VM)** 한 대에서 backend / frontend / watch worker 프로세스를 띄워 둠
- 사내망의 **아무 PC에서나 `http://<서빙PC IP>:5173`** 으로 접속해서 feed를 봄
- 배치 폴더를 **사내 S3 drive**의 정해진 위치에 올리면 watch worker가 자동으로 import

---

## 로컬 PC 가이드와 달라지는 점

| 항목 | 개인 로컬 PC | 회사 환경 |
| --- | --- | --- |
| Object storage | Docker + MinIO 컨테이너 | **사내 S3 drive** (access key/secret) |
| Docker Desktop | 필요 | **불필요** (MinIO를 안 띄움) |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | 회사에서 받은 **사내 endpoint URL** |
| `S3_FORCE_PATH_STYLE` | `true` | **`true`** (동일) |
| `S3_REGION` | `us-east-1` | 담당자가 지정한 값 (모르면 `us-east-1`) |
| backend 바인딩 | `uvicorn app.main:app --reload` | `--host 0.0.0.0` **필수** |
| frontend 바인딩 | `npm run dev` | `npm run dev:lan` (= `--host 0.0.0.0`) **필수** |
| 접속 주소 | `http://localhost:5173` | `http://<서빙PC IP>:5173` |
| 추가 `.env` 키 | 없음 | `CORS_ALLOW_ORIGINS`, `ASSET_PROXY_BASE_URL` **필수** |
| 방화벽 | 불필요 | 5173 / 8000 inbound 허용 필요 |

**표기 규약** — 이 문서의 `<서빙PC IP>`는 서빙 PC의 사내망 IPv4 주소입니다.
예시에는 `10.10.20.30`을 사용하니, 실제 값으로 바꿔서 읽으세요.

---

# PHASE 0. 사전 준비 (서빙 PC에서)

서빙 PC로 쓸 PC 또는 VM을 정하고, 그 위에서 아래를 준비합니다.

1. **PostgreSQL 설치 및 `feed_ops` DB 존재 확인** (pgadmin 등)
   - backend가 같은 PC에서 돌므로 DB는 `localhost`로 붙어도 됩니다.
2. **Python 가상환경 + 의존성**
   ```powershell
   pip install -r requirements.txt
   ```
3. **Node.js + 의존성** (frontend 최초 1회)
   ```powershell
   npm install
   ```
4. **사내 S3 접속 정보 확보** — 인프라/스토리지 담당에게 받습니다.
   - **endpoint URL** (client 생성용, 사내 도메인)
   - **access key ID / secret access key**
   - bucket 이름
   - 우리가 배치를 올릴 **prefix (S3 상의 위치)** — 예: `estagram`
   - **region 값** — 사내 S3는 보통 region 개념이 형식적이라 담당자도 딱히 정해두지
     않았을 수 있습니다. 지정된 값이 없으면 `us-east-1`을 씁니다(로컬 MinIO와 동일).
   - 발급받은 key에 **해당 버킷/prefix의 읽기 + 쓰기 권한**이 있는지 확인

   권한은 두 가지 용도로 나뉩니다. 하나의 key로 둘 다 해도 되고, 분리할 수 있으면
   더 좋습니다.

   | 역할 | 필요 동작 |
   | --- | --- |
   | 서빙 PC (worker/backend) | 목록 조회 + 다운로드 (**읽기만**) |
   | 배치 올리는 사람 (producer) | 위 + **업로드** |

> Docker Desktop은 필요 없습니다. 회사에서는 MinIO를 띄우지 않고 사내 S3를 그대로
> 씁니다. 코드/boto3는 완전히 동일하고 `S3_*` 값만 바뀝니다 — 사내 S3도 MinIO와
> 같은 S3 호환 스토리지라, 사실 로컬에서 쓰던 설정에서 endpoint와 자격증명만
> 갈아끼우는 것에 가깝습니다.

---

# PHASE 1. 서빙 PC IP 확인 + 방화벽 열기

### 1-1. IP 확인

```powershell
ipconfig
```

사내망 어댑터의 **IPv4 주소**를 메모합니다 (예: `10.10.20.30`).

> IP가 DHCP로 바뀌면 접속 주소와 `.env` 값이 전부 어긋납니다. 서빙 PC는 **고정 IP**
> 또는 DHCP 예약으로 잡아두는 것을 권장합니다.

### 1-2. 방화벽 inbound 허용

**관리자 권한** PowerShell에서 (최초 1회):

```powershell
New-NetFirewallRule -DisplayName "feed-prototype backend 8000" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName "feed-prototype frontend 5173" `
  -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Domain,Private
```

frontend(5173)와 backend(8000) **둘 다** 열어야 합니다. 브라우저는 5173에서 화면을
받고, 그 화면의 JavaScript가 접속자 PC에서 직접 8000을 호출하기 때문입니다.

확인:

```powershell
Get-NetFirewallRule -DisplayName "feed-prototype*" | Select-Object DisplayName, Enabled
```

---

# PHASE 2. backend/.env 작성

```
feed-prototype/backend/.env
```

```ini
DATABASE_URL=postgresql+psycopg://postgres:<비밀번호>@localhost:5432/feed_ops

# --- 사내 S3 (client 생성에 필요한 값) ---
INGEST_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=https://s3.mycorp.local
S3_ACCESS_KEY_ID=<발급받은 access key id>
S3_SECRET_ACCESS_KEY=<발급받은 secret access key>
S3_REGION=us-east-1
S3_BUCKET=<버킷 이름>
S3_ROOT_PREFIX=estagram
S3_FORCE_PATH_STYLE=true

# --- 사내망 서빙 (여기가 로컬 가이드와 가장 크게 다른 부분) ---
ASSET_PROXY_BASE_URL=http://10.10.20.30:8000
CORS_ALLOW_ORIGINS=http://10.10.20.30:5173
SESSION_COOKIE_SECURE=false

# --- watch worker ---
S3_WATCH_INTERVAL_SECONDS=30
S3_WATCH_BATCH_LIMIT=20
```

alembic이 이 `.env`의 `DATABASE_URL`을 읽으므로 이 파일을 먼저 만들어야 합니다.

### 사내망 서빙 키 3개 (반드시 이해하고 넘어가기)

- **`ASSET_PROXY_BASE_URL=http://<서빙PC IP>:8000`**
  S3에 있는 asset은 backend proxy(`GET /api/assets/{id}`)를 통해 서빙되고, API가
  응답에 넣는 asset URL은 **이 값으로 시작하는 절대 주소**입니다. 기본값
  (`http://127.0.0.1:8000`)을 그대로 두면 다른 PC의 브라우저가 자기 자신의 8000번
  포트를 찾아가므로 **이미지/파일이 전부 깨집니다.**
- **`CORS_ALLOW_ORIGINS=http://<서빙PC IP>:5173`**
  브라우저가 보내는 origin과 **정확히** 일치해야 합니다(scheme + host + port).
  기본값은 `localhost:5173`뿐이라, 설정하지 않으면 사내망 접속 시 모든 API 호출이
  CORS로 차단됩니다. 쉼표로 여러 origin을 나열할 수 있습니다.
- **`SESSION_COOKIE_SECURE=false`**
  평문 HTTP로 서빙하므로 `false`여야 합니다. `true`로 두면 브라우저가 세션 쿠키를
  아예 되돌려보내지 않아 로그인이 되지 않습니다. (사내 HTTPS 리버스 프록시를 앞에
  두는 경우에만 `true`)

### 회사에서 받은 S3 정보 → 이 프로젝트 설정 매핑

직접 boto3로 S3를 쓰던 방식과 이 프로젝트의 설정은 1:1로 대응됩니다. 이 프로젝트는
같은 값을 코드에 적는 대신 `.env`에서 읽을 뿐입니다.

| 직접 쓰던 코드 | 이 프로젝트 |
| --- | --- |
| `boto3.client("s3", endpoint_url=...)` | `S3_ENDPOINT_URL` |
| `aws_access_key_id=...` | `S3_ACCESS_KEY_ID` |
| `aws_secret_access_key=...` | `S3_SECRET_ACCESS_KEY` |
| `region_name=...` | `S3_REGION` |
| `put_object(Bucket=...)` | `S3_BUCKET` |
| `put_object(Key="<prefix>/...")` 의 prefix | `S3_ROOT_PREFIX` |
| 업로드할 로컬 폴더 경로 | 업로드 CLI의 `--batch-dir` 인자 (PHASE 8) |

즉 **client를 만드는 4개 값은 `.env`에 한 번 적어두고**, 업로드할 때마다 바뀌는
것은 로컬 폴더 경로(`--batch-dir`)뿐입니다. object key는 CLI가 규칙대로 조립합니다.

### object key가 만들어지는 규칙

`S3_ROOT_PREFIX=estagram`, 배치 폴더 이름이 `my_batch_001`일 때 실제로 올라가는 key:

```
estagram/batches/my_batch_001/assets/photo1.png
estagram/batches/my_batch_001/feed_posts.json
estagram/batches/my_batch_001/_READY.json
```

- `batches/` 는 고정 부분입니다 (`S3_BATCHES_PREFIX`로 바꿀 수 있지만 그럴 일은
  거의 없습니다).
- `my_batch_001` 은 배치 폴더 이름이자 manifest의 `batch.external_id`입니다.
- 회사에서 **지정된 위치**를 받았다면 그 경로를 `S3_ROOT_PREFIX`에 넣습니다.
  슬래시가 들어간 값도 됩니다 — 예: `S3_ROOT_PREFIX=team-feed/incoming` 이면
  `team-feed/incoming/batches/my_batch_001/...` 에 올라갑니다.
- worker는 정확히 이 규칙으로 `_READY.json`을 찾습니다. 그래서 **업로드 쪽과
  backend 쪽의 `S3_BUCKET`/`S3_ROOT_PREFIX`가 같아야** 합니다. 다르면 업로드는
  성공하는데 worker는 영원히 `discovered=0`만 찍습니다.

### `S3_ENDPOINT_URL` / `S3_FORCE_PATH_STYLE` / `S3_REGION`

- **`S3_ENDPOINT_URL`** — 회사에서 받은 사내 endpoint URL을 **그대로** 넣습니다.
  끝에 슬래시나 버킷 이름을 붙이지 마세요 (`https://s3.mycorp.local/mybucket` ✗).
  버킷은 `S3_BUCKET`으로 따로 지정합니다.
- **`S3_FORCE_PATH_STYLE=true`** — 사내 도메인 endpoint이므로 `true`입니다.
  주소를 `https://s3.mycorp.local/<버킷>/<key>` 형태로 조립합니다. `false`로 두면
  버킷 이름을 host 앞에 붙이려 시도하는데(`https://<버킷>.s3.mycorp.local`), 사내
  DNS에 그런 이름이 없으므로 접속에 실패합니다. **로컬 MinIO와 같은 값입니다.**
- **`S3_REGION`** — 사내 S3 호환 스토리지는 region이 형식적인 경우가 많습니다.
  담당자가 지정한 값이 있으면 그 값을, 없으면 `us-east-1`을 씁니다. 다만 값이
  서명(SigV4)에 들어가므로, 스토리지가 특정 region을 요구한다면 반드시 맞춰야
  합니다 (PHASE 4의 오류 목록 참고).

> 사내 S3는 MinIO와 같은 계열의 S3 호환 스토리지입니다. 그래서 로컬 가이드에서
> 쓰던 설정과 **`S3_FORCE_PATH_STYLE=true`가 동일**하고, 실질적으로 endpoint 주소와
> 자격증명만 바뀝니다.

> 이 파일은 gitignore 되어 있습니다. **access key/secret을 커밋하지 마세요.**

---

# PHASE 3. DB 스키마 + 시드

로컬 가이드와 동일합니다. `feed-prototype/backend`에서:

```powershell
alembic upgrade head
alembic current
```

로그인용 데모 계정 생성:

```powershell
python -m app.services.seed
```

---

# PHASE 4. 사내 S3 연결 확인

로컬의 "MinIO 기동" 단계를 대체합니다. 컨테이너를 띄우는 대신 **연결이 되는지만
확인**합니다. `feed-prototype/backend`에서 worker를 `--watch` 없이 한 번만 실행:

```powershell
python -m app.services.process_s3_incoming
```

- `s3_watch poll discovered=0 completed=0 failed=0 skipped=0` → **연결 성공**
  (아직 올린 배치가 없으니 `discovered=0`이 정상입니다)
- `s3_watch config error: ...` → `.env`의 `S3_BUCKET` 등 누락
- `EndpointConnectionError` / 이름 확인 실패 → `S3_ENDPOINT_URL` 오타이거나 사내
  DNS/VPN으로 그 도메인에 닿지 못하는 상태입니다. 먼저 이름이 풀리는지 확인:
  ```powershell
  Resolve-DnsName s3.mycorp.local
  curl.exe -I https://s3.mycorp.local
  ```
- **SSL/인증서 오류** (`SSLCertVerificationError`, `CERTIFICATE_VERIFY_FAILED`) →
  사내 endpoint가 **사내 CA 인증서**를 쓰는 경우로, 사내 S3에서 흔합니다. 담당자에게
  CA 인증서(`.pem`)를 받아 지정하세요:
  ```powershell
  $env:AWS_CA_BUNDLE="C:\certs\corp-ca.pem"
  ```
  backend·worker·producer 터미널 **모두**에 필요합니다. 상시로 쓰려면 시스템 환경
  변수로 등록하는 편이 낫습니다. (검증을 끄는 방법은 쓰지 마세요.)
- `InvalidAccessKeyId` / `SignatureDoesNotMatch` → access key/secret 오타, 또는
  key가 비활성/삭제됨
- `AuthorizationHeaderMalformed`, `PermanentRedirect` → 스토리지가 특정 region을
  요구합니다. 담당자에게 받은 region 값으로 `S3_REGION`을 맞추세요
- `NoSuchBucket`인데 버킷 이름은 확실히 맞다 → `S3_FORCE_PATH_STYLE`이 `true`인지
  확인. 사내 도메인 endpoint에서 `false`면 버킷 이름을 host에 붙이려다 실패합니다
- `AccessDenied` → 발급받은 key에 해당 버킷/prefix 권한이 없습니다. 담당자에게
  읽기(worker) 또는 읽기+쓰기(producer) 권한을 요청하세요

> **프록시 주의** — 사내 endpoint는 인터넷이 아니라 **사내망 안**에 있습니다. PC에
> `HTTPS_PROXY`가 걸려 있으면 사내 S3 요청까지 프록시로 나가면서 실패할 수 있습니다.
> 프록시를 쓰는 환경이라면 사내 도메인을 예외로 빼주세요:
> ```powershell
> $env:NO_PROXY="localhost,127.0.0.1,.mycorp.local"
> ```

---

# PHASE 5. backend 기동 (터미널 A, venv)

`feed-prototype/backend`에서:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- **`--host 0.0.0.0`이 핵심입니다.** 이게 없으면 uvicorn은 `127.0.0.1`에만 바인딩해
  서빙 PC 바깥에서 접속할 수 없습니다.
- `--reload`는 뺍니다. 개발용 파일 감시 기능이고, 서빙 중 코드 파일이 건드려질 때
  프로세스가 재시작되는 것을 피하기 위함입니다.

확인 — 다른 PC의 브라우저에서:

```
http://10.10.20.30:8000/docs
```

FastAPI 문서 화면이 보이면 backend는 사내망에 열린 것입니다.

---

# PHASE 6. frontend 기동 (터미널 B)

### 6-1. `feed-prototype/.env` 작성

```ini
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://10.10.20.30:8000
```

`localhost`가 아니라 **서빙 PC IP**여야 합니다. 이 주소는 접속자 PC의 브라우저가
호출하는 대상이므로, `localhost`로 두면 접속자가 자기 PC의 8000번을 찾아갑니다.

> Vite 환경변수는 dev server 시작 시점에 읽힙니다. 값을 바꾸면 **dev server를
> 재시작**해야 반영됩니다.

### 6-2. 기동

최초 1회:

```powershell
npm install
```

이후:

```powershell
npm run dev:lan
```

`dev:lan`은 `vite --host 0.0.0.0`이며, 사내망 서빙 전용 스크립트입니다.
개인 PC에서 쓰던 `npm run dev`는 localhost에만 바인딩하므로 여기서는 쓰지 않습니다.

### 6-3. 접속

사내망의 아무 PC에서:

```
http://10.10.20.30:5173
```

> ### ⚠️ 서빙 PC 본인도 `localhost:5173`으로 열지 마세요
>
> 세션 쿠키가 `SameSite=Lax`라, 브라우저는 화면의 origin과 API의 origin이 **같은
> 사이트**일 때만 쿠키를 되돌려 보냅니다. `http://localhost:5173` 화면에서
> `http://10.10.20.30:8000` API를 부르면 `localhost`와 IP는 서로 다른 사이트로
> 취급되어 **쿠키가 버려지고, 로그인하자마자 다시 로그인 화면으로 튕깁니다.**
>
> 서빙 PC에서 확인할 때도 반드시 **IP 주소로** 접속하세요. (`CORS_ALLOW_ORIGINS`에
> `localhost`를 추가해도 이 문제는 해결되지 않습니다. 쿠키 규칙은 CORS와 별개입니다.)

> **IP 대신 호스트 이름으로 접속하고 싶다면** (예: 사내 DNS에 `feed.mycorp.local`이
> 등록된 경우) Vite가 기본적으로 IP 주소만 허용하므로 `vite.config.ts`에
> `server.allowedHosts: ["feed.mycorp.local"]`을 추가하고, `CORS_ALLOW_ORIGINS`,
> `ASSET_PROXY_BASE_URL`, `VITE_API_BASE_URL`도 모두 그 이름 기준으로 바꿔야 합니다.

---

# PHASE 7. 배치 폴더 만들기

로컬 가이드와 **완전히 동일**합니다.

```
my_batch_001/
├─ feed_posts.json
└─ assets/
   ├─ photo1.png
   └─ data1.csv
```

핵심 규칙 (어기면 업로드를 거부합니다):

- `batch.external_id` == 폴더 이름
- asset url은 배치 상대경로(`assets/파일명`)만 — 절대경로 / `..` / `http://` / `s3://` 금지
- `type`은 `image | plot | table | file | link` 중 하나
- manifest가 참조하는 파일이 `assets/`에 실제로 존재

---

# PHASE 8. 사내 S3에 업로드 (producer)

새 터미널 C(venv), `feed-prototype/backend`에서 실행합니다.

> producer CLI는 `.env`가 아니라 **셸 환경변수**를 읽습니다. 새 터미널을 열 때마다
> 다시 설정해야 합니다.

### 8-1. 환경변수 스크립트 준비 (최초 1회)

`feed-prototype/backend/set-company-s3-env.ps1` 파일을 만들고:

```powershell
$env:S3_ENDPOINT_URL="https://s3.mycorp.local"
$env:S3_ACCESS_KEY_ID="<access key id>"
$env:S3_SECRET_ACCESS_KEY="<secret access key>"
$env:S3_REGION="us-east-1"
$env:S3_BUCKET="<버킷 이름>"
$env:S3_ROOT_PREFIX="estagram"
$env:S3_FORCE_PATH_STYLE="true"
```

`backend/.env`의 `S3_*`와 **똑같이** 맞춥니다. 특히 `S3_BUCKET`과 `S3_ROOT_PREFIX`가
어긋나면 업로드는 성공하는데 worker가 못 찾습니다. 이 파일도 gitignore 되어 있으니
커밋되지 않습니다.

터미널마다 한 번씩:

```powershell
. ./set-company-s3-env.ps1
```

> 키를 스크립트 파일에 두는 게 꺼려진다면, `~/.aws/credentials`에 profile로 저장해
> 두고 키 두 줄을 뺀 뒤 업로드 명령에 `--profile <프로파일명>`을 붙여도 됩니다
> (endpoint/bucket 등 나머지 환경변수는 그대로 필요합니다).

### 8-2. dry-run으로 manifest 검증

네트워크를 타지 않고 계획만 출력합니다.

```powershell
python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001 --dry-run
```

### 8-3. 실제 업로드

```powershell
python -m scripts.upload_post_batch --batch-dir C:\path\to\my_batch_001
```

`upload complete`가 나오면 성공입니다. 업로드는 **asset → manifest → `_READY.json`**
순서로 이뤄지고, `_READY.json`이 마지막에 올라가므로 절반만 올라간 배치가 worker에
발견되는 일은 없습니다.

> **업로드는 서빙 PC에서 할 필요가 없습니다.** 사내 S3에 접근 가능한 PC라면 어디서든
> 올릴 수 있고, 서빙 PC의 worker가 알아서 감지합니다. 배치를 만드는 사람의 PC에
> 이 스크립트와 환경변수만 있으면 됩니다.

> 이미 올린 배치 id를 다시 올리려면 `--overwrite`가 필요하지만, backend는 이미
> `completed`된 배치를 자동 재처리하지 않습니다. 내용이 바뀌었다면 `my_batch_001_v2`
> 처럼 **새 id**를 쓰는 것이 안전합니다.

---

# PHASE 9. watch worker 기동 (터미널 D, venv)

`feed-prototype/backend`에서:

```powershell
python -m app.services.process_s3_incoming --watch --interval 30
```

로그에 아래가 보이면 import 성공입니다:

```
s3_watch poll discovered=1 completed=1 failed=0 skipped=0
```

- 이미 처리한 배치는 매 poll마다 다시 발견되지만 `skipped`로 넘어갑니다(정상).
  처리 상태는 S3가 아니라 PostgreSQL이 기준이며, worker는 S3 객체를 절대 수정/삭제
  하지 않습니다.
- 사내 S3는 로컬 MinIO보다 응답이 느릴 수 있어 `--interval`은 10초보다 **30초 정도**를
  권장합니다.
- 테스트 팁: worker(PHASE 9)를 업로드(PHASE 8)보다 **먼저** 띄워 두면 watch 모드가
  실제로 감지하는지 확인하기 좋습니다.

마지막으로 사내망 다른 PC에서 `http://<서빙PC IP>:5173`에 접속해 로그인하고, 방금
올린 배치의 post와 이미지가 보이면 전체 흐름이 완성된 것입니다.

---

# 최종 상태 요약

서빙 PC에서 상시 떠 있어야 하는 것:

| 터미널 | 위치 | 명령 |
| --- | --- | --- |
| A | `feed-prototype/backend` | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| B | `feed-prototype` | `npm run dev:lan` |
| D | `feed-prototype/backend` | `python -m app.services.process_s3_incoming --watch --interval 30` |

터미널 C(업로드)는 배치를 올릴 때만 쓰며, 서빙 PC가 아니어도 됩니다.

사내망 사용자 접속 주소: **`http://<서빙PC IP>:5173`**

---

# 트러블슈팅

### 로그인은 되는데 바로 로그인 화면으로 돌아온다
접속 주소와 `VITE_API_BASE_URL`의 host가 다릅니다. `localhost:5173`으로 열었거나,
`VITE_API_BASE_URL`이 아직 `localhost:8000`입니다. **둘 다 서빙 PC IP**로 맞추고
dev server를 재시작하세요. (PHASE 6-3의 경고 참고)

### 브라우저 콘솔에 CORS 에러가 뜬다
`CORS_ALLOW_ORIGINS`에 지금 접속 중인 origin이 정확히 들어있는지 확인합니다.
scheme/host/port가 **문자 단위로** 일치해야 합니다 — `http://10.10.20.30:5173`과
`http://10.10.20.30:5173/`(뒤 슬래시), `https://...`는 서로 다릅니다.
`.env` 변경 후 **backend 재시작**이 필요합니다.

### 화면은 뜨는데 이미지/파일만 전부 깨진다
`ASSET_PROXY_BASE_URL`이 `127.0.0.1`이나 `localhost`로 남아 있습니다. 서빙 PC IP로
바꾸고 backend를 재시작하세요. 깨진 이미지를 우클릭해 주소를 보면 어떤 host를
가리키는지 바로 확인됩니다.

### 다른 PC에서 아예 접속이 안 된다
1. 서빙 PC에서 `http://127.0.0.1:5173`은 되는가? → 안 되면 프로세스 문제
2. `--host 0.0.0.0` / `dev:lan`으로 띄웠는가?
3. 방화벽 규칙(PHASE 1-2)이 들어가 있는가?
4. 두 PC가 같은 사내망 세그먼트인가? (`ping <서빙PC IP>`)

### worker가 `discovered=0`만 반복한다
업로드에 쓴 `S3_BUCKET` / `S3_ROOT_PREFIX`가 `backend/.env`의 값과 다릅니다.
producer 셸 환경변수와 backend `.env`를 나란히 놓고 비교하세요. worker는
`<root_prefix>/batches/<batch_id>/_READY.json`만 찾습니다.

### SSL / 인증서 오류가 뜬다
사내 endpoint가 사내 CA 인증서를 쓰는 경우입니다(사내 S3에서 흔합니다). 담당자에게
`.pem`을 받아 `AWS_CA_BUNDLE`을 지정하세요 — PHASE 4에 상세가 있습니다. backend,
worker, producer **세 터미널 모두**에 필요하다는 점을 놓치기 쉽습니다.

### `EndpointConnectionError`가 뜬다
`S3_ENDPOINT_URL`에 로컬 MinIO 값(`http://localhost:9000`)이 남아 있거나 endpoint
주소에 오타가 있습니다. 주소가 맞다면 DNS/VPN으로 사내 도메인에 닿지 못하거나,
`HTTPS_PROXY`가 걸려 사내 요청까지 프록시로 나가는 상황일 수 있습니다(PHASE 4 참고).

### 버킷 이름이 확실한데 `NoSuchBucket`이 뜬다
`S3_FORCE_PATH_STYLE`이 `true`인지 확인하세요. 사내 도메인 endpoint에서 `false`면
버킷 이름을 host 앞에 붙이려다(`https://<버킷>.s3.mycorp.local`) 실패합니다.
`backend/.env`와 producer 환경변수 **양쪽 모두** 확인해야 합니다.

---

# 운영 팁

**서빙 PC 재부팅 시 자동으로 복구되는 것**

- PostgreSQL (`feed_ops` DB, 스키마, seed, import된 post) — 서비스로 자동 시작
- 사내 S3의 배치 객체 (애초에 서빙 PC와 무관)
- 방화벽 규칙

**수동으로 다시 해야 하는 것**

- 프로세스 3개 재기동 (backend, frontend, worker)
- producer 터미널의 환경변수 (`. ./set-company-s3-env.ps1`)

**보안 주의**

- 이 구성은 평문 HTTP이며 사내망 전용입니다. 외부에 노출하지 마세요.
- `backend/.env`와 `set-company-s3-env.ps1`에는 DB 비밀번호와 S3 secret key가
  들어갑니다. 둘 다 gitignore 되어 있으니 **커밋되지 않았는지 항상 확인**하세요.
- S3 access key는 가능하면 해당 버킷/prefix에 대한 **읽기 + 쓰기 최소 권한**으로
  발급받으세요. 서빙 PC의 worker는 읽기만 하고, 업로드하는 쪽만 쓰기가 필요합니다.

---

# 관련 문서

- `QUICK_RUN_GUIDE_LOCAL.md` — 개인 로컬 PC(MinIO) 실행 가이드
- `S3_INGESTION_ARCHITECTURE.md` — S3 ingestion 전체 아키텍처
- `S3_VERIFICATION_RUNBOOK.md` — DB 초기화부터의 통합 검증 runbook
- `EXTERNAL_POST_PACKAGE_GUIDE.md` — 배치 manifest(`feed_posts.json`) 작성 규격
