# External Post Import Packages

This directory is for MVP10, **External Post Ingestion Pipeline**.

MVP10 is not a UI flow for directly creating posts. External analysis programs or post generation programs can create a JSON-based post package, and an import script can load that package into the backend database. The existing UI should then display imported posts like ordinary posts.

## Directory Layout

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

Meanings:

- `examples`: sample JSON for humans and external generators.
- `incoming`: location where external programs can place packages before import.
- `archive`: optional place to keep successfully imported packages later.
- `failed`: optional place to keep failed packages for manual inspection.

MVP10 does not automatically move packages into `archive` or `failed`.

For the full external post JSON format guide, see `feed-prototype/docs/MVP10_EXTERNAL_POST_FORMAT.md`.

For validation, dry-run, rollback, and regression checks, see `feed-prototype/docs/MVP10_TEST_PROCEDURE.md`.

## Ingestion Flow

```text
analysis program / post generation program
  -> creates post JSON
  -> creates image / plot / table / file assets
  -> writes a package under data/external_posts/incoming
  -> import script reads the package JSON
  -> import script validates the package
  -> import script upserts accounts / posts / assets / metadata_json
  -> UI reads backend DB data through API mode
  -> imported posts appear like normal posts
```

## Database Selection

The import script should use the backend database connection configured through `.env` or `DATABASE_URL`.

Use different database URLs to separate a test import database from an operational/update database. The frontend should keep reading through FastAPI; it should not connect directly to PostgreSQL.

## CLI Usage

Run commands from the backend directory:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

Package-style example:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
```

An optional database URL override is available:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --database-url postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype_import_test
```

## JSON Package Shape

Top-level fields:

- `batch`: import batch metadata.
- `accounts`: accounts that imported posts can reference.
- `posts`: posts to create or update.

Minimal shape:

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

`batch` fields:

- `external_id`: required stable batch id.
- `source`: optional generator/source name.
- `created_at`: optional batch creation timestamp.

`accounts[]` fields:

- `external_id`: required account upsert key.
- `handle`: UI-facing account handle.
- `display_name`: UI-facing account name.
- `bio`: optional account bio.
- `avatar_url`: optional URL/path for the account avatar.

`posts[]` fields:

- `external_id`: required post upsert key.
- `account_external_id`: required link to an account in `accounts[]`.
- `title`: required post title.
- `text`: optional post body text.
- `created_at`: optional post creation timestamp.
- `tags`: optional list of strings.
- `metadata_json`: optional object for domain-specific values.
- `assets`: optional list of asset descriptors.

`assets[]` fields:

- `external_id`: recommended stable asset id.
- `type`: required asset type.
- `url`: required UI-accessible URL/path.
- `title`: optional asset title.
- `description`: optional asset description.

Allowed MVP10 asset types:

```text
image
plot
table
file
link
```

## Upsert Policy

MVP10 uses `external_id` based upsert so importing the same JSON repeatedly does not keep creating duplicate posts.

Expected keys:

- Account upsert: `account.external_id`
- Post upsert: `post.external_id`
- Asset id/reference: `asset.external_id`

Asset files are not copied by MVP10. The JSON stores only URLs or paths that the UI can access.

Recommended `external_id` patterns:

```text
batch-YYYY-MM-DD-HHMMSS
bot-{purpose}
manual-{name}
source-{system-name}
post-{source}-{date}-{serial}
asset-{source}-{date}-{serial}
```

If an `external_id` stays the same, the import updates existing data. If an `external_id` changes, the import inserts new data.

## Import Account User Policy

During the MVP stage, each `Account` must have exactly one corresponding `User`. The import script therefore creates one generic import `User` for each imported `Account`.

Rules:

- Imported account key: `account.external_id`
- Generated user id: `import-user-{normalized-account-external-id}`
- Generated user handle: `import.{normalized-account-external-id}`
- Generated account id: `import-account-{normalized-account-external-id}`
- Imported account kind: `bot`

`User` does not have an `external_id` field in MVP10. The deterministic `id` and `handle` rules keep this policy stable without adding equipment- or report-specific core concepts.

## Asset Replacement Policy

When a post payload includes an `assets` field, that list is treated as the latest complete asset list for the post. Existing assets for that post are deleted and replaced with the imported list.

When a post payload omits the `assets` field, existing assets for that post are left unchanged. External generators should include `assets: []` when the correct imported state is no assets.

## Continuous Import Checklist

1. Create a new batch folder under `data/external_posts/incoming`.
2. Write `feed_posts.json`.
3. Put asset files somewhere the browser can access.
4. Confirm each asset `url` points to that browser-accessible location.
5. Run dry-run.
6. Fix validation errors or unexpected counts.
7. Run actual import.
8. Check Home Feed, Account Profile, and Post Detail in API mode.

Example:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json
```

## Test DB And Operational DB

Use separate databases when needed:

```text
feed_dev  - MVP feature testing
feed_ops  - external post import and UI confirmation
```

Use the same backend code and change only `.env`, `DATABASE_URL`, or the command's `--database-url` override. Do not commit `.env`. Always run `--dry-run` before importing into an operational DB.

## Common Mistakes

- Changing `external_id` every run and creating duplicate posts.
- Changing `post.external_id` when the intent was to update the same post.
- Referencing an `account_external_id` that is missing from the payload and DB.
- Using an asset `url` the browser cannot access.
- Using a Windows local path like `C:\...` as an asset URL.
- Using backend-only local paths in `asset.url`.
- Putting very complex nested objects into `metadata_json` too early.
- Breaking JSON syntax with a missing or extra comma.
- Importing into an operational DB without `--dry-run`.
- Pointing `DATABASE_URL` at the wrong database.

## Domain Policy

Keep the core feed domain generic:

```text
User
Account
Post
Feed
Follow
Asset
Metadata
```

Do not introduce equipment-report-specific names into core models, shared components, routes, or data flow. Scenario-specific values such as recipe, chamber, severity, equipment state, or analysis status belong in `metadata_json` or asset metadata.

## Dry Run

The import command should support `--dry-run` so a package can be validated before writing to the database.

Expected dry-run behavior:

- Read and validate JSON.
- Check required fields.
- Check account/post references.
- Report planned creates and updates.
- Avoid DB writes.

## Non-Goals

MVP10 does not implement:

- UI file upload
- multipart/form-data upload
- S3 upload
- asset file automatic copy
- folder watch
- scheduler or Airflow integration
- bot account automatic analysis/generation logic
- metadata filter/search
- advanced asset viewer
- chart/table parsing
- batch management UI
- import result dashboard
- formal authentication, JWT, sessions, or OAuth
- mock mode removal
