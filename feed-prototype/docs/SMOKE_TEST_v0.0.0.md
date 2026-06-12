# v0.0.0 Smoke Test

첫 번째 internal/local prototype release를 위한 최종 smoke test입니다.

## 1. Frontend Build 확인

```bash
cd feed-prototype
npm run build
```

기대 결과:

- TypeScript build가 통과합니다.
- Vite production build가 완료됩니다.

## 2. Mock Mode 확인

`feed-prototype/.env`를 생성하거나 수정합니다.

```text
VITE_DATA_SOURCE=mock
VITE_API_BASE_URL=http://127.0.0.1:8000
```

실행:

```bash
npm run dev
```

확인:

- App이 mock mode로 열립니다.
- Local user entry가 동작합니다.
- Home Feed가 sample post를 표시합니다.
- Accounts와 account profile page가 표시됩니다.
- Follow/unfollow state가 localStorage를 통해 유지됩니다.
- Post card가 tag, metadata, asset preview를 표시합니다.

## 3. API Backend 확인

`feed-prototype/backend/.env`를 생성하거나 수정합니다.

```text
APP_NAME=feed-prototype-backend
APP_ENV=local
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

실행:

```bash
cd feed-prototype/backend
.\.venv\Scripts\activate
alembic upgrade head
python -m app.services.seed
uvicorn app.main:app --reload
```

다른 terminal에서 확인:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
```

기대 결과:

- Health endpoint가 응답합니다.
- Users, accounts, posts, feed endpoint가 JSON을 반환합니다.

## 4. API Frontend 확인

`feed-prototype/.env`를 생성하거나 수정합니다.

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

실행:

```bash
cd feed-prototype
npm run dev
```

확인:

- API user selection이 id 또는 handle로 동작합니다.
- Home Feed가 backend data를 표시합니다.
- Accounts page가 backend account를 표시합니다.
- Account Profile과 Post Detail이 표시됩니다.
- Follow/unfollow 변경이 API mode에 반영됩니다.
- Post 생성은 active API user의 1:1 Account를 사용합니다.
- Edit/delete는 active API user의 Account가 소유한 post에만 가능합니다.
- Filter panel이 keyword, tag, metadata, asset type, account filter를 apply/reset합니다.
- Filter 결과가 없으면 empty state가 표시됩니다.

## 5. External Import 확인

Dry-run:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Actual import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

선택 확인용 MVP12 asset viewer sample:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

API mode에서 확인:

- Imported account가 Accounts page에 표시됩니다.
- Imported post를 Account Profile과 Post Detail에서 볼 수 있습니다.
- 같은 JSON을 다시 import해도 duplicate post가 생기지 않습니다.
- Image/plot asset이 thumbnail로 표시되고 modal에서 열립니다.
- 여러 image/plot asset은 `sort_order` 순서로 prev/next navigation이 동작합니다.
- 접근 가능한 CSV file은 table preview가 동작합니다.
- Missing image 또는 CSV URL은 crash가 아니라 fallback UI를 표시합니다.
- File asset은 Open original card를 표시합니다.
- Link asset은 일반 link/card로 열립니다.

## 6. 릴리즈 안전 확인

Tagging 또는 sharing 전에 확인합니다.

- `.env` file은 local only입니다.
- PostgreSQL data와 dump는 commit하지 않습니다.
- Generated large binary asset은 의도적으로 작고 문서화된 경우가 아니라면 commit하지 않습니다.
- Scenario-specific analysis value는 `metadata_json` 또는 asset metadata 안에 둡니다.
- Production auth/security claim을 하지 않습니다.
