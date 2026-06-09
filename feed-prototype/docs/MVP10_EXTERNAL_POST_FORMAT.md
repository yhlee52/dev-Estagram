# MVP10 External Post Format

MVP10 is **External Post Ingestion Pipeline**. External analysis programs or post generation programs create JSON-based post packages. The import service reads those packages, upserts generic feed data into the backend DB, and the UI displays imported posts like ordinary posts.

MVP10 is not a UI post creation, file upload, S3 upload, folder watch, scheduler, metadata search, or advanced asset viewer feature.

## Package Structure

Recommended package layout:

```text
batch_YYYY-MM-DD_HHMMSS/
  feed_posts.json
  assets/
    image_or_plot_files.png
    table_files.csv
```

Repository locations:

```text
data/external_posts/
  README.md
  examples/
    feed_import_sample.json
    batch_2026-06-09_090000/
      feed_posts.json
      assets/
        README.md
  incoming/
  archive/
  failed/
```

Use `examples` as a reference. Use `incoming` for packages waiting to be imported. `archive` and `failed` are optional manual holding areas in MVP10.

## Basic feed_posts.json

Minimal top-level shape:

```json
{
  "batch": {
    "external_id": "batch-2026-06-09-090000",
    "source": "manual-generator",
    "created_at": "2026-06-09T09:00:00"
  },
  "accounts": [],
  "posts": []
}
```

Top-level fields:

- `batch`: metadata for the generated package.
- `accounts`: imported accounts that can own imported posts.
- `posts`: imported posts to create or update.

Unknown fields are allowed by the schema, but the import service only stores the documented fields.

## Account Format

Recommended fields:

- `external_id`: required import/upsert key.
- `handle`: required UI-facing handle.
- `display_name`: required UI-facing name.
- `bio`: optional account description.
- `avatar_url`: optional browser-accessible avatar URL/path.

Example:

```json
{
  "external_id": "bot-temp-report",
  "handle": "temp_report_bot",
  "display_name": "Temperature Report Bot",
  "bio": "Generated temperature analysis posts.",
  "avatar_url": "/assets/generated/bot-temp-report.png"
}
```

During the MVP stage, each `Account` must have one corresponding `User`. The import service automatically creates a generic paired import User for each imported Account:

```text
user id: import-user-{normalized-account-external-id}
user handle: import.{normalized-account-external-id}
account id: import-account-{normalized-account-external-id}
account kind: bot
```

## Post Format

Recommended fields:

- `external_id`: required post import/upsert key.
- `account_external_id`: required account reference.
- `title`: required post title.
- `text`: optional post body text.
- `created_at`: optional post creation timestamp.
- `tags`: optional list of strings.
- `metadata_json`: optional object for domain-specific values.
- `assets`: optional list of asset descriptors.

Example:

```json
{
  "external_id": "post-temp-2026-06-09-001",
  "account_external_id": "bot-temp-report",
  "title": "Daily temperature summary",
  "text": "TEMP-related signals were detected today.",
  "created_at": "2026-06-09T09:00:00",
  "tags": ["daily-report", "temperature"],
  "metadata_json": {
    "source": "analysis-program",
    "reportDate": "2026-06-09",
    "recipe": "ABC",
    "chamber": "CH01"
  },
  "assets": []
}
```

Keep the core feed model generic. Domain-specific values such as recipe, chamber, status, severity, equipment state, or analysis result belong in `metadata_json` or asset metadata, not in core model/component names.

## Asset Format

Recommended fields:

- `external_id`: recommended stable asset key.
- `type`: required asset type.
- `url`: required browser-accessible URL/path.
- `title`: optional asset title.
- `description`: optional asset description.

Allowed asset types:

```text
image
plot
table
file
link
```

Example:

```json
{
  "external_id": "asset-temp-2026-06-09-001",
  "type": "image",
  "url": "/assets/generated/temp_trend_001.png",
  "title": "Temperature trend",
  "description": "Generated temperature trend plot."
}
```

Asset replacement policy:

- If a post includes `assets`, the list is treated as the latest complete asset list for that post.
- Existing assets for that post are deleted and replaced with the imported list.
- If a post omits `assets`, existing assets for that post are left unchanged.
- Use `assets: []` when the correct imported state is no assets.

## external_id Rules

Recommended naming:

```text
batch external_id:   batch-YYYY-MM-DD-HHMMSS
account external_id: bot-{purpose}
account external_id: manual-{name}
account external_id: source-{system-name}
post external_id:    post-{source}-{date}-{serial}
asset external_id:   asset-{source}-{date}-{serial}
```

Important behavior:

- If `external_id` is the same, the existing row is updated.
- If `external_id` changes, the import service treats it as new data and inserts a new row.
- To update the same post, keep the same `post.external_id`.
- To create a new post, create a new `post.external_id`.

This is the most common ingestion mistake: changing `post.external_id` every run when the intent was to update the same post.

## Asset URL/path Rules

MVP10 does not copy asset files. The import service stores only the `url` value from JSON.

Use browser-accessible URLs or paths:

```text
/assets/generated/temp_trend_001.png
https://example.com/assets/temp_trend_001.png
```

Avoid:

```text
C:\data\temp_trend_001.png
feed-prototype/backend/local/temp_trend_001.png
```

The frontend UI runs in a browser. A path is valid only if the browser can request it from the frontend/backend/static asset setup.

## Continuous Import Procedure

Recommended workflow for each new batch:

1. Generate a new package folder, for example `batch_2026-06-09_090000`.
2. Write `feed_posts.json`.
3. Save asset files to a static location the UI can access.
4. Confirm each asset `url` points to that browser-accessible location.
5. Run dry-run import.
6. Fix validation errors or wrong counts.
7. Run actual import.
8. Check the UI in Home Feed, Account Profile, and Post Detail.

## UI Visibility And Edit/Delete Policy

Imported posts use the same generic `Account`, `Post`, `Asset`, and `Metadata` structures as posts created from the UI.

Home Feed behavior:

- The API Home Feed shows posts from the active API user's own account and followed accounts.
- Imported accounts are not automatically followed by every active user.
- If an imported account is not followed, its posts may not appear in Home Feed for that active user.
- Imported content can still be checked through Account Profile and Post Detail API routes.

Account Profile behavior:

- Imported account `handle`, `display_name`, `bio`, and `avatar_url` are shown with existing profile UI.
- Imported posts for that account are listed latest-first.

Post Detail behavior:

- `title`, `text`, `tags`, `metadata_json`, `created_at`, `updated_at`, and `imported_at` use existing post detail UI.
- Image assets render as image previews when the URL is browser-accessible.
- Plot, table, file, and link assets render through the existing MVP asset placeholder/link-card UI.

Edit/delete behavior:

- Imported posts follow the existing MVP ownership policy.
- Edit/delete buttons are shown only when the active API user owns the post's account.
- A normal active API user will not see edit/delete for posts owned by an imported account.
- If the generated import User for an imported account is selected as the active API user, edit/delete may appear. This is acceptable for the MVP stage and is still prototype ownership checking, not formal authentication or authorization.

Commands:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json
```

## Test DB And Operational DB

MVP development/test DB and external post operational/update DB can be separated.

Use the same backend code, but point `DATABASE_URL` to a different database:

```text
feed_dev
- MVP feature testing

feed_ops
- external post import and UI confirmation
```

Operational guidance:

- Keep `.env` out of git.
- Check the active `DATABASE_URL` before import.
- Run `--dry-run` before importing into the operational DB.
- Use `--database-url` only when you intentionally want a one-command override.

Example:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --database-url postgresql+psycopg://postgres:postgres@localhost:5432/feed_ops --dry-run
```

## Common Mistakes

- Changing `external_id` every run and creating duplicate posts.
- Changing `post.external_id` when the intent was to update the same post.
- Referencing an `account_external_id` that is not in the payload and not already in the DB.
- Using an asset `url` the browser cannot access.
- Using a Windows local path as if it were a browser URL.
- Putting a backend-only local file path in `asset.url`.
- Putting very complex nested objects into `metadata_json` too early.
- Breaking JSON syntax with a missing or extra comma.
- Importing directly into the operational DB without `--dry-run`.
- Pointing `DATABASE_URL` at the operational DB when you meant to use the test DB.

## Full Example

See:

```text
data/external_posts/examples/feed_import_sample.json
data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
```
