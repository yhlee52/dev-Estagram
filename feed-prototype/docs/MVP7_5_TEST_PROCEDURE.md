# MVP7.5 실행 및 테스트 절차

이 문서는 `feed-prototype`에서 MVP7.5 API Local User/Account Registration 기능을 실행하고 확인하기 위한 절차입니다.

## 1. MVP7.5 목표 요약

MVP7.5의 목표는 API mode에서 없는 handle을 입력했을 때 신규 API user 등록을 제안하고, backend DB에 `User`와 1:1 `Account`를 함께 생성하는 것입니다.

MVP7.5에서 확인할 흐름:

```text
1. API User Entry에서 없는 handle 입력
2. 신규 API user registration prompt 표시
3. registration form에서 handle, display_name, bio 입력
4. POST /api/users로 backend DB에 User 생성
5. 같은 transaction에서 1:1 Account 생성
6. 생성된 User를 active API user로 localStorage에 저장
7. Home Feed로 진입
8. 새 user의 empty feed를 정상 상태로 표시
9. Accounts 화면에서 기존 MVP7 follow/unfollow 사용
```

MVP7.5는 정식 회원가입, 로그인, 인증, 세션, 권한 시스템이 아닙니다. 비밀번호, email, JWT, session cookie, OAuth, 권한 체크는 사용하지 않습니다.

기존 mock mode local registration은 그대로 유지되어야 합니다.

## 2. 전제 조건

다음이 준비되어 있어야 합니다.

```text
PostgreSQL 실행
feed_prototype database 생성
backend .env 준비
backend migration 적용
backend seed data 삽입
FastAPI backend 실행
Vite frontend 실행
MVP7 follow/unfollow가 동작하는 상태
```

backend `.env` 예시:

```text
APP_NAME=feed-prototype-backend
APP_ENV=local
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

frontend `.env` API mode 예시:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=api
```

frontend `.env` mock mode 예시:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

`.env` 파일은 Git에 commit하지 않습니다.

## 3. Backend 실행 절차

Windows + conda 기준:

```powershell
cd C:\...\feed-prototype
conda activate feed-backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.services.seed
python -m uvicorn app.main:app --reload
```

backend 확인 URL:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/docs
```

`/docs`에서 다음 endpoint가 보여야 합니다.

```text
GET /api/users
POST /api/users
GET /api/users/{user_id}
GET /api/users/{user_id}/follows
POST /api/users/{user_id}/follows/{account_id}
DELETE /api/users/{user_id}/follows/{account_id}
```

## 4. Backend POST /api/users 테스트

새 PowerShell 터미널에서 실행합니다.

정상 생성:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\"new_user\",\"display_name\":\"New User\",\"bio\":\"Created from MVP7.5 test\"}"
```

확인할 것:

```text
status가 201입니다.
response에 user와 account가 함께 있습니다.
user.handle이 new_user입니다.
account.handle이 new_user입니다.
account.user_id가 생성된 user.id입니다.
account.kind가 person입니다.
```

생성된 user/account 목록 확인:

```powershell
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
```

중복 handle 테스트:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\"new_user\",\"display_name\":\"New User\"}"
```

확인할 것:

```text
status가 409 Conflict입니다.
중복 user/account row가 추가로 생기지 않습니다.
frontend에서 표시 가능한 detail message가 반환됩니다.
```

handle normalization 테스트:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\" New_User_2 \",\"display_name\":\"New User 2\"}"
```

확인할 것:

```text
user.handle과 account.handle이 new_user_2로 저장됩니다.
```

## 5. Backend validation/error 테스트

빈 handle:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\"   \",\"display_name\":\"Blank Handle\"}"
```

너무 짧은 handle:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\"ab\",\"display_name\":\"Short Handle\"}"
```

너무 긴 handle:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"display_name\":\"Long Handle\"}"
```

허용되지 않은 문자:

```powershell
curl -X POST http://127.0.0.1:8000/api/users `
  -H "Content-Type: application/json" `
  -d "{\"handle\":\"bad.handle\",\"display_name\":\"Bad Handle\"}"
```

확인할 것:

```text
빈 handle은 400을 반환합니다.
잘못된 handle 형식은 400을 반환합니다.
3~32자, 영문 소문자, 숫자, underscore, hyphen 규칙이 적용됩니다.
display_name이 비어 있으면 backend가 handle을 기본 display_name으로 사용할 수 있습니다.
bio는 optional입니다.
```

## 6. Frontend API mode 테스트

`feed-prototype/.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=api
```

frontend 실행:

```powershell
cd C:\...\feed-prototype
npm install
npm run dev
```

브라우저에서 접속:

```text
http://localhost:5173/
```

확인 절차:

```text
1. API User Entry 화면이 보이는지 확인합니다.
2. 없는 handle을 입력합니다. 예: mvp75_user
3. "User not found" prompt가 표시되는지 확인합니다.
4. Register user 버튼을 누릅니다.
5. registration form이 보이는지 확인합니다.
6. handle 기본값이 입력한 값의 정규화 결과인지 확인합니다.
7. display_name과 bio를 입력합니다.
8. Register API user 버튼을 누릅니다.
9. 생성 중 버튼이 disabled되고 Registering...이 표시되는지 확인합니다.
10. 생성 성공 후 active API user로 저장되는지 확인합니다.
11. Home Feed로 진입하는지 확인합니다.
12. 새 user가 follow한 account가 없으면 empty feed가 표시되는지 확인합니다.
13. Browse Accounts 버튼 또는 bottom nav로 Accounts 화면에 이동합니다.
14. seed account를 follow합니다.
15. Home Feed로 돌아가 feed가 반영되는지 확인합니다.
16. unfollow 후 Home Feed가 다시 비어질 수 있는지 확인합니다.
```

localStorage에서 확인할 key:

```text
feed-prototype:active-api-user-id
feed-prototype:active-api-user-handle
```

mock mode key와 충돌하지 않아야 합니다.

```text
local-feed-active-user-id
local-feed-local-users
local-feed-local-accounts
local-feed-following-by-user
```

## 7. Frontend validation/error 테스트

registration form에서 다음을 확인합니다.

```text
빈 handle은 submit할 수 없거나 error가 표시됩니다.
너무 짧은 handle은 error가 표시됩니다.
너무 긴 handle은 error가 표시됩니다.
허용되지 않은 문자는 error가 표시됩니다.
중복 handle은 backend 409 message가 표시됩니다.
backend가 꺼져 있으면 backend 연결 실패 message가 표시됩니다.
VITE_API_BASE_URL이 잘못되어 있으면 backend 연결 실패 message가 표시됩니다.
```

backend 연결 실패 테스트:

```text
1. backend server를 종료합니다.
2. API mode에서 신규 등록을 시도합니다.
3. registration prompt가 아니라 backend 연결 실패 error가 표시되는지 확인합니다.
```

Vite env 변경 후에는 dev server를 재시작해야 합니다.

## 8. Mock mode 회귀 테스트

`feed-prototype/.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

frontend dev server를 재시작합니다.

확인 절차:

```text
1. backend를 꺼도 mock mode 화면이 동작하는지 확인합니다.
2. 기존 Local User Entry 화면이 보이는지 확인합니다.
3. 기존 local user id 또는 handle로 진입할 수 있는지 확인합니다.
4. 없는 local handle을 입력합니다.
5. 기존 local registration 안내가 표시되는지 확인합니다.
6. Register @handle locally 버튼으로 local registration이 되는지 확인합니다.
7. local user와 account가 localStorage에 생성되는지 확인합니다.
8. Home Feed가 frontend mock JSON 기반으로 표시되는지 확인합니다.
9. Accounts 화면에서 follow/unfollow가 localStorage 기준으로 동작하는지 확인합니다.
10. Account Profile과 Post Detail이 정상 표시되는지 확인합니다.
```

mock mode localStorage key:

```text
local-feed-active-user-id
local-feed-local-users
local-feed-local-accounts
local-feed-following-by-user
```

API registration key와 섞이지 않아야 합니다.

```text
feed-prototype:active-api-user-id
feed-prototype:active-api-user-handle
```

## 9. Build와 Git 확인

mock mode build:

```powershell
$env:VITE_DATA_SOURCE='mock'
npm.cmd run build
```

api mode build:

```powershell
$env:VITE_DATA_SOURCE='api'
npm.cmd run build
```

Git 상태 확인:

```powershell
git status
git diff
```

확인할 것:

```text
dist/는 commit 대상이 아닙니다.
node_modules/는 commit 대상이 아닙니다.
backend .env와 frontend .env는 commit 대상이 아닙니다.
real PostgreSQL database dump나 local upload file은 commit 대상이 아닙니다.
```

## 10. 자주 발생하는 문제

### POST /api/users가 409를 반환함

이미 같은 handle을 가진 user 또는 account가 있습니다.

확인:

```powershell
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
```

다른 handle을 사용하거나 테스트 DB를 초기화합니다.

### POST /api/users가 400을 반환함

handle validation을 통과하지 못한 것입니다.

MVP7.5 handle 규칙:

```text
3~32자
영문 소문자
숫자
underscore _
hyphen -
```

### 생성 후 Home Feed가 비어 있음

정상일 수 있습니다. 새 user는 아직 follow한 account가 없으므로 feed가 비어 있습니다.

Accounts 화면에서 관심 있는 account를 follow한 뒤 Home Feed를 다시 확인합니다.

### 생성 후 follow했는데 feed가 안 바뀜

다음을 확인합니다.

```text
follow 요청이 성공했는지 확인합니다.
follow한 account에 post가 있는지 확인합니다.
Home Feed에서 Refresh feed를 눌러 봅니다.
backend server가 실행 중인지 확인합니다.
```

follow한 account에 post가 없으면 feed에 item이 나타나지 않을 수 있습니다.

### CORS error

FastAPI CORS 설정에 현재 frontend origin이 포함되어야 합니다.

기본 확인 origin:

```text
http://localhost:5173
http://127.0.0.1:5173
```

### backend가 꺼져 있음

API mode registration과 feed는 backend가 필요합니다.

backend 실행:

```powershell
cd C:\...\feed-prototype\backend
python -m uvicorn app.main:app --reload
```

### Vite env 변경 후 재시작 안 함

`.env`의 `VITE_DATA_SOURCE` 또는 `VITE_API_BASE_URL`을 바꾼 뒤에는 Vite dev server를 재시작합니다.

### API registration과 mock registration 혼동

API mode registration:

```text
backend PostgreSQL users/accounts table에 저장
active API user key 사용
feed-prototype:active-api-user-id
feed-prototype:active-api-user-handle
```

mock mode registration:

```text
browser localStorage에 저장
mock local user key 사용
local-feed-active-user-id
local-feed-local-users
local-feed-local-accounts
local-feed-following-by-user
```

### .env가 Git에 잡히는 문제

`.env` 파일은 commit하지 않습니다.

확인:

```powershell
git status
```

필요하면 `.gitignore`에 backend/frontend `.env`가 포함되어 있는지 확인합니다.

## 11. MVP7.5 성공 기준

다음이 모두 만족되면 MVP7.5 확인이 완료된 것으로 봅니다.

```text
1. API mode에서 없는 handle 입력 시 registration prompt가 표시됩니다.
2. registration form에서 신규 API user를 생성할 수 있습니다.
3. backend DB에 User와 1:1 Account가 함께 생성됩니다.
4. 생성된 User가 active API user로 localStorage에 저장됩니다.
5. 생성 후 Home Feed로 진입합니다.
6. 새 user의 empty feed가 정상 안내와 함께 표시됩니다.
7. 새 user로 Accounts 화면에서 follow/unfollow가 가능합니다.
8. follow/unfollow 후 Home Feed가 backend follow state를 반영합니다.
9. mock mode local registration이 기존처럼 동작합니다.
10. mock mode follow/unfollow가 localStorage 기준으로 동작합니다.
11. `npm run build`가 통과합니다.
12. MVP7.5 non-goals가 추가되지 않았습니다.
```

MVP7.5 non-goals:

```text
password
real signup/login
JWT/session/OAuth
authorization or permission system
email verification
user/account edit or delete
post create/update/delete
asset upload
file upload
S3
admin UI
mock mode removal
existing mock local registration removal
```
