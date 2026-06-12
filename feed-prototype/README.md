# feed-prototype

`feed-prototype` is a Vite + React + TypeScript Instagram-like local/general feed prototype.

Current release: `v0.0.0`.

This release is a local/internal prototype baseline. It is suitable for demoing generic SNS-like posts and externally imported analysis/report-style posts, but it is not a production-ready product.

## What Is Included

- Mock-mode local feed using static frontend data and localStorage overlay
- API-mode feed using FastAPI and PostgreSQL
- Local API user/account registration for prototype user selection
- Follow/unfollow in API mode
- Personal post create/edit/delete in API mode
- Tags, metadata, and asset descriptors on posts
- External JSON post package import with `external_id` upsert
- API-mode filter/search by keyword, tag, metadata key/value, asset type, account, and own posts
- Asset viewer for image/plot thumbnails, modal navigation, CSV table preview, file cards, link cards, and broken URL fallback

## What Is Not Included

- Production authentication or authorization
- Passwords, JWT, sessions, OAuth, or roles
- Real file upload, S3 upload, or asset file copy
- Folder watching or scheduled imports
- Advanced search, semantic search, vector search, dashboards, or analytics
- Equipment/report-specific core model names

## Environment

Frontend `.env`:

```bash
copy .env.example .env
```

Supported values:

```text
VITE_DATA_SOURCE=mock
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Backend `.env`:

```bash
cd backend
copy .env.example .env
```

Set `DATABASE_URL` for your local PostgreSQL database.

## Mock Mode

Mock mode needs only the frontend:

```bash
cd feed-prototype
copy .env.example .env
```

Set:

```text
VITE_DATA_SOURCE=mock
```

Run:

```bash
npm install
npm run dev
```

Mock data lives in `src/data`. Runtime mock overlay state is stored in localStorage.

Important localStorage keys:

```text
local-feed-active-user-id
local-feed-following-by-user
local-feed-local-users
local-feed-local-accounts
```

## API Mode

API mode needs PostgreSQL plus the FastAPI backend.

Backend setup:

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

Run migration, seed, and backend:

```bash
alembic upgrade head
python -m app.services.seed
uvicorn app.main:app --reload
```

Frontend setup:

```bash
cd feed-prototype
copy .env.example .env
```

Set:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run:

```bash
npm run dev
```

API user selection is prototype state only. It is not login or authentication.

## External Import Mode

External import is a backend CLI workflow. It reads JSON post packages and upserts generic `Account`, `Post`, `Asset`, and `Metadata` data into PostgreSQL.

Dry-run:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

Then use API mode in the UI to view imported posts.

Detailed guide:

```text
data/external_posts/README.md
docs/MVP10_EXTERNAL_POST_FORMAT.md
```

## Samples

General SNS-like sample content is in:

```text
src/data
backend/app/services/seed.py
```

External analysis/report-style sample packages are in:

```text
data/external_posts/examples/feed_import_sample.json
data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

Report-like values such as recipe, chamber, status, and severity are sample metadata values only. They must stay in `metadata_json` or asset metadata, not in core architecture names.

## Release Docs

```text
docs/RELEASE_CHECKLIST_v0.0.0.md
docs/SMOKE_TEST_v0.0.0.md
docs/README.md
```

## Build

Run before handoff:

```bash
npm run build
```
