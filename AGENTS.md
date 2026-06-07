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

MVP1-MVP4 are intentionally local and static. MVP5 begins preparing a future backend and database layer, but it does not replace the current frontend data flow yet.

- Use static JSON data.
- Keep static assets under `public/assets`.
- Do not implement authentication, likes, comments, bookmarks, search, tag pages, notifications, upload flows, frontend file write logic, deployment, or real-time updates.
- MVP3 introduces a local `User` model only for selecting an active local user and separating local state. It is not a login, authentication, authorization, password, token, or account-management system.
- MVP4 introduces a local user entry and local registration flow. It is still not authentication, signup, authorization, password handling, token handling, or a secure session.
- MVP5 introduces the direction for a FastAPI + PostgreSQL + SQLModel + Alembic backend skeleton under `backend/`. It does not convert the frontend to API-backed data.
- A `User` represents the local viewer of the app. An `Account` represents an entity that publishes Posts.
- During the MVP stage, each local `User` should have exactly one corresponding `Account`.
- Active user state should be stored in `localStorage` under `local-feed-active-user-id`.
- Follow state should be lightweight, local, separated by active user, and stored in `localStorage` under `local-feed-following-by-user`.
- New locally registered users, their corresponding accounts, and their initialized follow state should be stored in `localStorage`, not written back to `src/data/*.json`.
- Runtime data should be treated as effective data composed from static JSON data plus localStorage overlays.
- Local users should be stored under `local-feed-local-users`; local accounts should be stored under `local-feed-local-accounts`.
- Clearing browser localStorage can remove locally registered users, accounts, and follow changes.
- The `/me` route should show the active user's local personal area, including connected Accounts and their Posts.

## MVP5 Scope: Backend & DB Skeleton

MVP5 prepares for a future API/DB-backed version while preserving the completed MVP4 local/static frontend behavior.

Planned backend stack:

- FastAPI backend under `backend/`
- PostgreSQL database
- SQLModel ORM / DB layer
- Alembic migrations
- Local file storage under `backend/uploads/` for this MVP stage

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
