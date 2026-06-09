# MVP10 Test Procedure

MVP10 is **External Post Ingestion Pipeline**. This procedure checks validation, dry-run, actual import, rollback behavior, DB separation, existing backend API behavior, frontend behavior, and scope boundaries.

## Preconditions

Run backend commands from:

```bash
cd feed-prototype/backend
```

Apply migrations before testing against PostgreSQL:

```bash
alembic upgrade head
```

Use a test database first. Keep `.env` out of git.

```text
feed_dev  - MVP feature testing
feed_ops  - external post import and UI confirmation
```

The import command reads the backend `.env` or `DATABASE_URL`. You can also use `--database-url` for a one-command override.

## Import Validation Checklist

Confirm each case fails with a clear error and does not write rows:

```text
input file does not exist
invalid JSON syntax
missing batch.external_id
missing account.external_id
missing post.external_id
missing post.account_external_id
missing post.title
post.account_external_id not in payload and not in DB
missing asset.type
asset.type outside image | plot | table | file | link
missing asset.url
asset.url is a Windows absolute path such as C:\data\plot.png
tags is not a list
metadata_json is not an object
duplicate account.external_id in one payload
duplicate post.external_id in one payload
duplicate asset.external_id in one payload
```

Unknown fields may appear in JSON, but MVP10 only stores documented fields.

## Dry Run

Run:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json --dry-run
```

Expected:

```text
External post import dry-run summary
Accounts create/update counts
Users create/update counts
Posts create/update/skip counts
Assets replace/delete/create counts
Errors: 0
No DB writes are committed
```

After dry-run, account/post/asset row counts should not increase.

## Actual Import

Run:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
```

Expected:

```text
External post import completed
new import User created when needed
new Account created or existing Account updated
new Posts created or existing Posts updated
assets replaced for posts that include assets
imported_at updated
import_batch_external_id stored
```

Run the same command twice. The second import should update existing posts, not create duplicate posts.

## Rollback

One import file should behave as one transaction.

Expected:

```text
if validation fails before DB work, no rows are written
if DB work begins and a later post fails, session rollback removes partial writes
dry-run always rolls back
```

MVP10 does not provide a batch dashboard or persisted import audit table. If a rollback issue appears in real PostgreSQL testing, capture the failing JSON and add a focused regression case before widening scope.

## Backend API Regression

Check existing API behavior after MVP10 fields/import support:

```text
GET /api/posts
GET /api/feed?user_id=...
POST /api/posts
PATCH /api/posts/{post_id}
DELETE /api/posts/{post_id}
POST /api/users/{user_id}/follows/{account_id}
DELETE /api/users/{user_id}/follows/{account_id}
POST /api/users
GET /api/accounts
GET /api/accounts/{account_id}/posts
GET /api/posts/{post_id}
```

Expected:

```text
existing UI-created posts still work without external_id
existing post create/edit/delete ownership behavior is unchanged
follow/unfollow still updates backend follows
user/account registration still creates one User and one Account
imported posts are readable through accounts/posts/feed routes
```

## Frontend Regression

Check in mock mode:

```text
backend does not need to be running
Home Feed loads mock data
Accounts and Account Profile load mock data
Post Detail loads mock data
mock follow state still uses localStorage
```

Check in API mode:

```text
Home Feed still loads own and followed account posts
Account Profile still shows account data and posts
Post Detail still shows title/text/tags/metadata/assets
post create/edit/delete still works for owned posts
imported account appears in Accounts
imported account Profile shows imported posts
imported Post Detail shows image preview or placeholders/link cards
```

Home Feed note:

```text
imported accounts are not automatically followed
imported posts may not appear in a normal active user's Home Feed until followed
selecting the generated import User can show imported posts as own-account posts
```

## Scope Boundary

MVP10 should not introduce:

```text
UI file upload
S3 upload
asset file automatic copy
folder watch
scheduler or Airflow integration
metadata filter/search
asset viewer enhancement
chart/table parsing
batch management UI
import dashboard
JWT/session/auth
mock mode removal
```

## Current MVP10 TODO

Potential future work:

```text
dedicated automated pytest coverage for import validation and rollback
optional import audit table
optional stricter URL allowlist for production deployments
optional richer operator-facing import diagnostics
real browser E2E smoke tests for imported content
```
