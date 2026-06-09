# Instagram-like Local Feed Prototype

This repository contains `feed-prototype`, a Vite + React + TypeScript prototype for a general-purpose Instagram-like feed.

The project is intentionally generic. A future company-internal equipment-report feed is one possible use case, but the core product model is not equipment-specific.

Core domain concepts:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

Avoid equipment/report-specific names in core models, shared components, routes, and data flow. Do not base core architecture on names such as Equipment, Chamber, Sensor, Recipe, Severity, or Report. When scenario-specific information is needed, keep it as `post.metadata`, `metadata_json`, or asset metadata values.

## Current Status

Completed MVPs:

- MVP1-MVP4: local/static feed prototype, local user entry, local registration, active user state, and local follow overlays.
- MVP5: FastAPI + PostgreSQL + SQLModel + Alembic backend/database skeleton under `feed-prototype/backend/`.
- MVP6: frontend API read mode while preserving mock mode.
- MVP7: API-mode follow/unfollow writes through FastAPI and the PostgreSQL `follows` table.
- MVP7.5: API-mode local user/account registration through FastAPI.
- MVP8: API-mode personal post create/delete for the active API user's 1:1 account.
- MVP9: post asset + metadata management, including tags, asset descriptors, metadata editing, and owned post editing in API mode.

API mode uses a locally selected backend `User`. This is not real login or authentication. During the MVP stage, each `User` has exactly one corresponding `Account`, and post ownership checks compare the selected user's 1:1 account with the target post's `account_id`.

Mock mode remains available and continues to use frontend mock JSON, local assets, and localStorage overlays.

## MVP9: Post Asset + Metadata Management

MVP9 combines the previously separate MVP9 and MVP10 candidates:

- previous MVP9: asset attach/upload skeleton
- previous MVP10: post edit/update + metadata editor
- integrated MVP9: Post Asset + Metadata Management

MVP9 builds on MVP8 by adding asset descriptors, tags, metadata editing, `updated_at`, and owned post editing in API mode.

MVP9 goals:

- Add `assets`, `tags`, `metadata`, and `updated_at` structure to Posts.
- Let the active API user enter asset information when creating a Post.
- Let the active API user enter tags and metadata when creating a Post.
- Let the active API user edit Posts written by their own 1:1 Account.
- Allow editing `title`, `text`, `tags`, `assets`, and `metadata`.
- Store created and edited content in the backend PostgreSQL database.
- Show updated Posts in Home Feed, Account Profile, and Post Detail.
- Show asset previews and metadata in PostCard, Post Detail, and Account Profile.
- Render image assets as image previews.
- Render plot, table, file, and link assets as placeholders or link cards for this MVP.
- Preserve mock mode behavior.

MVP9 backend API candidates:

- Extend `POST /api/posts`
- Add `PATCH /api/posts/{post_id}`

Existing MVP8 APIs remain:

- `POST /api/posts`
- `DELETE /api/posts/{post_id}`

Recommended MVP9 API policy:

- `POST /api/posts` accepts `user_id`, `title`, `text`, optional `metadata_json`, plus optional `tags` and `assets`.
- `PATCH /api/posts/{post_id}` accepts `user_id` and an update payload.
- The backend resolves the selected `User` from `user_id`, finds that user's 1:1 `Account`, and compares it with `post.account_id`.
- Only Posts written by the selected user's own 1:1 Account can be edited.
- The frontend must not select or submit an arbitrary `account_id` for post creation or editing.
- This ownership check is MVP prototype behavior, not formal authentication or authorization.
- Asset entries store URL or local path strings only; MVP9 does not upload files.

Recommended asset type values:

- `image`
- `plot`
- `table`
- `file`
- `link`

Recommended `Asset` fields:

- `id`
- `post_id`
- `type`
- `url`
- `title`
- `description`
- `created_at`

Recommended `Post` fields:

- `id`
- `account_id`
- `title`
- `text`
- `created_at`
- `updated_at`
- `tags`
- `metadata_json`
- `assets`

MVP9 non-goals:

- Real file upload
- Local file upload
- S3 upload
- Drag and drop upload
- Image compression or resizing
- Rich text editor
- Complex metadata schema validation
- Metadata search or filtering
- Advanced asset viewer
- Report template generation
- Bot account auto posting
- Draft saving
- Edit history or version history
- Comments, likes, or bookmarks
- Formal authentication, JWT, sessions, or OAuth
- Permission system
- Multiple account selection
- Admin UI
- Post moderation
- Mock mode removal

Next MVP candidates:

- Metadata filter/search
- Advanced asset viewer
- Report-style post template
- Local file import/drop-in
- Bot account auto post generation

## MVP10: External Post Ingestion Pipeline

MVP10 is named **External Post Ingestion Pipeline**.

MVP10 is not a UI feature for directly creating Posts. Its goal is to let an external analysis program or post generation program create a JSON-based post package, then import that package into the backend database so the existing UI can display imported Posts like ordinary Posts.

MVP10 target flow:

```text
external analysis/post generation program
  -> post JSON package
  -> image/plot/table/file assets written by that program
  -> import package placed under data/external_posts/incoming
  -> import script reads JSON
  -> backend DB upserts accounts, posts, assets, and metadata
  -> UI reads the DB and displays imported posts like normal posts
```

MVP10 goals:

- Define an external post import JSON format.
- Let an import script read JSON and upsert `Account`, `Post`, `Asset`, and `metadata_json` data into the backend database.
- Use `external_id` based upsert so importing the same JSON repeatedly does not keep creating duplicate Posts.
- Provide `--dry-run` validation before writing to the database.
- Keep test databases and operational/update databases separable by changing `.env` or `DATABASE_URL`.
- Store only UI-accessible asset URLs or paths from JSON.
- Do not copy asset files in MVP10.
- Keep imported Posts in the same generic DB structure as Posts created through the UI.
- Keep equipment-, recipe-, chamber-, or severity-like scenario values inside `metadata_json`, not in core model or component names.

Recommended external post package directory:

```text
feed-prototype/
  data/
    external_posts/
      README.md
      examples/
        feed_import_sample.json
      incoming/
      archive/
      failed/
```

MVP10 non-goals:

- UI file upload
- multipart/form-data upload
- S3 upload
- asset file auto-copy
- folder watch
- scheduler or Airflow integration
- bot account automatic analysis or generation logic
- metadata filter/search
- advanced asset viewer
- chart/table parsing
- batch management UI
- import result dashboard
- formal authentication, JWT, sessions, or OAuth
- mock mode removal

## Data And Storage

Frontend mock data lives under `feed-prototype/src/data`.

Static browser assets live under `feed-prototype/public/assets`.

External post import packages for MVP10 live under `feed-prototype/data/external_posts`.

Important localStorage keys:

- `local-feed-active-user-id`
- `local-feed-following-by-user`
- `local-feed-local-users`
- `local-feed-local-accounts`

Backend code lives under `feed-prototype/backend/`. Backend state should be reproducible from migrations plus seed scripts; do not commit real PostgreSQL database files or dumps.

## Development

Run frontend build verification from the Vite app directory:

```bash
cd feed-prototype
npm run build
```

Backend setup and run notes are documented in `feed-prototype/backend/README.md`.
