# Feed Prototype Backend

MVP5 adds a minimal FastAPI backend for the local feed prototype.

The backend now includes `GET /health`, SQLModel database setup, Alembic migrations, and a small demo seed script. It does not add authentication, CRUD APIs, uploads, admin features, or frontend API integration.

## MVP6 Frontend API Read Mode

MVP6 uses this backend as the read-only API source for the frontend's API mode. The frontend should call FastAPI endpoints such as `GET /api/users` and `GET /api/feed?user_id=...` to display PostgreSQL seed-data-backed feed content.

API user entry in MVP6 is only a prototype user-selection flow. A frontend user can select a backend `User` that already exists by id or handle, but the backend still does not provide login, passwords, JWT, session cookies, OAuth, authorization, user creation, follow/unfollow writes, post writes, uploads, or admin features.

Mock mode remains separate in the frontend. Existing frontend mock JSON and MVP4 localStorage-based local user registration are not replaced by this backend.

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

Edit `.env` and set `DATABASE_URL` for your local PostgreSQL environment.

Example:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

Do not commit a real `.env` file.

## PostgreSQL

Create a local PostgreSQL database named:

```text
feed_prototype
```

You can create it with pgAdmin or any local PostgreSQL tool. Real DB data, dumps, and local `.env` files should not be committed.

## Migrate

```bash
alembic upgrade head
```

## Seed

```bash
python -m app.services.seed
```

The seed script inserts a small generic feed dataset for backend API checks. It is separate from the frontend mock JSON data.

## Run Backend

```bash
uvicorn app.main:app --reload
```

The API will be available at:

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

If your database has a user with id `1`, this shape also works:

```bash
curl "http://127.0.0.1:8000/api/feed?user_id=1"
```

## Data Policy

- Existing frontend mock JSON stays in place during MVP5.
- The frontend is not converted to API-backed data yet.
- Backend seed data exists separately for DB and read-only API verification.
- DB state should be reproducible from Alembic migrations plus the seed script.
- Real PostgreSQL DB data is not committed.

## Not In MVP5

- Authentication or login
- POST/PUT/PATCH/DELETE APIs
- Admin UI
- File upload API
- S3 integration
- Frontend API migration
