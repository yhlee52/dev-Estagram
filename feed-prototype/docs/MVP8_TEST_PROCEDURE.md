# MVP8 실행 및 테스트 절차

이 문서는 `feed-prototype`에서 MVP8 Personal Post Create/Delete 기능을 실행하고 확인하기 위한 절차입니다.

## 1. MVP8 목표 요약

MVP8의 목표는 API mode에서 active API user가 새 `Post`를 작성하고, 본인이 작성한 `Post`를 삭제할 수 있게 하는 것입니다.

MVP8에서 확인할 흐름:

```text
1. API mode에서 active API user 선택 또는 등록
2. active API user의 1:1 Account 확인
3. New Post 화면에서 title/text 입력
4. POST /api/posts로 backend PostgreSQL posts table에 Post 생성
5. 생성된 Post를 Home Feed, Account Profile, Post Detail에서 확인
6. 본인이 작성한 Post에서 delete button 확인
7. DELETE /api/posts/{post_id}?user_id=...로 Post 삭제
8. 삭제 후 Feed/Profile/Post Detail이 안전하게 갱신되거나 이동
9. mock mode 기존 동작 유지 확인
```

MVP8은 정식 로그인, 인증, 세션, JWT, OAuth, 권한 시스템이 아닙니다. API mode의 active user는 localStorage에 저장된 prototype user selection입니다. 삭제 ownership check는 selected user의 1:1 Account와 target Post의 `account_id`를 비교하는 MVP용 확인입니다.

## 2. 전제 조건

다음이 준비되어 있어야 합니다.

```text
PostgreSQL 실행
feed_prototype database 생성
feed-prototype/backend/.env 준비
backend migration 적용
backend seed data 삽입
FastAPI backend 실행
Vite frontend 실행
MVP7.5까지 정상 동작
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

`/docs`에서 다음 MVP8 endpoint가 보여야 합니다.

```text
POST /api/posts
DELETE /api/posts/{post_id}
```

기존 endpoint도 계속 보여야 합니다.

```text
GET /api/users
POST /api/users
GET /api/accounts
GET /api/posts
GET /api/feed?user_id=...
GET /api/users/{user_id}/follows
POST /api/users/{user_id}/follows/{account_id}
DELETE /api/users/{user_id}/follows/{account_id}
```

## 4. Backend API 테스트

먼저 실제 `user_id`를 확인합니다.

```powershell
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
```

이 프로젝트의 seed/user id는 숫자가 아니라 `demo-user-ari` 같은 문자열일 수 있습니다. 아래 curl의 `user_id`는 예시입니다. 실제 테스트에서는 `/api/users`와 `/api/accounts` 응답을 보고 존재하는 user id를 사용합니다.

POST /api/posts 예시:

```powershell
curl -X POST http://127.0.0.1:8000/api/posts `
  -H "Content-Type: application/json" `
  -d "{\"user_id\":\"demo-user-ari\",\"title\":\"MVP8 test post\",\"text\":\"Created from curl\",\"metadata_json\":{\"source\":\"mvp8\"}}"
```

요청 body 형식 예시:

```json
{
  "user_id": "demo-user-ari",
  "title": "MVP8 test post",
  "text": "Created from curl",
  "metadata_json": {
    "source": "mvp8"
  }
}
```

확인할 것:

```text
status가 201입니다.
response에 post, account, assets가 있습니다.
post.account_id가 response.account.id와 같습니다.
assets는 MVP8에서 빈 list일 수 있습니다.
metadata_json.source가 mvp8로 저장됩니다.
```

posts 확인:

```powershell
curl http://127.0.0.1:8000/api/posts
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

Home Feed는 follow 기반입니다. active user가 자기 account를 follow하지 않으면 방금 작성한 post가 feed에 바로 보이지 않을 수 있습니다. 이 경우 `/api/posts`, Account Profile, Post Detail에서 먼저 확인합니다.

삭제 전 `post_id`를 확인합니다.

```powershell
curl http://127.0.0.1:8000/api/posts
```

삭제 예시:

```powershell
curl -X DELETE "http://127.0.0.1:8000/api/posts/POST_ID?user_id=demo-user-ari"
```

확인할 것:

```text
본인 post이면 204 No Content가 반환됩니다.
삭제 후 GET /api/posts에서 해당 post가 사라집니다.
삭제 후 GET /api/posts/{post_id}는 404를 반환합니다.
```

다른 user의 post 삭제 시도:

```powershell
curl -X DELETE "http://127.0.0.1:8000/api/posts/POST_ID?user_id=OTHER_USER_ID"
```

확인할 것:

```text
post.account_id가 OTHER_USER_ID의 1:1 account가 아니면 403을 반환합니다.
```

## 5. Frontend API mode 테스트

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

브라우저 접속:

```text
http://localhost:5173/
```

확인 절차:

```text
1. API User Entry 화면이 보이는지 확인합니다.
2. 기존 backend user를 id 또는 handle로 선택합니다.
3. 또는 MVP7.5 registration flow로 신규 API user를 등록합니다.
4. Home Feed 상단의 New Post 버튼을 확인합니다.
5. New Post 버튼을 눌러 /posts/new로 이동합니다.
6. title을 입력합니다.
7. text를 입력합니다. text는 MVP8에서 빈 문자열도 허용됩니다.
8. Publish Post 버튼을 누릅니다.
9. submit 중 버튼이 disabled되고 Publishing...이 표시되는지 확인합니다.
10. 작성 성공 후 생성된 Post Detail로 이동하는지 확인합니다.
11. Post Detail에서 title/text/metadata가 표시되는지 확인합니다.
12. Account 버튼으로 Account Profile에 이동합니다.
13. Account Profile의 Posts 목록에 작성 post가 보이는지 확인합니다.
14. Home Feed로 이동합니다.
15. feed 정책상 작성 post가 보이는지 확인합니다.
```

Home Feed 확인 주의:

```text
Home Feed는 follow 관계를 기준으로 표시됩니다.
active user가 자기 account를 follow하지 않으면 작성 post가 Home Feed에 안 보일 수 있습니다.
이 경우 Account Profile 또는 Post Detail에서 먼저 확인합니다.
```

삭제 확인:

```text
1. 본인이 작성한 Post Detail로 이동합니다.
2. Delete button이 보이는지 확인합니다.
3. Delete button을 누릅니다.
4. confirm이 표시되는지 확인합니다.
5. confirm을 승인합니다.
6. 삭제 중 버튼이 disabled되고 Deleting...이 표시되는지 확인합니다.
7. 삭제 성공 후 Account Profile로 이동하는지 확인합니다.
8. Account Profile Posts 목록에서 삭제된 post가 사라졌는지 확인합니다.
9. 삭제된 post URL로 직접 접근하면 404/Not found 상태가 안전하게 표시되는지 확인합니다.
```

## 6. Ownership 테스트

UI 확인:

```text
본인이 작성한 post에는 Delete button이 보입니다.
다른 account가 작성한 post에는 Delete button이 보이지 않아야 합니다.
```

직접 API 호출 확인:

```powershell
curl -X DELETE "http://127.0.0.1:8000/api/posts/POST_ID?user_id=OTHER_USER_ID"
```

확인할 것:

```text
POST_ID가 OTHER_USER_ID의 1:1 account가 작성한 post가 아니면 403이 반환됩니다.
frontend에서는 403이 발생할 경우 ownership error message가 표시됩니다.
```

MVP8 ownership check는 정식 권한 시스템이 아닙니다. 요청의 `user_id`로 user를 찾고, 그 user의 1:1 account id와 post.account_id를 비교합니다.

## 7. Validation/Error 테스트

빈 title:

```text
1. /posts/new로 이동합니다.
2. title을 비워 둡니다.
3. Publish Post를 누릅니다.
4. Title is required. error가 표시되는지 확인합니다.
```

빈 text:

```text
1. title만 입력합니다.
2. text를 비워 둡니다.
3. Publish Post를 누릅니다.
4. MVP8에서는 text 빈 문자열이 허용되는지 확인합니다.
```

너무 긴 title/text:

```text
title input은 200자까지 입력 가능합니다.
text textarea는 5000자까지 입력 가능합니다.
브라우저에서 더 긴 입력이 제한되는지 확인합니다.
backend validation error가 발생하면 frontend에 backend message가 표시되는지 확인합니다.
```

backend off 상태에서 작성:

```text
1. backend server를 종료합니다.
2. /posts/new에서 post 작성을 시도합니다.
3. backend API에 연결할 수 없다는 error가 표시되는지 확인합니다.
```

backend off 상태에서 삭제:

```text
1. backend server를 다시 켜고 본인 post detail로 이동합니다.
2. backend server를 종료합니다.
3. Delete를 시도합니다.
4. network/backend off error가 표시되는지 확인합니다.
```

user_id 없음 또는 user 없음:

```powershell
curl -X POST http://127.0.0.1:8000/api/posts `
  -H "Content-Type: application/json" `
  -d "{\"user_id\":\"missing-user\",\"title\":\"Missing user\",\"text\":\"test\"}"
```

확인할 것:

```text
404 User not found가 반환됩니다.
```

account 없음:

```text
MVP 단계에서 User와 Account는 1:1이어야 합니다.
DB를 수동으로 조작해 account 없는 user를 만든 경우 POST /api/posts는 account not found error를 반환해야 합니다.
일반 seed/registration flow에서는 이 상태가 발생하지 않아야 합니다.
```

이미 삭제된 post 접근:

```text
1. post를 삭제합니다.
2. 삭제된 /posts/{post_id} URL에 직접 접근합니다.
3. Post not found 또는 backend 404 안내가 안전하게 표시되는지 확인합니다.
```

## 8. Mock mode 회귀 테스트

`feed-prototype/.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

Vite env를 바꾼 뒤 frontend dev server를 재시작합니다.

```powershell
npm run dev
```

확인 절차:

```text
1. backend server를 꺼도 mock mode가 동작하는지 확인합니다.
2. 기존 Local User Entry 화면이 보이는지 확인합니다.
3. 기존 local user id 또는 handle로 진입 가능한지 확인합니다.
4. 없는 local handle 입력 시 local registration 안내가 표시되는지 확인합니다.
5. local registration 후 localStorage에 user/account/follow state가 저장되는지 확인합니다.
6. mock Home Feed가 기존 mock JSON 기반으로 표시되는지 확인합니다.
7. mock Accounts 화면이 표시되는지 확인합니다.
8. mock follow/unfollow가 localStorage 기반으로 동작하는지 확인합니다.
9. mock Account Profile이 표시되는지 확인합니다.
10. mock Post Detail이 표시되는지 확인합니다.
11. mock mode에서 New Post 버튼이 표시되지 않는지 확인합니다.
12. /posts/new에 직접 접근해도 API mode only 안내가 표시되는지 확인합니다.
```

MVP8은 mock mode post create/delete를 구현하지 않습니다. mock mode의 기존 local/static prototype behavior를 유지하는 것이 목표입니다.

## 9. Build와 Git 확인

mock/default build:

```powershell
npm run build
```

api mode build:

```powershell
$env:VITE_DATA_SOURCE='api'
npm run build
```

Git 상태 확인:

```powershell
git status
git diff
```

확인할 것:

```text
.env 파일이 Git에 잡히지 않아야 합니다.
실제 DB dump가 없어야 합니다.
node_modules가 없어야 합니다.
dist가 commit 대상이 아니어야 합니다.
기존 src/data/*.json mock JSON이 삭제되지 않아야 합니다.
backend upload 실제 파일이나 S3 관련 파일이 추가되지 않아야 합니다.
```

## 10. 자주 발생하는 문제

### post 작성 후 Home Feed에 안 보임

Home Feed는 follow 기반입니다. active user가 자기 account를 follow하지 않으면 방금 작성한 post가 Home Feed에 안 보일 수 있습니다.

확인:

```text
1. 작성 성공 후 이동한 Post Detail에서 post를 확인합니다.
2. Account 버튼으로 Account Profile에 이동해 Posts 목록을 확인합니다.
3. 필요하면 active user가 해당 account를 follow한 상태인지 확인합니다.
```

MVP8은 Home Feed에 내 post를 항상 포함하도록 feed 정책을 바꾸지 않습니다. 이 정책 변경은 MVP9 후보로 남길 수 있습니다.

### 새 user의 feed가 비어 있음

정상일 수 있습니다. 새 API user는 아직 follow한 account가 없기 때문에 Home Feed가 비어 있을 수 있습니다.

확인:

```text
Accounts 화면에서 account를 follow합니다.
또는 New Post를 작성한 뒤 Account Profile에서 확인합니다.
```

### 삭제 후 Post Detail에 남아 있음

정상 flow에서는 삭제 성공 후 Account Profile로 이동해야 합니다.

직접 URL을 다시 열면 backend가 404를 반환하고 frontend가 not found 안내를 표시해야 합니다.

### 403 ownership error

삭제 요청의 `user_id`가 post를 작성한 account의 user가 아닐 때 발생합니다.

확인:

```text
POST_ID가 누구의 account에서 작성된 것인지 확인합니다.
DELETE 요청의 user_id가 그 account의 user_id인지 확인합니다.
frontend에서는 다른 account의 post에 Delete button이 없어야 합니다.
```

### backend off/network error

API mode는 backend가 필요합니다.

확인:

```text
backend server가 실행 중인지 확인합니다.
VITE_API_BASE_URL이 http://127.0.0.1:8000인지 확인합니다.
http://127.0.0.1:8000/health가 열리는지 확인합니다.
```

### Vite env 변경 후 재시작 안 함

`.env`의 `VITE_DATA_SOURCE` 또는 `VITE_API_BASE_URL`을 바꾼 뒤에는 Vite dev server를 재시작해야 합니다.

### CORS error

FastAPI CORS 설정에 frontend origin이 포함되어야 합니다.

기본 확인 origin:

```text
http://localhost:5173
http://127.0.0.1:5173
```

### mock/API mode 혼동

API mode:

```text
VITE_DATA_SOURCE=api
backend PostgreSQL users/accounts/posts/follows 사용
active API user localStorage key 사용
feed-prototype:active-api-user-id
feed-prototype:active-api-user-handle
```

mock mode:

```text
VITE_DATA_SOURCE=mock
frontend src/data/*.json + localStorage overlay 사용
local-feed-active-user-id
local-feed-local-users
local-feed-local-accounts
local-feed-following-by-user
```

## 11. MVP8 성공 기준

다음이 모두 만족되면 MVP8 확인이 완료된 것으로 봅니다.

```text
1. API mode에서 active API user가 post를 작성할 수 있습니다.
2. 작성 post가 backend PostgreSQL posts table에 저장됩니다.
3. 작성 post가 화면에서 확인됩니다.
4. Post Detail 또는 Account Profile에서 작성 post를 확인할 수 있습니다.
5. Home Feed는 follow 정책에 맞게 post를 표시합니다.
6. 본인이 작성한 post에는 Delete button이 표시됩니다.
7. 본인이 작성한 post를 삭제할 수 있습니다.
8. 다른 account가 작성한 post는 삭제할 수 없습니다.
9. 삭제 후 화면이 안전하게 갱신되거나 이동합니다.
10. mock mode 기존 local user entry/local registration/follow/feed/profile/detail이 유지됩니다.
11. mock mode에서 post create/delete가 실수로 동작하지 않습니다.
12. npm run build가 통과합니다.
13. MVP8 non-goals가 추가되지 않았습니다.
```

MVP8 non-goals:

```text
post edit/update
asset upload
file upload
S3
rich text editor
complex metadata editor
draft save
comments
likes
bookmarks
search/tag pages
formal auth/JWT/session/OAuth
permission system
multiple account selection
admin UI
post moderation
mock mode removal
equipment-specific core naming
```
