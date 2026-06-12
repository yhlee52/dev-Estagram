# feed-prototype v0.0.0

`feed-prototype` is a Vite + React + TypeScript local/internal prototype for an Instagram-like generic feed.

`v0.0.0` is the first shareable baseline release. It can demo both a general SNS-like feed and externally generated analysis/report-style feed content, but it is not production-ready.

## Release Meaning

- Release name: `v0.0.0`
- Scope: first internal/local prototype release
- Product stance: generic feed model, not an equipment-report-specific app
- Production status: prototype only
- Auth status: no password, JWT, session, OAuth, or formal permission system

## Core Domain

The core product model stays generic:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

Do not introduce equipment-report-specific names such as `Equipment`, `Chamber`, `Sensor`, `Recipe`, `Severity`, or `Report` into core models, shared components, routes, or data flow. Scenario-specific values belong in `metadata_json`, `post.metadata`, or asset metadata.

## v0.0.0 Feature Baseline

This release includes work completed through MVP12:

- MVP5-MVP7.5: FastAPI backend, PostgreSQL schema, API read mode, user/account registration, follow/unfollow
- MVP8: API-mode personal post create/edit/delete through the active user's 1:1 Account
- MVP9: post tags, metadata, asset descriptors, and owned post editing
- MVP10: external JSON post package import pipeline
- MVP11: API-mode keyword, tag, metadata, asset type, account, and my-post filters
- MVP12: asset viewer enhancement for image/plot thumbnails, lightbox navigation, CSV table preview, file/link cards, and graceful broken-asset fallback

## Modes

`mock` mode uses frontend mock JSON plus localStorage overlay. It needs no backend and is useful for quick UI demos.

`api` mode uses FastAPI and PostgreSQL. It supports backend users/accounts/posts/follows, API-mode post writes, filtering, and imported external posts.

External import mode is not a third frontend mode. It is a backend CLI workflow that reads JSON packages from `feed-prototype/data/external_posts`, upserts them into PostgreSQL, and then displays them through the existing API-mode UI.

## Quick Start

See the app README for the runnable path:

```text
feed-prototype/README.md
```

Useful release docs:

```text
feed-prototype/docs/RELEASE_CHECKLIST_v0.0.0.md
feed-prototype/docs/SMOKE_TEST_v0.0.0.md
feed-prototype/data/external_posts/README.md
feed-prototype/docs/MVP10_EXTERNAL_POST_FORMAT.md
```

## Data Locations

- Frontend mock data: `feed-prototype/src/data`
- Static browser assets: `feed-prototype/public/assets`
- External post packages: `feed-prototype/data/external_posts`
- Backend code: `feed-prototype/backend`
- Backend DB state: PostgreSQL, reproduced by Alembic migration, seed, and import scripts

Do not commit local `.env` files, database dumps, or local PostgreSQL data.

## Verification

Before handoff, run the frontend build from the Vite app directory:

```bash
cd feed-prototype
npm run build
```
