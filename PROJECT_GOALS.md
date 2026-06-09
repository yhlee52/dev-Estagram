# PROJECT_GOALS.md

## Project Goal

`feed-prototype` is a Vite + React + TypeScript prototype for a general-purpose, Instagram-like local feed.

The core product model must stay generic so the same feed model can support personal feeds, bot feeds, project feeds, and a future company-internal equipment-report feed without making equipment reports the foundation of the architecture.

Core concepts:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

Do not introduce equipment/report-specific terms into core type names, shared component names, routes, or data flow. Avoid names such as Equipment, Chamber, Sensor, Recipe, Severity, and Report. Domain-specific values belong in `metadata_json`, `post.metadata`, or asset metadata.

## Completed Scope

MVP1-MVP4 established the local/static feed experience:

- Static JSON data and local browser assets.
- Local user entry and local registration.
- Active user state in localStorage.
- User-separated follow state in localStorage.
- Home Feed, Accounts, Account Profile, Post Detail, and Me routes.

MVP5 added the backend/database skeleton:

- FastAPI backend under `feed-prototype/backend/`.
- PostgreSQL target database.
- SQLModel ORM layer.
- Alembic migrations.
- Seed data separate from frontend mock JSON.
- Tables for `users`, `accounts`, `posts`, `post_assets`, and `follows`.

MVP6 added frontend API read mode:

- `mock` and `api` frontend data source modes.
- API-mode backend user selection by id or handle.
- API-mode Home Feed through `GET /api/feed?user_id=...`.
- Read-only API-mode paths for Accounts, Account Profile, and Post Detail.

MVP7 added API-mode follow/unfollow:

- `POST /api/users/{user_id}/follows/{account_id}`
- `DELETE /api/users/{user_id}/follows/{account_id}`
- `GET /api/users/{user_id}/follows`
- Backend persistence in the PostgreSQL `follows` table.

MVP7.5 added API-mode local user/account registration:

- `POST /api/users`
- Creates one backend `User` and exactly one corresponding `Account`.
- Stores the created user as the active API user in localStorage.
- Does not add passwords, sessions, JWT, OAuth, or formal authorization.

MVP8 added API-mode personal post create/delete:

- `POST /api/posts`
- `DELETE /api/posts/{post_id}`
- Creates Posts through the active API user's 1:1 `Account`.
- Deletes only Posts written by the active API user's own 1:1 `Account`.
- Does not let the frontend choose an arbitrary `account_id`.
- Does not add real authentication or a permission system.

## Current MVP: MVP9

MVP9 is named **Post Asset + Metadata Management**.

This MVP combines two previously separate candidates:

- Previous MVP9: asset attach/upload skeleton.
- Previous MVP10: post edit/update + metadata editor.
- Integrated MVP9: Post Asset + Metadata Management.

## MVP9 Goals

MVP9 adds structured asset and metadata management on top of MVP8's API-mode post creation/deletion.

MVP9 should:

- Add `assets`, `tags`, `metadata`, and `updated_at` structure to Posts.
- Extend API-mode post creation so the active API user can include asset information.
- Extend API-mode post creation so the active API user can include tags and metadata.
- Let the active API user edit Posts written by their own 1:1 `Account`.
- Allow editing `title`, `text`, `tags`, `assets`, and `metadata`.
- Store created and edited content in backend PostgreSQL.
- Show the updated Post content in Home Feed, Account Profile, and Post Detail.
- Display asset previews and metadata in PostCard, Post Detail, and Account Profile.
- Show image assets as actual image previews.
- Show plot, table, file, and link assets as placeholders or link cards for this MVP.
- Preserve mock mode and its current localStorage behavior.

## MVP9 Backend API Direction

Existing MVP8 APIs:

```text
POST /api/posts
DELETE /api/posts/{post_id}
```

MVP9 API additions and extensions:

```text
POST /api/posts
PATCH /api/posts/{post_id}
```

`POST /api/posts` should be extended to accept:

```text
user_id
title
text
metadata_json?
tags?
assets?
```

`PATCH /api/posts/{post_id}` should:

```text
accept user_id
accept a payload for title, text, tags, assets, and metadata_json
find the backend User from user_id
find that User's 1:1 Account
check that post.account_id matches that Account
update only Posts written by the selected User's own Account
refresh updated_at
```

The frontend should not offer account selection or submit an arbitrary `account_id` for post creation or editing.

MVP9 ownership checking is prototype ownership checking only:

```text
active API user selection is local prototype state
the backend compares the selected User's 1:1 Account with post.account_id
this is not real login
this is not authentication
this is not authorization
this is not a permission framework
```

## MVP9 Data Concepts

Recommended `Asset` shape:

```text
id
post_id
type
url
title
description
created_at
```

Recommended asset types:

```text
image
plot
table
file
link
```

Recommended `Post` shape:

```text
id
account_id
title
text
created_at
updated_at
tags
metadata_json
assets
```

Asset entries are URL/local path descriptors in MVP9. They are not uploaded files.

## MVP9 Non-Goals

MVP9 should not implement:

```text
real file upload
local file upload
S3 upload
drag and drop upload
image compression or resizing
rich text editor
complex metadata schema validation
metadata-based search or filtering
advanced asset viewer
report template auto generation
bot account auto posting
draft saving
edit history or version history
comments
likes
bookmarks
formal authentication
JWT
sessions
OAuth
permission system
multiple account selection
admin UI
post moderation
mock mode removal
equipment-report-specific core naming
```

## Next MVP Candidates

After MVP9, candidate directions include:

```text
metadata filter/search
advanced asset viewer
report-style post template
local file import/drop-in
bot account auto post generation
```

## Development Principles

- Keep TypeScript build passing.
- Prefer small, focused changes.
- Preserve mock mode unless a task explicitly says otherwise.
- Keep frontend data access behind the selected repository/API mode.
- Keep backend data access behind FastAPI.
- Do not connect the frontend directly to PostgreSQL.
- Keep `User` and `Account` 1:1 during the MVP stage.
- Treat active API user selection as local prototype state, not authentication.
