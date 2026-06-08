# MVP7 실행 및 테스트 절차

이 문서는 `feed-prototype`에서 MVP7 API mode follow/unfollow 기능을 실행하고 확인하기 위한 절차입니다.

## 1. MVP7 목표 요약

MVP7의 목표는 API mode에서 active API user가 account를 follow/unfollow할 수 있게 하는 것입니다.

- API mode에서 Accounts/Explore와 Account Profile의 follow/unfollow 버튼이 동작합니다.
- follow/unfollow 결과는 backend PostgreSQL `follows` table에 저장됩니다.
- follow/unfollow 후 Home Feed가 `/api/feed?user_id=...`를 다시 읽어 변경된 follow 관계를 반영합니다.
- mock mode의 기존 localStorage 기반 local user entry, local registration, follow/unfollow 흐름은 유지됩니다.

MVP7은 정식 로그인, 비밀번호, JWT, session, OAuth, 권한 시스템, user/account 생성 API, post 작성/수정/삭제 API, file upload를 추가하지 않습니다.

## 2. 전제 조건

다음이 준비되어 있어야 합니다.

- PostgreSQL 실행
- `feed_prototype` database 생성
- `feed-prototype/backend/.env` 준비
- backend migration 적용
- backend seed data 삽입
- FastAPI backend 실행
- Vite frontend 실행

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

`/docs`에서 다음 MVP7 endpoint가 보여야 합니다.

```text
GET /api/users/{user_id}/follows
POST /api/users/{user_id}/follows/{account_id}
DELETE /api/users/{user_id}/follows/{account_id}
```

## 4. Backend API curl 테스트

새 PowerShell 터미널에서 실행합니다.

```powershell
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/follows
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

MVP7 follow API 확인:

```powershell
curl http://127.0.0.1:8000/api/users/demo-user-ari/follows
curl -X POST http://127.0.0.1:8000/api/users/demo-user-ari/follows/demo-account-nova
curl -X POST http://127.0.0.1:8000/api/users/demo-user-ari/follows/demo-account-nova
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
curl -X DELETE http://127.0.0.1:8000/api/users/demo-user-ari/follows/demo-account-nova
curl -X DELETE http://127.0.0.1:8000/api/users/demo-user-ari/follows/demo-account-nova
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

확인할 것:

- 같은 follow 요청을 두 번 보내도 중복 row가 생기지 않습니다.
- 같은 unfollow 요청을 두 번 보내도 성공 응답이 유지됩니다.
- 없는 user id는 404를 반환합니다.
- 없는 account id는 404를 반환합니다.
- follow 후 feed에 해당 account의 posts가 포함됩니다.
- unfollow 후 feed에서 해당 account의 posts가 빠집니다.

예시 404 확인:

```powershell
curl -X POST http://127.0.0.1:8000/api/users/missing-user/follows/demo-account-nova
curl -X POST http://127.0.0.1:8000/api/users/demo-user-ari/follows/missing-account
```

## 5. Frontend 실행 절차

새 PowerShell 터미널에서 실행합니다.

```powershell
cd C:\...\feed-prototype
npm install
npm run dev
```

브라우저에서 접속합니다.

```text
http://localhost:5173/
```

`.env`의 `VITE_DATA_SOURCE`를 바꾼 뒤에는 Vite dev server를 다시 시작합니다.

## 6. API mode 수동 테스트

`feed-prototype/.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=api
```

확인 절차:

1. frontend dev server를 다시 시작합니다.
2. API User Entry 화면에서 seed user id 또는 handle을 입력합니다.
3. 예: `demo-user-ari` 또는 화면에 표시되는 handle.
4. Home Feed가 backend seed data를 표시하는지 확인합니다.
5. Accounts/Explore로 이동합니다.
6. active API user 자신의 account는 `This is your account`로 disabled 처리되는지 확인합니다.
7. 다른 account의 `Follow` 또는 `Unfollow` 버튼을 누릅니다.
8. 요청 중 버튼이 disabled 되고 `Saving...`으로 표시되는지 확인합니다.
9. 성공 후 버튼 상태가 갱신되는지 확인합니다.
10. Home Feed로 돌아가 follow/unfollow 결과가 feed에 반영되는지 확인합니다.
11. 필요한 경우 `Refresh feed` 버튼을 눌러 다시 확인합니다.
12. Account Profile 화면에서도 같은 follow/unfollow 동작을 확인합니다.

backend를 끈 상태에서 API mode를 새로고침하면 backend 연결 실패 메시지가 보여야 합니다.

## 7. Mock mode 회귀 테스트

`feed-prototype/.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SOURCE=mock
```

확인 절차:

1. frontend dev server를 다시 시작합니다.
2. backend가 꺼져 있어도 mock mode 화면이 동작하는지 확인합니다.
3. 기존 local user id 또는 handle로 진입합니다.
4. 없는 handle을 입력해 local registration flow가 동작하는지 확인합니다.
5. Home Feed가 frontend mock JSON 기반으로 표시되는지 확인합니다.
6. Following / All 탭이 정상 동작하는지 확인합니다.
7. Accounts/Explore에서 follow/unfollow가 동작하는지 확인합니다.
8. 새로고침 후에도 follow 상태가 localStorage에 유지되는지 확인합니다.
9. Account Profile에서도 follow/unfollow가 동작하는지 확인합니다.
10. Post Detail이 정상 표시되는지 확인합니다.

mock mode follow state는 localStorage의 다음 key를 사용합니다.

```text
local-feed-following-by-user
```

API mode active user 선택은 별도 localStorage key를 사용합니다.

```text
feed-prototype:active-api-user-id
feed-prototype:active-api-user-handle
```

두 상태는 서로 섞이면 안 됩니다.

## 8. Build 확인

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

둘 다 TypeScript build와 Vite production build가 통과해야 합니다.

## 9. 범위 위반 체크

MVP7에서 추가된 write 대상은 `follows` table뿐이어야 합니다.

확인할 것:

- frontend mock JSON이 삭제되지 않았습니다.
- mock mode localStorage follow/unfollow가 유지됩니다.
- 신규 API user 생성 기능이 없습니다.
- 신규 API account 생성 기능이 없습니다.
- post 작성/수정/삭제 API가 없습니다.
- auth, JWT, session, OAuth, 권한 시스템이 없습니다.
- file upload 또는 S3 기능이 없습니다.

## 10. 알려진 제한사항

- API user entry는 인증이 아니라 backend DB에 이미 존재하는 user를 선택하는 prototype flow입니다.
- active API user 자신의 account follow는 frontend에서 disabled 처리합니다.
- API mode follow/unfollow는 optimistic update를 하지 않고 API 성공 후 refetch합니다.
- account에 posts가 없으면 follow 후에도 Home Feed에 새 item이 보이지 않을 수 있습니다.
- 실제 브라우저 수동 테스트는 backend와 frontend dev server가 모두 실행 중이어야 합니다.
