# AGENTS.md

## Project Identity

This project is a Vite + React + TypeScript prototype for a general-purpose, Instagram-like local feed.

The first goal is a small local feed experience built from static data and local assets. The codebase should stay general enough that the same feed model can later support an internal company equipment-report feed, but the core product model is not equipment-specific.

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

When equipment-report-specific information is needed, represent it as `post.metadata` or asset metadata. Keep domain-specific values as data, not as the foundation of the app architecture.

## Current Implementation Scope

MVP1-MVP4 are intentionally local and static. MVP5 adds a backend/database skeleton. MVP6 adds a frontend API read mode while preserving the mock mode. MVP7 adds an API-mode follow/unfollow write path while keeping mock mode follow state local. MVP7.5 adds API-mode local user/account registration while keeping it separate from real authentication.

- Use static JSON data.
- Keep static assets under `public/assets`.
- Do not implement authentication, likes, comments, bookmarks, search, tag pages, notifications, upload flows, frontend file write logic, deployment, or real-time updates.
- MVP3 introduces a local `User` model only for selecting an active local user and separating local state. It is not a login, authentication, authorization, password, token, or account-management system.
- MVP4 introduces a local user entry and local registration flow. It is still not authentication, signup, authorization, password handling, token handling, or a secure session.
- MVP5 introduces the direction for a FastAPI + PostgreSQL + SQLModel + Alembic backend skeleton under `feed-prototype/backend/`. It does not convert the frontend to API-backed data.
- MVP6 introduces API mode so the frontend can read backend seed data through FastAPI. Mock mode and the MVP4 localStorage-based local user flow must remain available.
- MVP7 introduces API-mode follow/unfollow writes through FastAPI and stores those changes in the PostgreSQL `follows` table. Mock mode must keep using localStorage follow state.
- MVP7.5 introduces API-mode local user/account registration through FastAPI. It creates backend `User` and 1:1 `Account` records, stores the created active API user in localStorage, and still does not add passwords, login, sessions, tokens, or authorization.
- A `User` represents the local viewer of the app. An `Account` represents an entity that publishes Posts.
- During the MVP stage, each local `User` should have exactly one corresponding `Account`.
- Active user state should be stored in `localStorage` under `local-feed-active-user-id`.
- Follow state should be lightweight, local, separated by active user, and stored in `localStorage` under `local-feed-following-by-user`.
- New locally registered users, their corresponding accounts, and their initialized follow state should be stored in `localStorage`, not written back to `src/data/*.json`.
- Runtime data should be treated as effective data composed from static JSON data plus localStorage overlays.
- Local users should be stored under `local-feed-local-users`; local accounts should be stored under `local-feed-local-accounts`.
- Clearing browser localStorage can remove locally registered users, accounts, and follow changes.
- The `/me` route should show the active user's local personal area, including connected Accounts and their Posts.

## MVP7.5 Scope: API Local User/Account Registration

MVP7.5 lets API mode create a new backend `User` and a corresponding 1:1 `Account`.

MVP7.5 goals:

- In API mode, if user entry receives a handle that does not match an existing backend `User`, offer new API user registration.
- When the user chooses registration, create a backend `User`.
- Create exactly one corresponding backend `Account` in the same registration flow.
- Store the created `User` as the active API user in localStorage.
- Enter Home Feed after registration.
- Treat an empty Home Feed as valid for a newly created user with no followed accounts.
- Keep existing MVP7 Accounts follow/unfollow behavior available for the newly created user.
- Keep mock mode and the existing mock local registration flow available.

MVP7.5 backend API:

- `POST /api/users`

`POST /api/users` policy:

- Accept `handle`.
- Accept `display_name`.
- Accept optional `bio`.
- Normalize `handle` by trimming surrounding whitespace and lowercasing it.
- Require `handle` to be unique.
- Create `User` and `Account` in one transaction.
- Set `account.handle` to the user handle by default.
- Set `account.display_name` to the user display name by default.
- Let `account.bio` mirror `user.bio` if provided.
- Default `account.kind` to `"person"`.

API local user/account registration is not authentication:

- Do not add passwords.
- Do not add real signup/login security semantics.
- Do not add JWT.
- Do not add session cookies.
- Do not add OAuth.
- Do not add authorization or permission checks.
- Do not add email verification.

MVP7.5 non-goals:

- Passwords.
- Real signup/login.
- JWT, sessions, OAuth, authorization, or permission systems.
- Email verification.
- User deletion.
- Account deletion.
- User profile edit.
- Account edit.
- Post create/update/delete.
- Asset upload, file upload, or S3.
- Admin UI.
- Removing frontend mock JSON.
- Removing existing mock local registration.
- Removing MVP4/MVP6/MVP7 mock mode behavior.
- Equipment-report-specific core type names, component names, routes, or data flow.

MVP8 is expected to build on MVP7.5 by adding post creation/deletion for created API users and accounts.

## MVP7 Scope: API Follow/Unfollow

MVP7 lets the active API user follow and unfollow accounts in API mode.

MVP7 goals:

- In API mode, the active backend `User` can follow an `Account`.
- In API mode, the active backend `User` can unfollow an `Account`.
- Follow/unfollow results are stored in the backend PostgreSQL `follows` table.
- Home Feed is refreshed after successful follow/unfollow.
- Accounts and Account Profile screens have working API-mode follow/unfollow buttons.
- Mock mode keeps the existing localStorage-based follow/unfollow behavior.

MVP7 backend API:

- `POST /api/users/{user_id}/follows/{account_id}`
- `DELETE /api/users/{user_id}/follows/{account_id}`
- `GET /api/users/{user_id}/follows`

MVP7 API behavior policy:

- Follow API behavior should be idempotent where practical.
- Re-following an already-followed account must not create duplicate rows.
- Unfollowing an already-unfollowed account should not break the frontend.
- Prefer "API success, then refetch" over optimistic updates.
- The frontend may hide or disable the follow button for the active user's own account.

MVP7 non-goals:

- New API user/account creation.
- Post create/update/delete.
- Asset upload, file upload, or S3.
- Comments, likes, bookmarks, search, or tag pages.
- Real login, passwords, JWT, sessions, OAuth, authorization, or permission systems.
- Admin UI.
- Removing frontend mock JSON.
- Removing MVP4/MVP6 mock mode.
- Equipment-report-specific core type names, component names, routes, or data flow.

## MVP6 Scope: Frontend API Read Mode with API User Entry

MVP6 connects the frontend to backend read-only APIs while preserving the completed local/static prototype behavior.

MVP6 goals:

- Add a frontend data source mode for `mock` and `api`.
- Keep existing frontend mock JSON and MVP4 local user entry/local registration in mock mode.
- In API mode, let the user select a backend `User` by id or handle.
- Store the selected active API user in localStorage.
- Fetch the selected user's feed with `GET /api/feed?user_id=...`.
- Display PostgreSQL seed-data-backed feed content through the FastAPI backend.
- Keep the frontend disconnected from PostgreSQL; all backend data access goes through FastAPI.

API user entry is not authentication:

- Do not add passwords.
- Do not add JWT.
- Do not add session cookies.
- Do not add OAuth.
- Do not add authorization or permission checks.
- Do not treat API user selection as secure account login.
- If an id or handle does not exist in the backend DB, show guidance that API mode only supports existing database users.
- Do not create users from API mode in MVP6.

MVP6 non-goals:

- Removing frontend mock JSON.
- Removing MVP4 localStorage local user flows.
- Real login, signup, authentication, sessions, JWT, OAuth, or authorization.
- Write APIs, follow/unfollow APIs, post/account create/update/delete, or frontend file writes.
- File upload, S3 integration, admin UI, comments, likes, bookmarks, search, tag pages, production deployment, or a combined frontend/backend server.
- Equipment-report-specific core type names, component names, routes, or data flow.

MVP6 completion criteria:

- Mock mode still works as before.
- API mode can select an existing backend user and persist that selection locally.
- API mode renders Home Feed from `GET /api/feed?user_id=...`.
- API mode has understandable loading, error, and empty states.
- Accounts, Profile, and Post Detail have a read-only API-mode path.
- `npm run build` passes from `feed-prototype/`.

## MVP5 Scope: Backend & DB Skeleton

MVP5 prepares for a future API/DB-backed version while preserving the completed MVP4 local/static frontend behavior.

Planned backend stack:

- FastAPI backend under `feed-prototype/backend/`
- PostgreSQL database
- SQLModel ORM / DB layer
- Alembic migrations
- Local file storage under `feed-prototype/backend/uploads/` for this MVP stage

Planned tables:

- `users`
- `accounts`
- `posts`
- `post_assets`
- `follows`

Planned read-only API:

- `GET /health`
- `GET /api/users`
- `GET /api/accounts`
- `GET /api/posts`
- `GET /api/follows`
- `GET /api/feed?user_id=...`

MVP5 data policy:

- Keep existing frontend mock JSON.
- Keep MVP4 localStorage user, account, active user, and follow overlays.
- Keep `User` and `Account` 1:1 during the MVP stage.
- Backend seed data should be separate from frontend mock JSON and used for PostgreSQL verification.
- Do not commit a real PostgreSQL database; recreate DB state from migrations plus seed scripts.

MVP5 should not add real login/authentication, write APIs, admin UI, upload APIs, S3 integration, frontend API migration, frontend mock JSON removal, comments, likes, bookmarks, search, tag pages, or equipment-report-specific core naming.

## MVP4 Scope: Local User Entry & Registration Flow

MVP4 supports a natural local entry flow before the feed is shown:

- If there is no active user, show a User Entry screen.
- Let the user enter an id or handle.
- If the entered id or handle matches an existing effective user, set that user as the active user.
- If no matching user exists, guide the user into local registration.
- Local registration creates a new `User` and a 1:1 corresponding `Account`.
- The new local user/account is stored in `localStorage`.
- The new local user's follow state is initialized in `localStorage`.
- The active user remains stored in `localStorage` after refresh.
- Provide logout and switch user flows. In this prototype, logout only clears the active local user.

Prefer terms such as local user entry, local registration, active user, switch user, and logout. Avoid naming code or documentation as if real auth/security exists. `Logout` is allowed as a UI action, but it must be documented and implemented as clearing `local-feed-active-user-id`, not ending an authenticated session.

## Development Guidelines

- Keep the TypeScript build passing at all times.
- Prefer small, focused changes.
- Avoid unnecessary large refactors.
- Follow existing project patterns before adding new abstractions.
- Keep components and types reusable for both general personal feeds and future company-internal report feeds.
- Treat equipment-report examples as one possible data scenario, not as the core domain.

## Verification

After code changes, run the project build from the Vite app directory:

```bash
npm run build
```

The build should pass before handing work back.
