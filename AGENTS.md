# AGENTS.md

## Project Identity

이 프로젝트는 `feed-prototype`입니다. Vite + React + TypeScript 기반의 범용 Instagram-like local feed prototype입니다.

이 codebase는 personal feed, bot feed, project feed, 향후 회사 내부 설비 리포트 feed를 지원할 수 있을 만큼 generic해야 합니다. core product model은 설비 전용이 아닙니다.

## Core Domain

core type, shared component, route, data flow에는 다음 generic concept를 사용합니다.

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

core type name 또는 primary component name에 설비 리포트 전용 용어를 넣지 않습니다. 피해야 할 이름:

- Equipment
- Chamber
- Sensor
- Recipe
- Severity
- Report

설비 리포트 관련 정보가 필요하면 `post.metadata`, `metadata_json`, asset metadata로 표현합니다. domain-specific value는 data로 유지하고 app architecture의 기반으로 삼지 않습니다.

## Current Implementation Scope

MVP1-MVP4는 local/static입니다. MVP5는 backend/database skeleton을 추가했습니다. MVP6는 mock mode를 유지하면서 frontend API read mode를 추가했습니다. MVP7은 API-mode follow/unfollow write를 추가했습니다. MVP7.5는 API-mode local user/account registration을 추가했습니다. MVP8은 API-mode personal post create/delete를 추가했습니다. MVP9는 post asset + metadata management를 추가했습니다. MVP10은 external post ingestion pipeline을 추가했습니다.

현재 제약:

- Mock mode는 계속 사용 가능합니다.
- static frontend mock data는 `feed-prototype/src/data` 아래에 유지합니다.
- static browser asset은 `feed-prototype/public/assets` 아래에 유지합니다.
- runtime mock-mode overlay는 localStorage에 저장합니다.
- API mode는 FastAPI와 backend PostgreSQL data를 사용합니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.
- MVP 단계에서는 각 `User`에 정확히 하나의 `Account`가 대응합니다.
- active API user는 backend DB user 중에서 선택하고 local에 저장합니다.
- active API user selection은 real login, authentication, authorization, account security가 아닙니다.

중요 localStorage key:

- `local-feed-active-user-id`
- `local-feed-following-by-user`
- `local-feed-local-users`
- `local-feed-local-accounts`

## Completed MVP Summary

MVP5 backend/database skeleton:

- `feed-prototype/backend/` 아래 FastAPI backend.
- PostgreSQL target database.
- SQLModel ORM / DB layer.
- Alembic migration.
- `users`, `accounts`, `posts`, `post_assets`, `follows` table.
- frontend mock JSON과 분리된 backend seed data.

MVP6 frontend API read mode:

- frontend data source mode: `mock`, `api`.
- API-mode user selection by id or handle.
- `GET /api/feed?user_id=...` 기반 API-mode feed read.
- Accounts, Account Profile, Post Detail에 API-mode read path.

MVP7 API follow/unfollow:

- `POST /api/users/{user_id}/follows/{account_id}`
- `DELETE /api/users/{user_id}/follows/{account_id}`
- `GET /api/users/{user_id}/follows`
- API mode follow state는 backend `follows` table에 저장합니다.
- mock mode는 localStorage follow state를 유지합니다.

MVP7.5 API local user/account registration:

- `POST /api/users`
- backend `User`와 대응 `Account`를 하나씩 생성합니다.
- 생성된 active API user를 localStorage에 저장합니다.
- password, login, session, token, OAuth, authorization은 추가하지 않습니다.

MVP8 personal post create/delete:

- `POST /api/posts`
- `DELETE /api/posts/{post_id}`
- active API user의 1:1 `Account`를 통해 post를 생성합니다.
- active API user own account가 작성한 post만 삭제합니다.
- frontend account selection을 허용하지 않습니다.
- prototype ownership checking만 사용하며 real authentication/authorization은 아닙니다.

MVP9 post asset + metadata management:

- Post에 `assets`, `tags`, `metadata_json`, `updated_at` 구조를 추가합니다.
- API-mode post creation이 tags, metadata, asset URL/path descriptor를 포함할 수 있습니다.
- active API user가 own 1:1 `Account`로 작성한 Post를 edit할 수 있습니다.
- Home Feed, Account Profile, Post Detail에서 created/edited content, asset preview, metadata를 표시합니다.
- mock mode behavior는 유지합니다.

## Previous MVP9 Scope: Post Asset + Metadata Management

MVP9는 기존의 두 후보를 통합했습니다.

- 기존 MVP9: asset attach/upload skeleton.
- 기존 MVP10: post edit/update + metadata editor.
- 통합 MVP9: Post Asset + Metadata Management.

MVP9 goal:

- Post에 `assets`, `tags`, `metadata`, `updated_at` 구조 추가.
- API mode에서 active API user가 Post 생성 시 asset 정보를 포함할 수 있게 함.
- API mode에서 active API user가 Post 생성 시 tags와 metadata를 포함할 수 있게 함.
- API mode에서 active API user가 own 1:1 `Account`로 작성한 Post를 edit할 수 있게 함.
- `title`, `text`, `tags`, `assets`, `metadata` 수정 허용.
- 생성/수정 content를 backend PostgreSQL에 저장.
- Home Feed, Account Profile, Post Detail에 content 표시.
- PostCard, Post Detail, Account Profile에 asset preview와 metadata 표시.
- image asset은 actual image preview로 표시.
- plot, table, file, link asset은 MVP9 범위에서 placeholder 또는 link card로 표시.
- mock mode behavior 유지.

MVP9 API policy:

- `POST /api/posts`는 `user_id`, `title`, `text`, optional `metadata_json`, optional `tags`, optional `assets`를 받습니다.
- `PATCH /api/posts/{post_id}`는 `user_id`와 `title`, `text`, `tags`, `assets`, `metadata_json` update payload를 받습니다.
- backend는 selected `User`를 `user_id`로 resolve합니다.
- backend는 해당 user의 1:1 `Account`를 찾습니다.
- post create/edit은 resolved account를 사용해야 하며 frontend는 `account_id`를 선택하지 않습니다.
- post edit은 `post.account_id`가 selected user's 1:1 account와 일치할 때만 허용합니다.
- 이것은 MVP ownership checking입니다. real authentication 또는 formal permission system을 추가하지 않습니다.
- assets는 URL/local path descriptor입니다. MVP9에서는 real upload를 구현하지 않습니다.

MVP9 non-goals:

- Real file upload.
- Local file upload.
- S3 upload.
- Drag and drop upload.
- Image compression or resizing.
- Rich text editor.
- Complex metadata schema validation.
- Metadata search/filtering.
- Advanced asset viewer.
- Report template generation.
- Bot account auto posting.
- Draft saving.
- Edit history/version history.
- Comments, likes, bookmarks.
- Formal authentication, JWT, sessions, OAuth.
- Permission system.
- Multiple account selection.
- Admin UI.
- Post moderation.
- Mock mode removal.
- Equipment-report-specific core type names, component names, routes, data flow.

## Current MVP10 Scope: External Post Ingestion Pipeline

MVP10 이름은 **External Post Ingestion Pipeline**입니다.

MVP10은 UI post creation feature가 아닙니다. 외부 분석 프로그램 또는 post 생성 프로그램이 JSON 기반 post package를 만들고, import script가 package를 backend DB에 넣어서 UI가 import된 Post를 일반 Post처럼 표시하게 하는 것이 목표입니다.

MVP10 flow:

- 외부 프로그램이 post JSON을 생성합니다.
- 외부 프로그램이 image, plot, table, file asset을 생성합니다.
- package를 `feed-prototype/data/external_posts/incoming` 아래에 둡니다.
- import script가 JSON을 읽습니다.
- import script가 package를 검증하며 `--dry-run`을 지원합니다.
- import script가 `Account`, `Post`, `Asset`, `metadata_json`을 backend PostgreSQL DB에 upsert합니다.
- UI는 기존 API-mode path를 통해 imported data를 읽고 일반 feed content처럼 표시합니다.

MVP10 data policy:

- generic core concept만 사용합니다: User, Account, Post, Feed, Follow, Asset, Metadata.
- imported accounts, posts, assets는 `external_id` 기반 upsert를 사용합니다.
- 같은 JSON을 다시 import해도 duplicate Post가 계속 생기면 안 됩니다.
- DB에는 UI가 접근 가능한 asset URL/path만 저장합니다.
- MVP10에서는 asset file을 복사하지 않습니다.
- test DB와 operational/update DB는 `.env` 또는 `DATABASE_URL` 변경으로 분리할 수 있습니다.
- recipe, chamber, severity, equipment state, analysis result 같은 domain-specific value는 `metadata_json` 또는 asset metadata에 넣습니다.

MVP10 directory:

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

- `batch.external_id`는 필수입니다.
- `batch.source`, `batch.created_at`은 optional입니다.
- `accounts[].external_id`는 account upsert key입니다.
- `accounts[].handle`, `accounts[].display_name`은 UI-facing account field입니다.
- `posts[].external_id`는 post upsert key입니다.
- `posts[].account_external_id`는 post를 imported account에 연결합니다.
- `posts[].metadata_json`은 domain-specific value를 저장합니다.
- `posts[].assets[]`는 asset URL/path descriptor를 저장합니다.
- allowed asset type은 `image`, `plot`, `table`, `file`, `link`입니다.

MVP10 non-goals:

- UI file upload.
- Multipart/form-data upload.
- S3 upload.
- Asset file automatic copy.
- Folder watch.
- Scheduler or Airflow integration.
- Bot account automatic analysis/generation logic.
- Metadata filter/search.
- Advanced asset viewer.
- Chart/table parsing.
- Batch management UI.
- Import result dashboard.
- Formal authentication, JWT, sessions, OAuth.
- Mock mode removal.

## Current MVP11 Scope: Metadata / Tag / Asset Filter & Search

MVP11 name: **Metadata / Tag / Asset Filter & Search**.

MVP11 builds on MVP10. External post packages can now be imported into backend
PostgreSQL as generic `Account`, `Post`, `Asset`, and `Metadata` records.
MVP11 makes those accumulated posts easier to find with simple API-mode filters.

MVP11 goal:

- Add filter query parameters to backend list/read APIs.
- Support filtering `GET /api/posts` and `GET /api/feed`.
- Support keyword search over post title, post text, account handle, and account display name.
- Support tag filtering over `post.tags`.
- Support generic `metadata_key` + `metadata_value` filtering over `metadata_json`.
- Support asset type filtering when a post has an asset of the requested type.
- Support account filtering by `account_id` or `account_handle`.
- Support `my_posts_only` for the active API user's 1:1 `Account`.
- Add a simple API-mode Home Feed filter/search panel with Apply and Reset.
- Show an empty state when filter results are empty.
- Keep mock mode behavior unchanged.

MVP11 recommended query parameters:

```text
keyword
tag
metadata_key
metadata_value
asset_type
account_id
account_handle
user_id
my_posts_only
```

MVP11 example requests:

```text
GET /api/posts?keyword=temperature
GET /api/posts?tag=daily-report
GET /api/posts?metadata_key=source&metadata_value=analysis-program
GET /api/posts?asset_type=image
GET /api/posts?account_handle=temp_report_bot
GET /api/feed?user_id=1&tag=daily-report&asset_type=image
GET /api/posts?user_id=1&my_posts_only=true
```

MVP11 metadata policy:

- Metadata filter UI and API must remain generic key-value filtering.
- Do not hard-code severity, recipe, chamber, equipment, report, or other domain-specific fields into core models, shared components, route names, or data flow.
- It is valid for a user to enter `metadata_key=severity` and `metadata_value=high`; those remain data values inside `metadata_json`.

MVP11 non-goals:

- Elasticsearch.
- Advanced PostgreSQL full-text search.
- Semantic search.
- Vector search.
- Saved search.
- Advanced query builder.
- Complex AND/OR condition UI.
- Exclude filter.
- Advanced multi-select.
- Advanced date range filtering.
- Pagination/infinite scroll overhaul.
- Dashboard.
- Analytics.
- Chart/table parsing.
- Advanced asset viewer.
- Import pipeline changes.
- Bot account auto generation.
- Formal authentication, JWT, sessions, OAuth.
- Mock mode removal.

## Current MVP12 Scope: Asset Viewer Enhancement

MVP12 name: **Asset Viewer Enhancement**.

MVP12 makes post assets easier to view. It builds on MVP9 asset/metadata
management, MVP10 external post ingestion, and MVP11 filter/search. The product
model remains generic. Do not introduce Equipment, Report, Sensor, Chamber,
Recipe, Severity, or other equipment-report-specific concepts into core type
names, primary component names, routes, or data flow. Scenario-specific values
remain in `metadata_json` or asset metadata.

MVP12 goal:

- Treat `image` and `plot` assets as the same visual asset category.
- Treat `plot` as a saved image file such as PNG/SVG, not an interactive chart.
- Show image/plot assets as thumbnails.
- Open image/plot assets in a modal/lightbox when clicked.
- Support prev/next navigation when one post has multiple image/plot assets.
- Add and document `asset.sort_order` for stable visual asset display order.
- Sort visual assets by `sort_order` ascending, with existing order/created_at/id fallback when missing.
- Treat `table` assets as CSV files and preview only the first few rows.
- Provide fallback table cards and an `Open original` action when table preview fails.
- Render `file` assets as file cards with `Open original`; do not inline preview PDF or HTML.
- Render `link` assets as natural hyperlink/cards.
- Show compact asset preview in PostCard.
- Show full asset viewer in PostDetail.
- Make broken asset URLs fail gracefully without crashing the app.
- Update MVP10 external import JSON format and sample JSON to include `sort_order`.
- Keep mock mode behavior unchanged.

MVP12 non-goals:

- Actual file upload.
- S3 upload.
- Asset file copy.
- Large backend static serving changes.
- Folder watch.
- Interactive chart rendering.
- Plotly/Vega rendering.
- PDF inline preview.
- HTML iframe preview.
- Excel parser.
- Large CSV processing.
- CSV encoding auto-detection.
- Image zoom/pan.
- Touch swipe carousel.
- Fancy animation.
- Asset reorder UI.
- Advanced asset edit workflow.
- OpenGraph link preview.
- Dashboard.
- Large import pipeline rewrite.
- Mock mode removal.

## Development Guidelines

- TypeScript build를 통과시킵니다.
- 작고 집중된 변경을 선호합니다.
- 불필요한 큰 refactor를 피합니다.
- 새 abstraction을 추가하기 전에 기존 project pattern을 따릅니다.
- component와 type은 general feed와 향후 회사 내부 report feed 모두에 재사용 가능하게 유지합니다.
- equipment-report example은 가능한 data scenario 중 하나로만 취급하고 core domain으로 삼지 않습니다.
- API-mode feature를 구현하면서 mock mode를 제거하지 않습니다.
- future MVP가 명시적으로 범위를 바꾸기 전에는 password, JWT, session, OAuth, formal authorization system을 추가하지 않습니다.
- MVP10에서는 frontend file write logic 또는 actual upload flow를 구현하지 않습니다.

## Verification

code change 후 Vite app directory에서 build를 실행합니다.

```bash
npm run build
```

handoff 전 build가 통과해야 합니다.
