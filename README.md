# Instagram-like Local Feed Prototype

This repository contains `feed-prototype`, a Vite + React + TypeScript prototype for a general-purpose Instagram-like feed.

The core domain stays generic:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

Company-internal equipment reports are only one possible future data scenario. Core type names, shared component names, routes, and data flow should not be based on equipment-specific terms such as Equipment, Chamber, Sensor, Recipe, Severity, or Report. Domain-specific values should live in `metadata` or asset metadata.

Detailed MVP6 setup and test steps are documented in:

- `feed-prototype/docs/MVP6_TEST_PROCEDURE.md`

MVP7 follow/unfollow setup and test steps are documented in:

- `feed-prototype/docs/MVP7_TEST_PROCEDURE.md`

## MVP7.5: API Local User/Account Registration

MVP7.5 adds API-mode local user/account registration while preserving the existing mock mode and MVP7 follow/unfollow behavior.

MVP7.5 goals:

- In API mode, if user entry receives a handle that does not match an existing backend `User`, the UI can offer new API user registration.
- When the user chooses registration, the backend creates a new `User` in PostgreSQL.
- During this MVP stage, creating a `User` also creates exactly one corresponding `Account`.
- The frontend stores the created user as the active API user in localStorage.
- After registration, the app enters Home Feed.
- A newly created user may have no followed accounts, so an empty Home Feed is a valid state.
- The new user can use the existing MVP7 follow/unfollow flow from the Accounts screen.

MVP7.5 is not real signup, login, authentication, authorization, or account security. It is a prototype API-mode registration flow for creating local backend `User` and `Account` records and selecting the created user locally.

MVP7.5 adds this backend API endpoint:

- `POST /api/users`

`POST /api/users` policy:

- Accept `handle`.
- Accept `display_name`.
- Accept optional `bio`.
- Normalize `handle` by trimming surrounding whitespace and lowercasing it.
- Require `handle` to be unique.
- Create the `User` and 1:1 `Account` in one transaction.
- Use the user handle as the default account handle.
- Use the user display name as the default account display name.
- The account bio may mirror the user bio.
- Default `account.kind` to `person`.

MVP7.5 does not add passwords, real signup/login, JWT, sessions, OAuth, authorization, email verification, user deletion, account deletion, user profile edit, account edit, post create/update/delete, asset upload, file upload, S3, admin UI, mock mode removal, existing mock local registration removal, or equipment-report-specific core naming.

MVP8 is expected to build on the created API `User` and `Account` records by adding post creation/deletion for those accounts.

## MVP7: API Follow/Unfollow

MVP7 opens a small, intentional write surface for follow state in API mode while preserving the existing mock mode behavior.

MVP7 goals:

- In API mode, the active API user can follow and unfollow accounts.
- Follow/unfollow changes are stored in the backend PostgreSQL `follows` table through FastAPI.
- Home Feed refreshes after a successful follow/unfollow API request.
- Accounts and Account Profile screens support working API-mode follow/unfollow buttons.
- Mock mode keeps the existing localStorage-based follow/unfollow flow.

MVP7 adds these backend API endpoints:

- `POST /api/users/{user_id}/follows/{account_id}`
- `DELETE /api/users/{user_id}/follows/{account_id}`
- `GET /api/users/{user_id}/follows`

MVP7 follow API policy:

- Follow and unfollow should be idempotent where practical.
- Following an already-followed account must not create duplicate `follows` rows.
- Unfollowing an already-unfollowed account should not break the frontend.
- Prefer "API success, then refetch" over optimistic updates for this MVP.
- The frontend may hide or disable the follow button for the active user's own account.

MVP7 does not add new API user/account creation, post writes, asset or file upload, S3, comments, likes, bookmarks, search, tags, real login, passwords, JWT, sessions, OAuth, authorization, admin UI, mock JSON removal, or removal of the MVP4/MVP6 mock mode.

## MVP6: Frontend API Read Mode with API User Entry

MVP6 connects the `feed-prototype` frontend to the backend read-only API so the app can display PostgreSQL seed-data-backed feed content through FastAPI.

MVP6 adds an API data source mode alongside the existing mock mode.

```text
mock mode = frontend mock JSON + local assets + MVP4 localStorage overlays
api mode = FastAPI read-only API + PostgreSQL seed data + active API user selection
```

Mock mode remains the local/static experience from MVP1-MVP4. It keeps frontend mock JSON, MVP4 local user entry, local registration, active local user state, and local follow overlays.

API mode is additive. It reads backend data through FastAPI endpoints and does not remove or replace the mock mode data flow.

In API mode, user entry is not real login or authentication. The user enters an id or handle for a `User` that already exists in the backend database. If a matching backend user is found, the frontend stores that selection as the active API user in localStorage and reads that user's feed from the backend API. If no matching backend user exists, the UI explains that API mode can only use users already present in the backend database.

MVP6 does not create users, accounts, posts, follows, or assets. It does not add passwords, JWT, session cookies, OAuth, authorization, write APIs, follow/unfollow APIs, upload APIs, S3, admin UI, comments, likes, bookmarks, search, tags, deployment, or a combined frontend/backend server.

MVP6 completion criteria:

- The frontend can be configured for mock mode or API mode.
- Mock mode continues to work with existing MVP4 local user entry and local registration.
- API mode can find an existing backend user by id or handle.
- API mode stores the selected active API user locally without treating it as an authenticated session.
- API mode calls the FastAPI read-only feed endpoint for the selected user.
- Home Feed displays backend PostgreSQL seed data through the API.
- Loading, error, and empty states are clear in API mode.
- Accounts, Profile, and Post Detail support read-only API mode within the current backend API surface.
- The frontend build passes from `feed-prototype/`.

## MVP5: Backend & DB Skeleton

MVP5 prepares the project for a future API/DB-backed version while preserving the completed MVP1-MVP4 local/static frontend behavior.

Backend stack:

```text
Backend: FastAPI
Database: PostgreSQL
ORM / DB layer: SQLModel
Migration: Alembic
File storage: feed-prototype/backend/uploads/ local folder
Backend path: feed-prototype/backend/
```

Backend tables:

- `users`
- `accounts`
- `posts`
- `post_assets`
- `follows`

Read-only API surface:

- `GET /health`
- `GET /api/users`
- `GET /api/accounts`
- `GET /api/posts`
- `GET /api/follows`
- `GET /api/feed?user_id=...`

MVP5 data policy:

- Keep the existing frontend mock JSON files.
- Keep the MVP4 localStorage-based local user entry, local registration, active user, and follow flows.
- Backend seed data is separate from frontend mock JSON and used for PostgreSQL verification.
- Do not commit a real PostgreSQL database. DB state should be reproducible from migrations plus seed scripts.

MVP5 does not add real login/authentication, write APIs, admin UI, upload APIs, S3 integration, comments, likes, bookmarks, search, tag pages, or equipment-report-specific core naming.

Backend-specific notes are documented in `feed-prototype/backend/README.md`.

## MVP4: Local User Entry & Registration Flow

MVP4 adds a local user entry flow so the app can start from "my id" without adding a backend, database, or authentication system.

Users can enter a local user id or handle. If it matches an existing effective `User`, that user becomes the active user and the app opens the feed shell. If it does not match, the app offers local registration.

Local registration creates a new `User` and a 1:1 corresponding `Account`. These local records are stored in `localStorage`; the app does not write to `src/data/*.json` at runtime. The new user's follow state is initialized in `localStorage`, and the active user remains stored after refresh.

The runtime data model for MVP4 is effective data:

```text
effective users = static users.json + localStorage user overlay
effective accounts = static accounts.json + localStorage account overlay
effective follow state = static follows.json + localStorage follow overlay
```

MVP4 localStorage keys:

```text
active user id = local-feed-active-user-id
local users = local-feed-local-users
local accounts = local-feed-local-accounts
user follow state = local-feed-following-by-user
```

`Logout` and `Switch user` are local prototype actions. They clear the active local user id and return to the local user entry screen; they do not end a secure session. If browser localStorage is cleared, locally registered users, accounts, and follow changes can disappear.

MVP4 still does not implement real login, signup, passwords, auth tokens, secure sessions, authorization, backend APIs, databases, JSON file writes, post creation/editing/deletion, comments, likes, bookmarks, search, tag aggregation, or tag pages.

## Data Files

Initial frontend mock data lives under `feed-prototype/src/data`.

- `users.json`: local `User` records and each user's connected account id
- `accounts.json`: publishing `Account` records
- `posts.json`: `Post` records published by accounts
- `follows.json`: initial per-user follow state

Static browser assets are referenced as public paths such as `/assets/...`. Missing asset files should degrade through UI fallback states rather than changing the core feed model.

## Git Policy

Generated or local-only files should not be committed:

- `node_modules`
- `dist`
- backend `.env`
- frontend `.env`
- real PostgreSQL DB data or dumps
- uploaded local files except intentional placeholders
