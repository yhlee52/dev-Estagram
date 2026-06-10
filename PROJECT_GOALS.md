# PROJECT_GOALS.md

## 프로젝트 목표

`feed-prototype`은 Vite + React + TypeScript 기반의 범용 Instagram-like local feed prototype입니다.

core product model은 generic하게 유지해야 합니다. 같은 feed model이 personal feed, bot feed, project feed, 향후 회사 내부 설비 리포트 feed를 지원할 수 있어야 하며, 설비 리포트가 architecture의 기반이 되어서는 안 됩니다.

core concept:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

core type name, shared component name, route, data flow에 설비/리포트 전용 용어를 넣지 않습니다. `Equipment`, `Chamber`, `Sensor`, `Recipe`, `Severity`, `Report` 같은 이름을 피합니다. domain-specific value는 `metadata_json`, `post.metadata`, asset metadata에 넣습니다.

## 완료된 범위

MVP1-MVP4는 local/static feed experience를 만들었습니다.

- Static JSON data와 local browser asset.
- Local user entry와 local registration.
- localStorage 기반 active user state.
- user별 localStorage follow state.
- Home Feed, Accounts, Account Profile, Post Detail, Me route.

MVP5는 backend/database skeleton을 추가했습니다.

- `feed-prototype/backend/` 아래 FastAPI backend.
- PostgreSQL target database.
- SQLModel ORM layer.
- Alembic migration.
- frontend mock JSON과 분리된 backend seed data.
- `users`, `accounts`, `posts`, `post_assets`, `follows` table.

MVP6는 frontend API read mode를 추가했습니다.

- frontend data source mode: `mock`, `api`.
- API-mode backend user selection by id or handle.
- `GET /api/feed?user_id=...` 기반 API-mode Home Feed.
- Accounts, Account Profile, Post Detail의 read-only API-mode path.

MVP7은 API-mode follow/unfollow를 추가했습니다.

- `POST /api/users/{user_id}/follows/{account_id}`
- `DELETE /api/users/{user_id}/follows/{account_id}`
- `GET /api/users/{user_id}/follows`
- PostgreSQL `follows` table에 follow state 저장.

MVP7.5는 API-mode local user/account registration을 추가했습니다.

- `POST /api/users`
- backend `User`와 정확히 하나의 대응 `Account` 생성.
- 생성된 user를 active API user로 localStorage에 저장.
- password, session, JWT, OAuth, formal authorization은 추가하지 않음.

MVP8은 API-mode personal post create/delete를 추가했습니다.

- `POST /api/posts`
- `DELETE /api/posts/{post_id}`
- active API user의 1:1 `Account`를 통해 Post 생성.
- active API user의 own 1:1 `Account`가 작성한 Post만 삭제.
- frontend가 임의의 `account_id`를 선택하지 않음.
- real authentication 또는 permission system을 추가하지 않음.

MVP9는 post asset + metadata management를 추가했습니다.

- API-mode post creation에 tags, metadata, asset URL/path descriptor 포함 가능.
- API-mode post editing에서 title, text, tags, metadata, assets 수정 가능.
- Home Feed, Account Profile, Post Detail에 assets와 metadata 표시.
- image asset은 image preview로 표시.
- plot, table, file, link asset은 MVP 수준 placeholder 또는 link card로 표시.
- mock mode 유지.

## 이전 MVP: MVP9

MVP9 이름은 **Post Asset + Metadata Management**입니다.

MVP9는 두 후보를 통합했습니다.

- 기존 MVP9 후보: asset attach/upload skeleton.
- 기존 MVP10 후보: post edit/update + metadata editor.
- 통합 MVP9: Post Asset + Metadata Management.

MVP9 목표:

- Post에 `assets`, `tags`, `metadata`, `updated_at` 구조 추가.
- API-mode post creation에서 active API user가 asset 정보를 포함할 수 있게 함.
- API-mode post creation에서 active API user가 tags와 metadata를 포함할 수 있게 함.
- active API user가 own 1:1 `Account`로 작성한 Post를 edit할 수 있게 함.
- `title`, `text`, `tags`, `assets`, `metadata` 수정 허용.
- 생성/수정된 content를 backend PostgreSQL에 저장.
- Home Feed, Account Profile, Post Detail에서 content 표시.
- PostCard, Post Detail, Account Profile에서 asset preview와 metadata 표시.
- image asset은 actual image preview로 표시.
- plot, table, file, link asset은 MVP 범위에서 placeholder 또는 link card로 표시.
- mock mode와 localStorage behavior 유지.

MVP9 backend API:

```text
POST /api/posts
PATCH /api/posts/{post_id}
DELETE /api/posts/{post_id}
```

MVP9 ownership check는 prototype 정책입니다.

```text
active API user selection은 local prototype state
backend는 selected User의 1:1 Account와 post.account_id를 비교
real login이 아님
authentication이 아님
authorization이 아님
permission framework가 아님
```

## 현재 MVP: MVP10

MVP10 이름은 **External Post Ingestion Pipeline**입니다.

MVP10은 UI에서 Post를 직접 작성하는 flow가 아닙니다. 외부 분석 프로그램 또는 post 생성 프로그램이 JSON 기반 post package를 만들고, import script가 package를 backend DB에 넣어서 기존 UI가 import된 Post를 일반 Post처럼 표시하게 하는 backend ingestion 단계입니다.

## MVP10 목표

MVP10은 다음을 목표로 합니다.

- external post import package의 JSON format 정의.
- 외부 프로그램이 app 밖에서 post JSON과 asset 파일 생성.
- import script가 JSON을 읽고 accounts, posts, assets, metadata를 backend DB에 upsert.
- `external_id` 기반 upsert로 같은 JSON 반복 import 시 duplicate Post 방지.
- DB write 없이 import package를 검증하고 변경 예정 count를 보여주는 `--dry-run` 제공.
- import 결과 summary log 출력.
- `.env` 또는 `DATABASE_URL` 변경으로 test DB와 operational/update DB 분리 가능.
- UI가 접근 가능한 asset URL/path만 저장.
- MVP10에서는 asset 파일 복사 없음.
- import된 Post와 UI 작성 Post가 같은 DB shape 사용.
- core domain은 User, Account, Post, Feed, Follow, Asset, Metadata로 generic하게 유지.
- recipe, chamber, severity, equipment state, analysis status 같은 domain-specific value는 `metadata_json` 또는 asset metadata에 저장.

## MVP10 Ingestion Flow

```text
analysis program / post generation program
  -> creates post JSON
  -> creates image / plot / table / file assets
  -> writes a package under data/external_posts/incoming
  -> import script reads the package JSON
  -> import script validates the package
  -> import script upserts Account / Post / Asset / metadata_json rows
  -> UI reads the backend DB through existing API paths
  -> imported Posts appear like normal Posts
```

frontend는 PostgreSQL에 직접 연결하지 않습니다. UI는 계속 FastAPI-backed API mode를 통해 데이터를 읽습니다.

## MVP10 External Post Directory

권장 구조:

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

폴더 의미:

```text
examples  사람이 참고하거나 external generator가 따라 쓸 sample import JSON
incoming  import 전 external program이 package를 둘 위치
archive   import 성공 package를 나중에 보관할 수 있는 선택적 위치
failed    실패 package를 수동 점검용으로 둘 수 있는 선택적 위치
```

MVP10에서는 `archive` 또는 `failed`로 자동 이동하지 않아도 됩니다.

## MVP10 JSON Shape

import package는 다음을 포함합니다.

```text
batch.external_id
batch.source?
batch.created_at?
accounts[]
posts[]
```

각 account:

```text
external_id
handle
display_name
bio?
avatar_url?
```

각 post:

```text
external_id
account_external_id
title
text?
created_at?
tags?
metadata_json?
assets?
```

각 asset:

```text
external_id?
type
url
title?
description?
```

허용 asset type:

```text
image
plot
table
file
link
```

## MVP10 Non-Goals

MVP10은 다음을 구현하지 않습니다.

```text
UI file upload
multipart/form-data upload
S3 upload
asset file automatic copy
folder watch
scheduler or Airflow integration
bot account automatic analysis/generation logic
metadata filter/search
advanced asset viewer
chart/table parsing
batch management UI
import result dashboard
formal authentication
JWT
sessions
OAuth
mock mode removal
equipment-report-specific core naming
```

## 개발 원칙

- TypeScript build를 계속 통과시킵니다.
- 작고 집중된 변경을 선호합니다.
- 명시적 요청이 없으면 mock mode를 유지합니다.
- frontend data access는 선택된 repository/API mode 뒤에 둡니다.
- backend data access는 FastAPI 뒤에 둡니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.
- MVP 단계에서는 `User`와 `Account`를 1:1로 유지합니다.
- active API user selection은 local prototype state이며 authentication이 아닙니다.

## Current MVP: MVP11

MVP11 name: **Metadata / Tag / Asset Filter & Search**.

MVP11 follows MVP10. MVP10 made it possible for external programs to import
generic posts, assets, tags, and metadata into the backend DB. MVP11 lets users
filter those accumulated posts with simple API-mode conditions.

MVP11 is intentionally simple. It should help users find relevant posts without
introducing a full search platform, saved search system, analytics product, or
domain-specific report model.

## MVP11 Goals

- Add filter query parameters to the existing `GET /api/posts` and `GET /api/feed` read APIs.
- Support filtering by keyword, tag, metadata key-value, asset type, and account.
- Support `my_posts_only` based on the active API user's 1:1 Account.
- Add a compact filter/search panel at the top of API-mode Home Feed.
- Let users enter keyword, tag, metadata key/value, and asset type, then Apply or Reset.
- Show an empty state when filters return no matching posts.
- Keep mock mode behavior unchanged.
- Use MVP10 imported posts as useful test data for filter behavior.

Keyword search target fields:

```text
post.title
post.text
account.handle
account.display_name
```

Metadata filtering policy:

- Metadata filters are generic key-value filters over `metadata_json`.
- Domain values such as severity, recipe, chamber, equipment, or analysis status remain data values.
- Core models, route names, shared component names, and primary UI controls must not hard-code equipment-report-specific fields.
- A user may search with `metadata_key=severity&metadata_value=high`; that does not make severity a core product concept.

## MVP11 API Candidate

Existing APIs receive optional query parameters:

```text
GET /api/posts
GET /api/feed
```

Recommended query parameters:

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

Example requests:

```text
GET /api/posts?keyword=temperature
GET /api/posts?tag=daily-report
GET /api/posts?metadata_key=source&metadata_value=analysis-program
GET /api/posts?asset_type=image
GET /api/posts?account_handle=temp_report_bot
GET /api/feed?user_id=1&tag=daily-report&asset_type=image
GET /api/posts?user_id=1&my_posts_only=true
```

## MVP11 Non-Goals

MVP11 does not implement:

```text
Elasticsearch
Advanced PostgreSQL full-text search
semantic search
vector search
saved search
advanced query builder
complex AND/OR condition UI
exclude filter
advanced multi-select
advanced date range filtering
pagination/infinite scroll overhaul
dashboard
analytics
chart/table parsing
advanced asset viewer
import pipeline changes
bot account auto generation
formal authentication
JWT
sessions
OAuth
mock mode removal
equipment-report-specific core naming
```
