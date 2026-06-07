# MVP6 실행 및 테스트 절차

이 문서는 MVP6까지 완료된 `feed-prototype`을 새 PC 또는 새 터미널에서 실행하고, `mock` mode와 `api` mode를 모두 확인하기 위한 절차입니다.

MVP6는 실제 로그인/인증 기능이 아닙니다. API mode의 user entry는 backend DB에 seed된 `User`를 id 또는 handle로 선택하는 로컬 선택 흐름입니다. 비밀번호, JWT, session cookie, OAuth, 권한 체크는 사용하지 않습니다.

## 1. 전제 조건

다음 도구가 준비되어 있어야 합니다.

```text
Node.js / npm
Python 3.11 또는 conda
PostgreSQL
Git
```

개발 중에는 backend와 frontend를 별도 터미널에서 실행합니다.

```text
터미널 1: backend 실행
터미널 2: frontend 실행
```

예상 repo 구조:

```text
feed-prototype/
├─ src/
├─ package.json
├─ .env.example
├─ backend/
│  ├─ app/
│  ├─ alembic/
│  ├─ requirements.txt
│  └─ .env.example
└─ docs/
   └─ MVP6_TEST_PROCEDURE.md
```

## 2. PostgreSQL DB 준비

PostgreSQL이 설치되어 있고 실행 중이어야 합니다.

pgAdmin으로 생성하는 경우:

```text
Servers
→ PostgreSQL 서버 선택
→ Databases 우클릭
→ Create
→ Database
→ Database name: feed_prototype
→ Save
```

`createdb` 명령을 사용할 수 있다면 다음처럼 만들 수 있습니다.

```bash
createdb feed_prototype
```

DB 이름은 이 문서에서 `feed_prototype`을 기준으로 설명합니다.

## 3. Backend 환경 준비

새 터미널을 열고 frontend 앱 루트로 이동합니다.

```bash
cd C:\...\feed-prototype
```

conda 환경이 이미 있다면 활성화합니다.

```bash
conda activate feed-backend
```

conda 환경이 없다면 생성합니다.

```bash
conda create -n feed-backend python=3.11
conda activate feed-backend
```

backend 폴더로 이동하고 패키지를 설치합니다.

```bash
cd backend
pip install -r requirements.txt
```

## 4. Backend `.env` 준비

`feed-prototype/backend` 폴더에서 `.env.example`을 복사합니다.

```bash
copy .env.example .env
```

`.env` 파일의 `DATABASE_URL`을 본인 PostgreSQL 정보에 맞게 수정합니다.

```text
DATABASE_URL=postgresql+psycopg://postgres:비밀번호@localhost:5432/feed_prototype
```

예를 들어 PostgreSQL 비밀번호가 `postgres`라면:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

주의:

```text
backend/.env는 Git에 올리지 않습니다.
feed-prototype/.gitignore에 backend/.env가 제외되어 있어야 합니다.
```

## 5. Migration 실행

`feed-prototype/backend` 폴더에서 실행합니다.

```bash
alembic upgrade head
```

상태 확인:

```bash
alembic current
alembic history
```

정상이라면 현재 migration revision이 표시됩니다.

## 6. Seed data 삽입

`feed-prototype/backend` 폴더에서 실행합니다.

```bash
python -m app.services.seed
```

이 명령은 backend API 확인용 demo data를 DB에 넣습니다. 두 번 실행해도 같은 id의 데이터가 무한히 중복 생성되지 않아야 합니다.

## 7. Backend 실행

터미널 1에서 `feed-prototype/backend` 폴더에 있는 상태로 실행합니다.

```bash
python -m uvicorn app.main:app --reload
```

확인 주소:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/docs
```

브라우저에서 `/health`가 다음과 비슷하게 나오면 backend가 실행 중입니다.

```json
{"status":"ok","service":"feed-prototype-backend"}
```

## 8. Backend API 확인

터미널 1은 backend 실행 상태로 둡니다. 다른 터미널에서 다음을 확인할 수 있습니다.

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
curl http://127.0.0.1:8000/api/follows
curl "http://127.0.0.1:8000/api/feed?user_id=1"
```

seed user id가 `1`이 아닌 경우 `/api/users` 결과에서 실제 user id를 확인한 뒤 사용합니다.

```bash
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

확인할 것:

```text
/api/users에 user 목록이 나온다.
/api/accounts에 account 목록이 나온다.
/api/posts에 post 목록이 나온다.
/api/feed?user_id=...에 user와 items가 나온다.
```

## 9. Frontend 환경 준비

새 터미널 2를 열고 frontend 앱 루트로 이동합니다.

```bash
cd C:\...\feed-prototype
```

패키지를 설치합니다.

```bash
npm install
```

frontend env 예시는 `feed-prototype/.env.example`입니다.

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

실제 실행 설정을 바꾸려면 `feed-prototype/.env` 파일을 만듭니다.

```bash
copy .env.example .env
```

API mode:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=api
```

Mock mode:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

Vite env를 바꾼 뒤에는 frontend dev server를 재시작해야 합니다.

## 10. Frontend 실행

터미널 2에서 `feed-prototype` 폴더에 있는 상태로 실행합니다.

```bash
npm run dev
```

확인 주소:

```text
http://localhost:5173/
```

## 11. API mode 테스트 절차

먼저 backend가 실행 중이어야 합니다.

1. `feed-prototype/.env`를 API mode로 설정합니다.

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=api
```

2. frontend dev server를 재시작합니다.

```bash
npm run dev
```

3. 브라우저에서 접속합니다.

```text
http://localhost:5173/
```

4. API User Entry 화면을 확인합니다.

확인할 것:

```text
Available backend users 목록이 보인다.
각 user의 display name, handle, id가 보인다.
화면 문구가 로그인/인증이 아니라 backend seed user 선택이라고 설명한다.
```

5. seed user의 handle 또는 id를 입력하고 Continue를 누릅니다.

예:

```text
demo-user-ari
```

또는 화면에 보이는 handle을 사용합니다.

6. Home Feed 진입을 확인합니다.

확인할 것:

```text
Data source: API 표시가 보인다.
Read-only 표시가 보인다.
backend seed post가 feed card로 표시된다.
account display name 또는 handle이 보인다.
post title, text, created_at이 보인다.
asset이 있으면 가능한 범위에서 표시된다.
```

7. Accounts / Explore를 확인합니다.

```text
하단 navigation에서 Accounts/Explore로 이동한다.
Data source: API 표시가 보인다.
/api/accounts 기반 account 목록이 보인다.
follow button은 Read-only 또는 disabled 상태여야 한다.
```

8. Account Profile을 확인합니다.

```text
account card를 클릭한다.
profile 정보가 API data로 표시된다.
post 목록이 가능한 범위에서 표시된다.
follow/unfollow는 disabled 상태여야 한다.
```

참고: MVP6 현재 `/api/accounts/{account_id}/posts` 응답에는 assets가 포함되지 않습니다. 이 화면의 post card asset은 없거나 fallback으로 보일 수 있습니다.

9. Post Detail을 확인합니다.

```text
Home Feed 또는 Account Profile에서 post를 클릭한다.
/api/posts/{post_id} 기반 상세 화면이 표시된다.
asset이 포함된 post라면 asset이 표시된다.
metadata가 있으면 metadata 영역이 표시된다.
```

10. 없는 user handle을 입력했을 때 error를 확인합니다.

방법:

```text
API mode에서 Switch user 또는 Logout을 누른다.
존재하지 않는 handle을 입력한다.
Continue를 누른다.
```

기대 결과:

```text
User not found. API mode can only use users already seeded in the backend database.
```

11. backend를 끈 뒤 error state를 확인합니다.

방법:

```text
터미널 1에서 backend 서버를 중지한다.
브라우저에서 API User Entry 또는 API feed 화면을 새로고침한다.
```

기대 결과:

```text
Cannot connect to the backend API at http://127.0.0.1:8000...
```

## 12. Mock mode 테스트 절차

1. `feed-prototype/.env`를 mock mode로 설정합니다.

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

2. frontend dev server를 재시작합니다.

```bash
npm run dev
```

3. 브라우저에서 접속합니다.

```text
http://localhost:5173/
```

4. 기존 MVP4 local user entry 화면을 확인합니다.

확인할 것:

```text
Local User Entry 화면이 보인다.
기존 local user id 또는 handle로 진입할 수 있다.
없는 local user handle을 입력하면 local registration 버튼이 나온다.
```

5. 새 local user registration을 확인합니다.

```text
없는 handle을 입력한다.
Register @... locally 버튼을 누른다.
/me 또는 feed shell로 진입하는지 확인한다.
```

확인할 localStorage key:

```text
local-feed-active-user-id
local-feed-local-users
local-feed-local-accounts
local-feed-following-by-user
```

6. Home Feed를 확인합니다.

```text
Data source: Mock 표시가 보인다.
Following / All 탭이 보인다.
기존 mock JSON post가 표시된다.
```

7. follow/unfollow localStorage 동작을 확인합니다.

```text
Accounts/Explore로 이동한다.
Follow 또는 Following 버튼을 누른다.
Home Feed의 Following 탭으로 돌아온다.
follow 상태에 따라 feed가 바뀌는지 확인한다.
브라우저 새로고침 후에도 상태가 유지되는지 확인한다.
```

8. Account Profile과 Post Detail을 확인합니다.

```text
Accounts/Explore에서 account를 클릭한다.
Account Profile이 mock data로 표시된다.
post를 클릭한다.
Post Detail이 mock data로 표시된다.
```

## 13. Build 확인

frontend 앱 루트에서 실행합니다.

```bash
cd C:\...\feed-prototype
npm run build
```

성공 기준:

```text
TypeScript build가 통과한다.
Vite production build가 통과한다.
dist/가 생성된다.
```

API mode env에서도 build를 확인할 수 있습니다.

PowerShell:

```powershell
$env:VITE_DATA_SOURCE='api'
npm run build
```

## 14. Git 확인

repo 상태를 확인합니다.

```bash
git status
git diff
```

확인할 것:

```text
backend/.env가 Git에 잡히지 않아야 한다.
feed-prototype/.env가 Git에 잡히지 않아야 한다.
실제 PostgreSQL DB 파일이나 dump가 Git에 없어야 한다.
기존 frontend mock JSON이 삭제되지 않았어야 한다.
node_modules와 dist는 Git에 올리지 않는다.
```

## 15. 자주 발생하는 문제와 해결

### conda 명령을 찾을 수 없음

해결:

```text
Anaconda Prompt 또는 Miniconda Prompt를 사용한다.
또는 conda가 PATH에 등록되어 있는지 확인한다.
```

### ModuleNotFoundError: No module named app

원인:

```text
backend 폴더가 아닌 위치에서 python -m app.services.seed 또는 uvicorn을 실행했을 가능성이 높다.
```

해결:

```bash
cd C:\...\feed-prototype\backend
python -m app.services.seed
python -m uvicorn app.main:app --reload
```

### PostgreSQL 연결 실패

자주 보이는 원인:

```text
PostgreSQL 서버가 꺼져 있음
feed_prototype DB가 없음
.env의 DATABASE_URL 비밀번호가 틀림
port가 5432가 아님
DATABASE_URL 문법 오류
```

해결:

```text
pgAdmin 또는 psql로 DB 접속을 먼저 확인한다.
backend/.env의 DATABASE_URL을 다시 확인한다.
```

### alembic 명령을 찾을 수 없음

해결:

```bash
cd C:\...\feed-prototype\backend
pip install -r requirements.txt
alembic upgrade head
```

그래도 안 되면 Python module 방식으로 실행합니다.

```bash
python -m alembic upgrade head
```

### `/api/feed?user_id=1`이 비어 있음

원인:

```text
seed data의 user id가 1이 아닐 수 있다.
해당 user가 follow한 account가 없을 수 있다.
seed가 아직 실행되지 않았을 수 있다.
```

해결:

```bash
curl http://127.0.0.1:8000/api/users
python -m app.services.seed
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

### frontend에서 backend 연결 실패

확인할 것:

```text
backend 터미널이 실행 중인지 확인한다.
http://127.0.0.1:8000/health가 열리는지 확인한다.
feed-prototype/.env의 VITE_API_BASE_URL이 http://127.0.0.1:8000인지 확인한다.
Vite dev server를 재시작한다.
```

### CORS 에러

확인할 것:

```text
frontend는 보통 http://localhost:5173 에서 실행된다.
backend CORS 설정이 해당 origin을 허용해야 한다.
브라우저 콘솔에 CORS 에러가 있으면 backend CORS 설정을 확인한다.
```

MVP6에서는 backend/frontend를 하나의 서버로 합치지 않습니다.

### Vite env 변경 후 반영되지 않음

해결:

```text
VITE_DATA_SOURCE 또는 VITE_API_BASE_URL을 바꾼 뒤 npm run dev를 중지하고 다시 실행한다.
브라우저도 새로고침한다.
```

### mock mode와 api mode가 헷갈리는 경우

확인할 것:

```text
feed-prototype/.env의 VITE_DATA_SOURCE 값을 확인한다.
화면 상단의 Data source: Mock 또는 Data source: API 표시를 확인한다.
mock mode는 Local User Entry를 사용한다.
api mode는 API User Entry를 사용한다.
```

## 16. MVP6 성공 기준

다음이 모두 만족되면 MVP6 실행 확인이 완료된 것으로 봅니다.

```text
backend /health 정상
backend /docs 정상
/api/users 정상
/api/feed?user_id=... 정상
frontend API mode에서 backend DB seed feed 표시
frontend API mode에서 Accounts/Profile/Post Detail이 가능한 범위에서 API data 표시
frontend mock mode도 기존처럼 동작
mock mode local registration 동작
mock mode follow/unfollow localStorage 동작
없는 API user 입력 시 error 표시
backend 꺼짐 상태에서 error 표시
npm run build 통과
```
