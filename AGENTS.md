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

This stage is intentionally local and static.

- Use static JSON data.
- Keep static assets under `public/assets`.
- Do not implement a backend, database, authentication, likes, comments, bookmarks, search, tag pages, notifications, upload flows, file write logic, deployment, or real-time updates.
- MVP3 introduces a local `User` model only for selecting an active local user and separating local state. It is not a login, authentication, authorization, password, token, or account-management system.
- MVP4 introduces a local user entry and local registration flow. It is still not authentication, signup, authorization, password handling, token handling, or a secure session.
- A `User` represents the local viewer of the app. An `Account` represents an entity that publishes Posts.
- During the MVP stage, each local `User` should have exactly one corresponding `Account`.
- Active user state should be stored in `localStorage` under `local-feed-active-user-id`.
- Follow state should be lightweight, local, separated by active user, and stored in `localStorage` under `local-feed-following-by-user`.
- New locally registered users, their corresponding accounts, and their initialized follow state should be stored in `localStorage`, not written back to `src/data/*.json`.
- Runtime data should be treated as effective data composed from static JSON data plus localStorage overlays.
- The `/me` route should show the active user's local personal area, including connected Accounts and their Posts.

## MVP4 Scope: Local User Entry & Registration Flow

MVP4 should support a natural local entry flow before the feed is shown:

- If there is no active user, show a User Entry screen.
- Let the user enter an id or handle.
- If the entered id or handle matches an existing effective user, set that user as the active user.
- If no matching user exists, guide the user into local registration.
- Local registration creates a new `User` and a 1:1 corresponding `Account`.
- The new local user/account is stored in `localStorage`.
- The new local user's follow state is initialized in `localStorage`.
- The active user remains stored in `localStorage` after refresh.
- Provide logout and switch user flows. In this prototype, logout only clears the active local user.

Prefer terms such as local user entry, local registration, active user, switch user, and logout. Avoid naming code or documentation as if real auth/security exists.

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
