# v0.0.0 Smoke Test

This is the final smoke test for the first internal/local prototype release.

## 1. Frontend Build

```bash
cd feed-prototype
npm run build
```

Expected result:

- TypeScript build passes.
- Vite production build completes.

## 2. Mock Mode

Create or edit `feed-prototype/.env`:

```text
VITE_DATA_SOURCE=mock
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run:

```bash
npm run dev
```

Check:

- App opens in mock mode.
- Local user entry works.
- Home Feed renders sample posts.
- Accounts and account profile pages render.
- Follow/unfollow state persists through localStorage.
- Post cards show tags, metadata, and asset previews where present.

## 3. API Backend

Create or edit `feed-prototype/backend/.env`:

```text
APP_NAME=feed-prototype-backend
APP_ENV=local
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

Run:

```bash
cd feed-prototype/backend
.\.venv\Scripts\activate
alembic upgrade head
python -m app.services.seed
uvicorn app.main:app --reload
```

In another terminal:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

Expected result:

- Health endpoint responds.
- Users, accounts, posts, and feed endpoints return JSON.

## 4. API Frontend

Create or edit `feed-prototype/.env`:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run:

```bash
cd feed-prototype
npm run dev
```

Check:

- API user selection works by id or handle.
- Home Feed renders backend data.
- Accounts page renders backend accounts.
- Account Profile and Post Detail render.
- Follow/unfollow changes are reflected in API mode.
- Creating a post uses the active API user's 1:1 Account.
- Editing/deleting is available only for posts owned by the active API user's Account.
- Filter panel applies and resets keyword, tag, metadata, asset type, and account filters.
- Empty filter results show an empty state.

## 5. External Import

Dry-run:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Actual import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

Optional MVP12 asset viewer sample:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

Check in API mode:

- Imported accounts are visible on Accounts page.
- Imported posts are visible from Account Profile and Post Detail.
- Re-importing the same JSON does not create duplicate posts.
- Image/plot assets show thumbnails and open in a modal.
- Multiple image/plot assets navigate prev/next in `sort_order`.
- CSV table preview works for accessible CSV files.
- Missing image or CSV URLs show fallback UI rather than crashing.
- File assets show Open original cards.
- Link assets open as normal links/cards.

## 6. Release Safety Notes

Confirm before tagging or sharing:

- `.env` files are local only.
- PostgreSQL data and dumps are not committed.
- Large generated binary assets are not committed unless intentionally small and documented.
- Scenario-specific analysis values remain inside `metadata_json` or asset metadata.
- No production auth/security claims are made.
