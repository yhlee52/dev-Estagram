# Feed Prototype Backend

MVP5 adds a minimal FastAPI backend for the local feed prototype.

The backend now includes `GET /health`, SQLModel database setup, Alembic migrations, and a small demo seed script. It does not add authentication, CRUD APIs, uploads, admin features, or frontend API integration.

## Setup

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

## Health Check

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "feed-prototype-backend"
}
```

Use `.env.example` as a reference for local environment variables. Do not commit a real `.env` file.

## Seed Demo Data

After applying migrations to a local PostgreSQL database, run:

```bash
python -m app.services.seed
```

The seed script inserts a small generic feed dataset for backend API checks. It is separate from the frontend mock JSON data.
