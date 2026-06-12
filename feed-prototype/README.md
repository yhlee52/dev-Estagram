# feed-prototype

`feed-prototype`은 Vite + React + TypeScript 기반의 Instagram-like local/general feed prototype입니다.

현재 릴리즈: `v0.0.0`.

이 릴리즈는 local/internal prototype 기준점입니다. generic SNS-like post와 외부 import된 분석/리포트형 post를 데모할 수 있지만 production-ready 제품은 아닙니다.

## 포함된 기능

- static frontend data와 localStorage overlay를 사용하는 mock-mode local feed
- FastAPI와 PostgreSQL을 사용하는 API-mode feed
- prototype user selection을 위한 API-mode local user/account registration
- API mode follow/unfollow
- API mode personal post create/edit/delete
- Post tags, metadata, asset descriptors
- `external_id` upsert 기반 external JSON post package import
- keyword, tag, metadata key/value, asset type, account, own posts 기준 API-mode filter/search
- image/plot thumbnail, modal navigation, CSV table preview, file card, link card, broken URL fallback을 포함한 asset viewer

## 포함되지 않은 기능

- production authentication 또는 authorization
- password, JWT, session, OAuth, role
- real file upload, S3 upload, asset file copy
- folder watch 또는 scheduled import
- advanced search, semantic search, vector search, dashboard, analytics
- equipment/report-specific core model name

## 환경 설정

Frontend `.env`:

```bash
copy .env.example .env
```

지원 값:

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

local PostgreSQL database에 맞게 `DATABASE_URL`을 설정합니다.

## Mock Mode 실행

Mock mode는 frontend만 있으면 실행할 수 있습니다.

```bash
cd feed-prototype
copy .env.example .env
```

설정:

```text
VITE_DATA_SOURCE=mock
```

실행:

```bash
npm install
npm run dev
```

Mock data는 `src/data`에 있습니다. Runtime mock overlay state는 localStorage에 저장됩니다.

중요 localStorage key:

```text
local-feed-active-user-id
local-feed-following-by-user
local-feed-local-users
local-feed-local-accounts
```

## API Mode 실행

API mode는 PostgreSQL과 FastAPI backend가 필요합니다.

Backend setup:

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

`backend/.env` 수정:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

Migration, seed, backend 실행:

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

설정:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

실행:

```bash
npm run dev
```

API user selection은 prototype state입니다. login 또는 authentication이 아닙니다.

## External Import Mode 실행

External import는 backend CLI 작업 흐름입니다. JSON post package를 읽고 generic `Account`, `Post`, `Asset`, `Metadata` data를 PostgreSQL에 upsert합니다.

Dry-run:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

이후 API mode UI에서 imported post를 확인합니다.

상세 guide:

```text
data/external_posts/README.md
docs/MVP10_EXTERNAL_POST_FORMAT.md
```

## Sample Data

일반 SNS-like sample content:

```text
src/data
backend/app/services/seed.py
```

외부 분석/리포트형 sample package:

```text
data/external_posts/examples/feed_import_sample.json
data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

recipe, chamber, status, severity 같은 report-like value는 sample metadata value일 뿐입니다. 이런 값은 core architecture name이 아니라 `metadata_json` 또는 asset metadata 안에 유지합니다.

## 릴리즈 문서

```text
docs/RELEASE_CHECKLIST_v0.0.0.md
docs/SMOKE_TEST_v0.0.0.md
docs/README.md
```

## Build 검증

handoff 전에 실행합니다.

```bash
npm run build
```
