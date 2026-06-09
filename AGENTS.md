# AGENTS.md

## Project Identity

This project is `feed-prototype`, a Vite + React + TypeScript prototype for a general-purpose, Instagram-like local feed.

The codebase should stay generic enough to support personal feeds, bot feeds, project feeds, and a future company-internal equipment-report feed. The core product model is not equipment-specific.

## Core Domain

Use these generic concepts for core types, shared components, routes, and data flow:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

Do not introduce equipment-report-specific terms into core type names or primary component names. Avoid names such as:

- Equipment
- Chamber
- Sensor
- Recipe
- Severity
- Report

When equipment-report-specific information is needed, represent it as `post.metadata`, `metadata_json`, or asset metadata. Keep domain-specific values as data, not as the foundation of the app architecture.

## Current Implementation Scope

MVP1-MVP4 are local/static. MVP5 added a backend/database skeleton. MVP6 added frontend API read mode while preserving mock mode. MVP7 added API-mode follow/unfollow writes. MVP7.5 added API-mode local user/account registration. MVP8 added API-mode personal post create/delete. MVP9 added post asset + metadata management.

Current constraints:

- Mock mode remains available.
- Static frontend mock data remains under `feed-prototype/src/data`.
- Static browser assets remain under `feed-prototype/public/assets`.
- Runtime mock-mode overlays are stored in localStorage.
- API mode uses FastAPI and backend PostgreSQL data.
- The frontend must not connect directly to PostgreSQL.
- During the MVP stage, each `User` has exactly one corresponding `Account`.
- An active API user is selected from backend DB users and stored locally.
- Active API user selection is not real login, authentication, authorization, or account security.

Important localStorage keys:

- `local-feed-active-user-id`
- `local-feed-following-by-user`
- `local-feed-local-users`
- `local-feed-local-accounts`

## Completed MVP Summary

MVP5 backend/database skeleton:

- FastAPI backend under `feed-prototype/backend/`.
- PostgreSQL target database.
- SQLModel ORM / DB layer.
- Alembic migrations.
- Tables for `users`, `accounts`, `posts`, `post_assets`, and `follows`.
- Backend seed data separate from frontend mock JSON.

MVP6 frontend API read mode:

- Frontend data source mode for `mock` and `api`.
- API-mode user selection by id or handle.
- API-mode feed read through `GET /api/feed?user_id=...`.
- Accounts, Account Profile, and Post Detail have API-mode read paths.

MVP7 API follow/unfollow:

- `POST /api/users/{user_id}/follows/{account_id}`
- `DELETE /api/users/{user_id}/follows/{account_id}`
- `GET /api/users/{user_id}/follows`
- Follow state is stored in the backend `follows` table in API mode.
- Mock mode keeps localStorage follow state.

MVP7.5 API local user/account registration:

- `POST /api/users`
- Creates one backend `User` and one corresponding `Account`.
- Stores the created active API user in localStorage.
- Does not add passwords, login, sessions, tokens, OAuth, or authorization.

MVP8 personal post create/delete:

- `POST /api/posts`
- `DELETE /api/posts/{post_id}`
- Creates posts through the active API user's 1:1 `Account`.
- Deletes only posts written by the active API user's own account.
- Does not allow frontend account selection.
- Uses prototype ownership checking, not real authentication or authorization.

MVP9 post asset + metadata management:

- Adds `assets`, `tags`, `metadata_json`, and `updated_at` structure to Posts.
- Lets API-mode post creation include tags, metadata, and asset URL/path descriptors.
- Lets the active API user edit Posts written by their own 1:1 `Account`.
- Shows created/edited content, asset previews, and metadata in Home Feed, Account Profile, and Post Detail.
- Keeps mock mode behavior unchanged.

## Previous MVP9 Scope: Post Asset + Metadata Management

MVP9 combines the previously separate MVP9 and MVP10 candidates:

- Previous MVP9: asset attach/upload skeleton.
- Previous MVP10: post edit/update + metadata editor.
- Integrated MVP9: Post Asset + Metadata Management.

MVP9 goals:

- Add `assets`, `tags`, `metadata`, and `updated_at` structure to Posts.
- In API mode, let the active API user include asset information when creating a Post.
- In API mode, let the active API user include tags and metadata when creating a Post.
- In API mode, let the active API user edit Posts written by their own 1:1 `Account`.
- Allow editing `title`, `text`, `tags`, `assets`, and `metadata`.
- Store created and edited content in backend PostgreSQL.
- Show created/edited content in Home Feed, Account Profile, and Post Detail.
- Show asset previews and metadata in PostCard, Post Detail, and Account Profile.
- Display image assets as actual image previews.
- Display plot, table, file, and link assets as placeholders or link cards for MVP9.
- Keep mock mode behavior unchanged.

MVP9 backend API direction:

- Extend `POST /api/posts`.
- Add `PATCH /api/posts/{post_id}`.
- Keep `DELETE /api/posts/{post_id}` from MVP8.

MVP9 API policy:

- `POST /api/posts` should accept `user_id`, `title`, `text`, optional `metadata_json`, optional `tags`, and optional `assets`.
- `PATCH /api/posts/{post_id}` should accept `user_id` and a payload for `title`, `text`, `tags`, `assets`, and `metadata_json`.
- The backend must resolve the selected `User` from `user_id`.
- The backend must find that user's 1:1 `Account`.
- Post create and edit must use the resolved account; the frontend must not choose `account_id`.
- Post edit must only update posts whose `post.account_id` matches the selected user's 1:1 account.
- This is MVP ownership checking only. Do not add real authentication or a formal permission system.
- Assets are URL/local path descriptors only. Do not implement real upload in MVP9.

Recommended `Asset` fields:

- `id`
- `post_id`
- `type`
- `url`
- `title`
- `description`
- `created_at`

Recommended asset types:

- `image`
- `plot`
- `table`
- `file`
- `link`

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

- Real file upload.
- Local file upload.
- S3 upload.
- Drag and drop upload.
- Image compression or resizing.
- Rich text editor.
- Complex metadata schema validation.
- Metadata search or filtering.
- Advanced asset viewer.
- Report template generation.
- Bot account auto posting.
- Draft saving.
- Edit history or version history.
- Comments, likes, or bookmarks.
- Formal authentication, JWT, sessions, or OAuth.
- Permission system.
- Multiple account selection.
- Admin UI.
- Post moderation.
- Mock mode removal.
- Equipment-report-specific core type names, component names, routes, or data flow.

Next MVP candidates:

- Metadata filter/search.
- Advanced asset viewer.
- Report-style post template.
- Local file import/drop-in.
- Bot account auto post generation.

## Current MVP10 Scope: External Post Ingestion Pipeline

MVP10 is named **External Post Ingestion Pipeline**.

MVP10 is not a UI post creation feature. The goal is to let an external analysis program or post generation program create a JSON-based post package, then import that package into the backend DB so the UI can display imported Posts like ordinary Posts.

MVP10 flow:

- External program generates post JSON.
- External program generates image, plot, table, or file assets.
- The package is placed under `feed-prototype/data/external_posts/incoming`.
- An import script reads the JSON.
- The import script validates the package, with `--dry-run` support before DB writes.
- The import script upserts `Account`, `Post`, `Asset`, and `metadata_json` data into the backend PostgreSQL DB.
- UI reads imported data through existing API-mode paths and displays it like normal feed content.

MVP10 data policy:

- Use generic core concepts: User, Account, Post, Feed, Follow, Asset, Metadata.
- Use `external_id` based upsert for imported accounts, posts, and assets.
- Re-importing the same JSON must not keep creating duplicate Posts.
- Store only UI-accessible asset URLs or paths in the DB.
- Do not copy asset files in MVP10.
- Test DB and operational/update DB can be separated by changing `.env` or `DATABASE_URL`.
- Keep domain-specific values such as recipe, chamber, severity, equipment state, or analysis result inside `metadata_json` or asset metadata.

Recommended MVP10 directory structure:

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

MVP10 JSON package shape:

- `batch.external_id` is required.
- `batch.source` and `batch.created_at` are optional.
- `accounts[].external_id` is the account upsert key.
- `accounts[].handle` and `accounts[].display_name` are the UI-facing account fields.
- `posts[].external_id` is the post upsert key.
- `posts[].account_external_id` connects a post to an imported account.
- `posts[].metadata_json` stores domain-specific values.
- `posts[].assets[]` stores asset URL/path descriptors.
- Allowed asset types are `image`, `plot`, `table`, `file`, and `link`.

MVP10 non-goals:

- UI file upload.
- Multipart/form-data upload.
- S3 upload.
- Asset file automatic copy.
- Folder watch.
- Scheduler or Airflow integration.
- Bot account automatic analysis or generation logic.
- Metadata filter/search.
- Advanced asset viewer.
- Chart/table parsing.
- Batch management UI.
- Import result dashboard.
- Formal authentication, JWT, sessions, or OAuth.
- Mock mode removal.

## Development Guidelines

- Keep the TypeScript build passing.
- Prefer small, focused changes.
- Avoid unnecessary large refactors.
- Follow existing project patterns before adding new abstractions.
- Keep components and types reusable for general feeds and future company-internal report feeds.
- Treat equipment-report examples as one possible data scenario, not as the core domain.
- Do not remove mock mode while implementing API-mode features.
- Do not add passwords, JWT, sessions, OAuth, or a formal authorization system unless a future MVP explicitly changes scope.
- Do not implement frontend file write logic or actual upload flows in MVP10.

## Verification

After code changes, run the project build from the Vite app directory:

```bash
npm run build
```

The build should pass before handing work back after implementation changes.
