# Feed Prototype Backend

이 폴더는 `feed-prototype`의 FastAPI backend입니다.

Backend는 PostgreSQL, SQLModel, Alembic을 사용합니다. MVP5에서 backend/database skeleton이 추가되었고, 이후 MVP를 거치며 API read/write, follow/unfollow, user/account registration, post create/edit/delete, asset/metadata, external post import가 추가되었습니다.

## Stack

- FastAPI
- PostgreSQL
- SQLModel
- Alembic
- Local file folder: `backend/uploads/`

## Setup

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

`.env`에서 local PostgreSQL 환경에 맞게 `DATABASE_URL`을 설정합니다.

예:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

실제 `.env` 파일은 commit하지 않습니다.

## PostgreSQL

local PostgreSQL에 사용할 DB를 생성합니다.

예:

```text
feed_prototype
```

pgAdmin 또는 local PostgreSQL 도구를 사용해 생성할 수 있습니다. 실제 DB data, dump, local `.env` file은 commit하지 않습니다.

## Migration

```bash
alembic upgrade head
```

## Seed

```bash
python -m app.services.seed
```

seed script는 backend API 확인용 generic feed dataset을 DB에 넣습니다. frontend mock JSON과는 별도입니다.

## Backend 실행

```bash
uvicorn app.main:app --reload
```

API URL:

```text
http://127.0.0.1:8000
```

## API Smoke Test

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
curl http://127.0.0.1:8000/api/follows
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

DB에 id가 `1`인 user가 있다면 아래 형태도 사용할 수 있습니다.

```bash
curl "http://127.0.0.1:8000/api/feed?user_id=1"
```

## MVP6 Frontend API Read Mode

MVP6부터 frontend API mode가 backend를 read source로 사용합니다. frontend는 `GET /api/users`, `GET /api/feed?user_id=...` 같은 FastAPI endpoint를 호출해 PostgreSQL seed data 기반 feed를 표시합니다.

API user entry는 prototype user selection flow입니다. frontend 사용자는 backend DB에 존재하는 `User`를 id 또는 handle로 선택할 수 있지만, 이것은 login/password/JWT/session/OAuth/authorization이 아닙니다.

## MVP7 API Follow/Unfollow

MVP7은 API mode follow state를 backend DB에 저장합니다.

```bash
curl http://127.0.0.1:8000/api/users/demo-user-ari/follows
curl -X POST http://127.0.0.1:8000/api/users/demo-user-ari/follows/demo-account-nova
curl -X DELETE http://127.0.0.1:8000/api/users/demo-user-ari/follows/demo-account-nova
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

follow는 idempotent하게 동작하도록 설계되어 있습니다. 같은 follow를 반복해도 duplicate row가 계속 생기지 않고, 같은 unfollow를 반복해도 user/account가 존재하면 현재 follow list를 반환합니다.

Mock mode follow state는 frontend localStorage에 별도로 유지됩니다.

## MVP8/MVP9 Post Write

MVP8은 API mode personal post create/delete를 추가했습니다.

MVP9는 tags, metadata, asset descriptor, post edit/update를 추가했습니다.

Post write는 active API user의 1:1 `Account`를 통해 수행합니다. frontend가 임의의 `account_id`를 선택하지 않습니다. ownership check는 MVP prototype 정책이며 formal auth가 아닙니다.

## MVP10 External Post Import

MVP10은 외부 JSON package를 읽어 account/post/assets/metadata를 DB에 upsert하는 import service를 추가했습니다.

Dry-run:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Actual import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

특정 DB URL을 명령에서 override할 수도 있습니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --database-url postgresql+psycopg://postgres:postgres@localhost:5432/feed_ops --dry-run
```

MVP10은 asset 파일을 복사하지 않습니다. JSON의 `asset.url`에는 UI 브라우저에서 접근 가능한 URL/path를 넣어야 합니다.

자세한 내용:

```text
../data/external_posts/README.md
../docs/MVP10_EXTERNAL_POST_FORMAT.md
../docs/MVP10_TEST_PROCEDURE.md
```

## Data Policy

- frontend mock JSON은 유지합니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.
- backend DB state는 migration + seed/import script로 재현 가능해야 합니다.
- 실제 PostgreSQL DB data, dump, `.env`는 commit하지 않습니다.
- MVP 단계에서 active API user selection은 local prototype state이며 authentication이 아닙니다.
