# 로컬 실행 가이드 (Windows PowerShell)

한 PC에서 PostgreSQL, FastAPI, Vite와 폴더 감시 프로세스를 실행합니다.

## 1. 데이터 폴더와 환경설정

원하는 경로를 정하고 `incoming` 폴더를 만듭니다. 아래는 `C:/feed-data` 예시입니다.

```powershell
New-Item -ItemType Directory -Force C:/feed-data/incoming
Copy-Item feed-prototype/backend/.env.example feed-prototype/backend/.env
Copy-Item feed-prototype/.env.example feed-prototype/.env
```

`feed-prototype/backend/.env`의 값을 실제 로컬 DB에 맞춥니다.

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/feed_dev
EXTERNAL_POSTS_DIR=C:/feed-data
```

`feed-prototype/.env`에는 다음을 넣습니다.

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:8000
```

## 2. DB와 테스트 계정

로컬 PostgreSQL에 `feed_dev` 데이터베이스를 만든 뒤 backend에서 실행합니다.

```powershell
cd feed-prototype/backend
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m app.services.seed
```

Seed 계정은 `ari`, `mika`, `nova`이며 초기 password는 각각 handle과 같습니다.
기존 계정은 seed가 덮어쓰지 않습니다.

## 3. 서버 실행

첫 번째 터미널, backend 디렉터리:

```powershell
python -m uvicorn app.main:app --reload
```

두 번째 터미널, `feed-prototype` 디렉터리:

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite가 표시한 `http://localhost:5173` 주소를 열고 seed 계정으로 로그인합니다.
브라우저에서 `127.0.0.1`로 열어도 로컬 API 주소는 같은 호스트 이름으로 맞춰집니다.
seed 계정 `ari`의 초기 비밀번호는 `ari`입니다.

## 4. 로컬 패키지 가져오기

예제 폴더를 데이터 폴더의 `incoming/`으로 복사합니다.

```powershell
Copy-Item -Recurse ../data/external_posts/examples/managed_copy_sample C:/feed-data/incoming/
```

세 번째 터미널, backend 디렉터리에서 먼저 dry-run을 확인합니다.

```powershell
python -m app.services.process_incoming --dry-run
python -m app.services.process_incoming
```

지속 감시가 필요하면 한 번 처리 명령 대신 아래를 실행합니다.

```powershell
python -m app.services.process_incoming --watch --interval 10
```

성공한 패키지는 `archive/`, 실패한 패키지는 `failed/`로 이동합니다. 상대 경로
자산의 복사본은 `assets/`에 쌓입니다. 데이터 폴더를 바꾸려면 `.env`의
`EXTERNAL_POSTS_DIR`을 바꾸고 감시 프로세스를 다시 시작합니다.

## 5. 확인

앱의 Home/Explore에 새 post가 보이는지, Imports에 batch 이력이 있는지,
상세 화면의 자산이 열리는지 확인합니다. 좋아요와 메시지는 계정 두 개로 로그인해
주고받아 볼 수 있습니다. package JSON 작성법은
[외부 게시글 패키지 가이드](EXTERNAL_POST_PACKAGE_GUIDE.md)를 따릅니다.
