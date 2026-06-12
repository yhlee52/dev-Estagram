# v0.0.0 Release Checklist

`v0.0.0` is the first shareable internal/local prototype release of `feed-prototype`.

It is not production-ready. It has no formal authentication, authorization, JWT, session, OAuth, role system, or production file storage.

## Release Scope

- [ ] Release version is `v0.0.0`.
- [ ] `feed-prototype/package.json` version is `0.0.0`.
- [ ] The app UI shows `v0.0.0`.
- [ ] README explains the release meaning and prototype limitations.
- [ ] README documents mock mode, API mode, and external import mode.
- [ ] `.env.example` files document local defaults.
- [ ] External post package guide documents MVP12 `asset.sort_order`.
- [ ] General SNS-like samples are identified.
- [ ] Analysis/report-style external import samples are identified.
- [ ] Smoke test procedure is documented.

## Generic Domain Check

- [ ] Core model/component/route/data-flow names stay generic.
- [ ] Core concepts are User, Account, Post, Feed, Follow, Asset, and Metadata.
- [ ] No new core architecture names use Equipment, Chamber, Sensor, Recipe, Severity, or Report.
- [ ] Scenario-specific values remain in `metadata_json` or asset metadata.

## Mock Mode Check

- [ ] `VITE_DATA_SOURCE=mock` runs without backend.
- [ ] Home Feed renders static sample posts.
- [ ] Local user selection/registration still works.
- [ ] Mock follow state still uses localStorage overlay.
- [ ] Mock mode behavior was not removed while preparing release docs.

## API Mode Check

- [ ] Local PostgreSQL database exists.
- [ ] `backend/.env` has the intended `DATABASE_URL`.
- [ ] `alembic upgrade head` succeeds.
- [ ] `python -m app.services.seed` succeeds.
- [ ] `uvicorn app.main:app --reload` starts.
- [ ] `GET /health` returns healthy status.
- [ ] `VITE_DATA_SOURCE=api` frontend can select an API user.
- [ ] API Home Feed, Accounts, Account Profile, and Post Detail render.
- [ ] API follow/unfollow works.
- [ ] API post create/edit/delete works for the active user's own posts.

## External Import Check

- [ ] Dry-run succeeds for `data/external_posts/examples/feed_import_sample.json`.
- [ ] Actual import succeeds against the intended database.
- [ ] Re-importing the same JSON updates rows instead of creating duplicate posts.
- [ ] Imported Account/Profile/Post Detail can be viewed in API mode.
- [ ] Imported posts use generic Account/Post/Asset/Metadata structures.
- [ ] Asset URLs are browser-accessible paths or URLs.
- [ ] Missing asset URLs fail gracefully in the UI.

## Asset Viewer Check

- [ ] Image and plot assets show thumbnails.
- [ ] Clicking image/plot opens the lightbox.
- [ ] Prev/next works when one post has multiple visual assets.
- [ ] Visual assets respect `sort_order` ascending.
- [ ] CSV table asset shows a short preview when accessible.
- [ ] CSV table failure shows fallback with Open original action.
- [ ] File assets render as file cards, not inline PDF/HTML previews.
- [ ] Link assets render as links/cards.

## Final Verification

- [ ] `npm run build` passes from `feed-prototype`.
- [ ] No local `.env`, database dump, generated large binary asset, or local PostgreSQL data is committed.
- [ ] Release handoff points readers to `README.md`, `feed-prototype/README.md`, this checklist, and `SMOKE_TEST_v0.0.0.md`.
