# Instagram-like Local Feed Prototype

## MVP6: Frontend API Read Mode with API User Entry

MVP6 connects the `feed-prototype` frontend to the backend read-only API so the app can display a PostgreSQL seed-data-backed feed through FastAPI.

MVP6 adds an API data source mode alongside the existing mock mode. Mock mode remains the default local/static experience from MVP1-MVP4: it keeps using frontend mock JSON, local assets, MVP4 local user entry, local registration, active user localStorage, and local follow overlays. API mode reads backend data through FastAPI endpoints and does not remove or replace the mock mode data flow.

In API mode, user entry is not real login or authentication. The user enters an id or handle for a `User` that already exists in the backend database. If a matching backend user is found, the frontend stores that selection as the active API user in localStorage and calls `GET /api/feed?user_id=...` for that user. If no matching backend user exists, the UI should explain that API mode can only use users already present in the database.

MVP6 does not create users, accounts, posts, follows, or assets. It does not add passwords, JWT, session cookies, OAuth, authorization, write APIs, follow/unfollow APIs, upload APIs, S3, admin UI, comments, likes, bookmarks, search, tags, deployment, or a combined frontend/backend server.

MVP6 completion criteria:

- The frontend can be configured for mock mode or API mode.
- Mock mode continues to work with existing MVP4 local user entry and local registration.
- API mode can find an existing backend user by id or handle.
- API mode stores the selected active API user locally without treating it as an authenticated session.
- API mode calls the FastAPI read-only feed endpoint for the selected user.
- The Home Feed displays backend PostgreSQL seed data through the API.
- Loading, error, and empty states are clear in API mode.
- Accounts, Profile, and Post Detail can be extended read-only without introducing write flows.
- `npm run build` passes from `feed-prototype/`.

Suggested MVP6 implementation order:

1. Add frontend env/data source mode settings.
2. Add a frontend API client.
3. Add API user lookup and API user entry.
4. Add an API feed repository.
5. Connect Home Feed to API mode.
6. Refine API mode loading, error, and empty states.
7. Extend Accounts, Profile, and Post Detail for read-only API mode.
8. Re-check mock mode behavior and document run/test steps.

## MVP5: Backend & DB Skeleton Planning

MVP5 introduces the direction for a future backend and database layer while keeping the current frontend local/static.

Planned backend stack:

```text
Backend: FastAPI
Database: PostgreSQL
ORM / DB layer: SQLModel
Migration: Alembic
File storage: feed-prototype/backend/uploads/ local folder
Backend path: feed-prototype/backend/
```

MVP5 is a skeleton-introduction stage. It should make the project ready to move from static JSON and localStorage toward API/DB-backed data later, but it does not switch the frontend to API data yet.

Planned database tables:

- `users`
- `accounts`
- `posts`
- `post_assets`
- `follows`

During MVP5, `User` and `Account` remain a 1:1 relationship. `User` represents the local viewer/person concept, and `Account` represents the entity that publishes Posts.

Planned read-only API surface:

- `GET /health`
- `GET /api/users`
- `GET /api/accounts`
- `GET /api/posts`
- `GET /api/follows`
- `GET /api/feed?user_id=...`

MVP5 data policy:

- Keep the existing frontend mock JSON files.
- Keep the MVP4 localStorage-based local user entry, local registration, active user, and follow flows.
- Do not convert the frontend to API-backed data in MVP5.
- Add backend seed data separately for PostgreSQL verification when backend work begins.
- Do not commit a real PostgreSQL database. The database should be reproducible from migrations plus seed scripts.

MVP5 does not add real login/authentication, write APIs, admin UI, upload APIs, S3 integration, comments, likes, bookmarks, search, tag pages, or equipment-report-specific core naming.

Backend setup, migration, seed, run, and API smoke-test instructions are documented in `feed-prototype/backend/README.md`.

## MVP4: Local User Entry & Registration Flow

MVP4 adds a local user entry flow so the app can feel like it starts from "my id" without adding a backend, database, or authentication system.

Users can enter a local user id or handle. If it matches an existing effective `User`, that user becomes the active user and the app opens the feed shell. If it does not match, the app offers local registration.

Local registration creates a new `User` and a 1:1 corresponding `Account`. These local records are stored in `localStorage`; the app does not write to `src/data/*.json` at runtime. The new user's follow state is initialized in `localStorage`, and the active user remains stored under `local-feed-active-user-id` after refresh.

The runtime data model for MVP4 should be effective data:

```text
effective users = static users.json + localStorage user overlay
effective accounts = static accounts.json + localStorage account overlay
effective follow state = static follows.json + localStorage follow overlay
```

MVP4 localStorage keys:

```text
active user id = local-feed-active-user-id
local users = local-feed-local-users
local accounts = local-feed-local-accounts
user follow state = local-feed-following-by-user
```

`Logout` and `Switch user` are local prototype actions. They clear the active user id and return to the local user entry screen; they do not end a secure session. If browser localStorage is cleared, locally registered users, accounts, and follow changes can disappear.

MVP4 still does not implement real login, signup, passwords, auth tokens, secure sessions, authorization, backend APIs, databases, JSON file writes, post creation/editing/deletion, comments, likes, bookmarks, search, tag aggregation, or tag pages.

Vite, React, TypeScript로 만든 범용 로컬 feed 프로토타입입니다.

이 프로젝트의 핵심은 `User`, `Account`, `Post`, `Feed`, `Follow`, `Asset`, `Metadata`를 기반으로 한 작은 Instagram-like feed 껍데기입니다. 개인 사진/메모 feed처럼 사용할 수도 있고, 같은 구조 위에 회사 내부의 daily report, 작업 로그, 점검 기록, 분석 결과 같은 리포트형 feed를 얹을 수도 있습니다.

현재 단계에서는 서버, 데이터베이스, 인증, 업로드 없이 정적 JSON 데이터와 로컬 정적 asset만 사용합니다.

## 현재 MVP 기능

- Home Feed에서 follow 중인 Account의 Post를 최신순으로 볼 수 있습니다.
- Accounts / Explore 화면에서 전체 Account 목록을 볼 수 있습니다.
- Account를 follow / unfollow할 수 있습니다.
- Header에서 active user를 선택할 수 있고, 선택된 user는 `localStorage`에 저장됩니다.
- Follow 상태는 active user별로 분리되어 Home Feed, Accounts, Account Profile에 반영됩니다.
- `/me` 화면에서 현재 active user의 정보, 연결된 Account, follow 수, 연결 Account의 Post를 볼 수 있습니다.
- 각 Account는 Profile 페이지를 가집니다.
- 각 Post는 Detail 페이지를 가집니다.
- Post card와 detail에서 title, caption, tags, createdAt, asset, metadata를 표시합니다.
- 이미지형 asset과 텍스트/차트/테이블/JSON 등 확장 가능한 asset 구조를 사용합니다.
- core domain은 특정 회사 내부 리포트 용어가 아니라 범용 feed 모델을 기준으로 유지합니다.

## MVP3 목표: Multi-user Local Feed Base

MVP3의 목표는 실제 로그인 시스템이 아니라, 여러 로컬 User 중 active user를 선택하고 그 User별로 feed 상태를 분리하는 기반을 만드는 것입니다.

MVP3에서 구현된 범위:

- `User` 타입과 `users.json`을 추가합니다.
- 현재 active user를 선택할 수 있게 합니다.
- active user ID를 `localStorage`에 저장합니다.
- follow 상태를 user별로 분리해 `localStorage`에 저장합니다.
- active user 변경 시 Home Feed, Accounts, Account Profile의 follow 상태가 함께 바뀌게 합니다.
- `/me` 페이지에서 현재 User의 개인 영역, 연결된 Account, 해당 Account의 Post를 확인할 수 있게 합니다.

저장에 사용하는 `localStorage` key:

- active user ID: `local-feed-active-user-id`
- user별 follow 상태: `local-feed-following-by-user`

MVP3에서 구현하지 않는 것:

- 실제 로그인, 비밀번호, 인증 토큰, 권한 관리
- backend API, DB
- 게시물 작성/수정/삭제
- 댓글, 좋아요, 북마크
- 검색, 태그 모아보기, tag pages
- mock data 대규모 다양화

## 기술스택

- Vite
- React
- TypeScript
- Tailwind CSS
- React Router
- Static JSON files
- Static local assets

## 설치 및 실행 방법

Vite 앱 디렉터리로 이동합니다.

```bash
cd feed-prototype
```

의존성을 설치합니다.

```bash
npm install
```

개발 서버를 실행합니다.

```bash
npm run dev
```

프로덕션 빌드를 확인합니다.

```bash
npm run build
```

## 데이터 구조

초기 데이터는 `feed-prototype/src/data` 아래의 정적 JSON 파일에서 읽습니다.

MVP3부터는 다음 데이터 파일을 사용합니다.

- `users.json`: 로컬 User 목록과 User가 연결한 Account ID
- `accounts.json`: 게시물을 발행하는 Account 목록
- `posts.json`: Account가 발행한 Post 목록
- `follows.json`: User별 초기 follow 상태

### accounts.json

`accounts.json`은 게시물을 발행하는 주체인 Account 목록입니다.

Account는 일반 사용자, bot, 조직, 내부 분석 계정 등 다양한 주체를 표현할 수 있습니다. 주요 필드는 다음과 같습니다.

User와 Account는 다릅니다. `User`는 이 로컬 앱을 현재 누구 관점으로 보고 있는지 나타내는 선택 가능한 viewer이고, `Account`는 Post를 발행하는 feed 주체입니다. MVP3의 User는 실제 로그인 계정이나 권한 주체가 아닙니다.

- `id`: Account를 식별하는 고유 ID
- `handle`: feed에서 사용하는 짧은 계정명
- `displayName`: 화면에 표시되는 이름
- `avatarUrl`: avatar 이미지 경로
- `bio`: Account 소개
- `kind`: 계정 종류
- `metadata`: 시나리오별 확장 정보

### posts.json

`posts.json`은 Account가 발행한 Post 목록입니다.

Post는 사진, 메모, 차트, 테이블, 분석 결과 등 다양한 feed item을 표현합니다. 주요 필드는 다음과 같습니다.

- `id`: Post를 식별하는 고유 ID
- `accountId`: Post를 발행한 Account ID
- `title`: Post 제목
- `caption`: 본문 또는 짧은 설명
- `createdAt`: 생성 일시
- `tags`: tag 목록
- `assets`: Post에 첨부된 asset 목록
- `metadata`: status, mood, location, score 등 시나리오별 확장 정보

### users.json

`users.json`은 MVP3에서 추가되는 로컬 User 목록입니다. User는 인증 계정이 아니라 active user 선택과 user별 localStorage 상태 분리를 위한 로컬 프로필입니다.

주요 필드는 다음과 같습니다.

- `id`: User를 식별하는 고유 ID
- `display_name`: 화면에 표시할 이름
- `handle`: 화면에 표시할 짧은 user handle
- `avatar`: 선택적 avatar 이미지 경로
- `bio`: 선택적 소개 문구
- `account_id`: User와 연결된 Account ID
- `metadata`: 시나리오별 확장 정보

### follows.json

`follows.json`은 로컬 User별 초기 follow 상태입니다. 런타임 follow 상태는 active user별로 분리되어 `localStorage`에 저장됩니다.

주요 필드는 다음과 같습니다.

- `user_id`: follow 상태를 소유한 User ID
- `following_account_ids`: 해당 User가 follow한 Account ID 목록

## public/assets 사용 방식

정적 asset은 `feed-prototype/public/assets` 아래에 두고, JSON 데이터에서는 `/assets/...` 형태의 public path로 참조합니다.

예를 들어 Post asset의 `url`이 `/assets/posts/example.jpg`라면 실제 파일은 다음 위치에 둡니다.

```text
feed-prototype/public/assets/posts/example.jpg
```

Account avatar도 같은 방식으로 `/assets/avatars/...` 경로를 사용할 수 있습니다.

현재 데이터와 asset 파일만 교체하면 같은 앱 구조를 일반 개인 feed 또는 회사 내부 리포트형 feed로 재사용할 수 있습니다.

## Git에 올리지 않는 파일

`node_modules`와 `dist`는 생성물이며 Git에 올리지 않습니다.

- `node_modules`: `npm install`로 설치되는 의존성 디렉터리
- `dist`: `npm run build`로 생성되는 빌드 결과물

두 항목은 `feed-prototype/.gitignore`에 포함되어 있습니다.

## 향후 확장 방향

### 일반 개인 feed

- 개인 사진, 짧은 메모, 여행 기록, 카페 기록, 자동 요약 bot 게시물 등을 같은 `Account`와 `Post` 모델로 표현합니다.
- image, text, chart, table, json 등 여러 asset type을 조합해 다양한 게시물을 자연스럽게 표시합니다.

### 설비 리포트 feed

- 회사 내부에서는 Account를 설비, 엔지니어, 분석 bot 등으로 사용할 수 있습니다.
- Post는 daily report, 작업 로그, 점검 기록, 분석 결과를 담을 수 있습니다.
- 설비나 리포트에 특화된 값은 core type 이름으로 만들지 않고 `metadata` 또는 asset metadata에 저장합니다.
- 따라서 회사 내부 리포트 feed는 별도 전용 앱이 아니라 범용 local feed 모델 위에 얹히는 데이터 시나리오로 유지됩니다.

## 테스트 방법 정리

1. PostgreSQL DB 준비

MVP5-2만 했다면 아직 DB가 필요 없지만, MVP5-4 이후까지 진행했다면 DB가 필요합니다.

pgAdmin 또는 psql에서 DB를 하나 만듭니다.

DB 이름:

feed_prototype

pgAdmin 기준:

Servers
→ PostgreSQL 서버 선택
→ Databases 우클릭
→ Create
→ Database
→ Database name: feed_prototype
→ Save

사용자/비밀번호는 본인 PostgreSQL 설치 시 설정한 값을 사용하면 됩니다.

예를 들어:

host: localhost
port: 5432
database: feed_prototype
user: postgres
password: 본인 비밀번호
2. backend conda 환경 준비

VSCode PowerShell 또는 Miniconda Prompt에서 repo 루트로 이동합니다.

cd C:\...\feed-prototype

conda 환경이 이미 있으면 활성화합니다.

conda activate feed-backend

없으면 생성합니다.

conda create -n feed-backend python=3.11
conda activate feed-backend

backend 폴더로 이동합니다.

cd backend

필요 패키지를 설치합니다.

python -m pip install --upgrade pip
pip install -r requirements.txt

설치 확인:

pip list

최소한 아래 계열이 보여야 합니다.

fastapi
uvicorn
sqlmodel
psycopg
alembic
pydantic-settings
3. backend .env 만들기

backend 폴더 안에서 실행합니다.

copy .env.example .env

그 다음 VSCode에서 backend/.env 파일을 열고 DATABASE_URL을 본인 DB 정보에 맞게 수정합니다.

예:

DATABASE_URL=postgresql+psycopg://postgres:내비밀번호@localhost:5432/feed_prototype

예를 들어 비밀번호가 postgres라면:

DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype

주의:

.env는 Git에 올리면 안 됩니다.
.env.example만 Git에 올라가야 합니다.

확인:

git status

여기서 backend/.env가 보이면 안 됩니다.
보이면 .gitignore에 backend/.env를 추가해야 합니다.

4. migration 실행

backend 폴더에서 실행합니다.

alembic upgrade head

정상이라면 큰 에러 없이 종료됩니다.

확인용:

alembic current
alembic history

만약 connection refused, password authentication failed, database does not exist 같은 에러가 나오면 대부분 .env의 DATABASE_URL 문제입니다.

대표 원인:

DB 이름이 feed_prototype이 아님
PostgreSQL 서버가 꺼져 있음
비밀번호가 틀림
포트가 5432가 아님
DATABASE_URL 문법이 틀림
5. seed data 삽입

migration이 성공한 뒤 실행합니다.

python -m app.services.seed

정상이라면 users/accounts/posts/assets/follows 같은 demo data가 DB에 들어갑니다.

중복 방지 확인을 위해 한 번 더 실행해도 됩니다.

python -m app.services.seed

두 번째 실행에서 duplicate이 무한히 생기지 않아야 합니다.

6. backend 실행

backend 폴더에서 실행합니다.

python -m uvicorn app.main:app --reload

정상 로그 예:

Uvicorn running on http://127.0.0.1:8000
Application startup complete.

이 터미널은 backend 서버용으로 계속 켜둡니다.

7. backend API 확인

브라우저에서 먼저 확인합니다.

http://127.0.0.1:8000/health

정상 예:

{"status":"ok","service":"feed-prototype-backend"}

FastAPI 문서도 확인합니다.

http://127.0.0.1:8000/docs

여기서 /api/users, /api/accounts, /api/posts, /api/feed 등이 보이면 좋습니다.

다른 터미널에서 curl로도 확인할 수 있습니다.

curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
curl http://127.0.0.1:8000/api/follows
curl "http://127.0.0.1:8000/api/feed?user_id=1"

특히 이게 잘 나오면 backend DB/API skeleton은 정상입니다.

curl "http://127.0.0.1:8000/api/feed?user_id=1"
8. frontend 패키지 설치

새 VSCode 터미널을 열고 repo 루트로 이동합니다.

cd C:\...\feed-prototype

아직 node_modules가 없으면:

npm install

이미 설치되어 있으면 생략 가능하지만, 처음 환경이면 반드시 해야 합니다.

빌드 확인:

npm run build

정상적으로 build가 통과해야 합니다.

9. frontend 실행

repo 루트에서 실행합니다.

npm run dev

정상이라면 대략 이런 주소가 나옵니다.

Local: http://localhost:5173/

브라우저에서 접속합니다.

http://localhost:5173/
10. 브라우저에서 feed 확인

MVP5에서는 frontend가 아직 backend API를 쓰지 않는 구조일 가능성이 높습니다.
따라서 브라우저에서 확인할 것은 다음입니다.

1. User Entry 화면이 정상적으로 뜨는지
2. 기존 user id/handle로 진입 가능한지
3. 새 local user 등록이 되는지
4. Home Feed가 뜨는지
5. Following / All 탭이 동작하는지
6. Accounts / Explore 화면이 동작하는지
7. Account Profile로 이동되는지
8. Post Detail이 열리는지
9. follow / unfollow가 localStorage 기준으로 동작하는지

즉, frontend feed가 잘 나오는지 확인하는 것은 아직 mock JSON/localStorage 기반 UI 확인입니다.

backend 확인은 별도입니다.

frontend feed 확인
→ http://localhost:5173/

backend API 확인
→ http://127.0.0.1:8000/docs
→ http://127.0.0.1:8000/api/feed?user_id=1
