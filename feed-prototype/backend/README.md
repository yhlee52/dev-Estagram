# Feed Prototype Backend

MVP5-1 adds a minimal FastAPI backend skeleton for the local feed prototype.

This stage only provides a runnable app and `GET /health`. It does not add database models, SQLModel, Alembic, seed scripts, authentication, CRUD APIs, uploads, admin features, or frontend API integration.

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
