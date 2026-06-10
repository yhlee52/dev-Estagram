# Instagram-like Local Feed Prototype

이 저장소는 `feed-prototype` 프로젝트를 담고 있습니다. `feed-prototype`은 Vite + React + TypeScript 기반의 범용 Instagram-like local/general feed prototype입니다.

이 프로젝트는 의도적으로 generic한 feed 모델을 유지합니다. 향후 회사 내부 설비 리포트 feed로 확장할 수 있지만, core product model은 설비 리포트 전용 구조가 아닙니다.

core domain 개념:

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

core model, shared component, route, data flow에는 설비/리포트 전용 이름을 넣지 않습니다. `Equipment`, `Chamber`, `Sensor`, `Recipe`, `Severity`, `Report` 같은 이름을 core architecture의 기반으로 삼지 않습니다. 시나리오 전용 정보가 필요하면 `post.metadata`, `metadata_json`, asset metadata 값으로 보관합니다.

## 현재 상태

완료된 MVP:

- MVP1-MVP4: local/static feed prototype, local user entry, local registration, active user state, local follow overlay.
- MVP5: `feed-prototype/backend/` 아래 FastAPI + PostgreSQL + SQLModel + Alembic backend/database skeleton.
- MVP6: mock mode를 유지하면서 frontend API read mode 추가.
- MVP7: FastAPI와 PostgreSQL `follows` table을 통한 API-mode follow/unfollow write.
- MVP7.5: FastAPI를 통한 API-mode local user/account registration.
- MVP8: active API user의 1:1 account로 API-mode personal post create/delete.
- MVP9: post asset + metadata management. tags, asset descriptor, metadata editing, owned post editing 포함.
- MVP10: external post JSON package를 backend DB에 import하는 External Post Ingestion Pipeline.

API mode는 로컬에서 선택한 backend `User`를 사용합니다. 이것은 실제 login/authentication이 아닙니다. MVP 단계에서는 각 `User`에 정확히 하나의 `Account`가 대응하며, post ownership check는 선택된 user의 1:1 account와 target post의 `account_id`를 비교하는 prototype 정책입니다.

Mock mode는 계속 유지됩니다. frontend mock JSON, local asset, localStorage overlay를 계속 사용합니다.

## MVP9: Post Asset + Metadata Management

MVP9는 기존의 두 후보를 통합한 단계입니다.

- 기존 MVP9 후보: asset attach/upload skeleton
- 기존 MVP10 후보: post edit/update + metadata editor
- 통합 MVP9: Post Asset + Metadata Management

MVP9는 MVP8 위에 asset descriptor, tags, metadata editing, `updated_at`, owned post editing을 추가했습니다.

MVP9 목표:

- Post에 `assets`, `tags`, `metadata`, `updated_at` 구조를 추가합니다.
- active API user가 Post 생성 시 asset 정보를 입력할 수 있게 합니다.
- active API user가 Post 생성 시 tags와 metadata를 입력할 수 있게 합니다.
- active API user가 자기 1:1 Account로 작성한 Post를 수정할 수 있게 합니다.
- `title`, `text`, `tags`, `assets`, `metadata` 수정이 가능하게 합니다.
- 생성/수정한 내용을 backend PostgreSQL DB에 저장합니다.
- Home Feed, Account Profile, Post Detail에서 수정된 Post를 보여줍니다.
- PostCard, Post Detail, Account Profile에서 asset preview와 metadata를 보여줍니다.
- image asset은 image preview로 표시합니다.
- plot, table, file, link asset은 MVP 범위에서 placeholder 또는 link card로 표시합니다.
- mock mode 동작은 유지합니다.

MVP9 backend API:

- `POST /api/posts` 확장
- `PATCH /api/posts/{post_id}` 추가
- 기존 `DELETE /api/posts/{post_id}` 유지

MVP9 API 정책:

- `POST /api/posts`는 `user_id`, `title`, `text`, optional `metadata_json`, optional `tags`, optional `assets`를 받습니다.
- `PATCH /api/posts/{post_id}`는 `user_id`와 update payload를 받습니다.
- backend는 `user_id`로 선택된 `User`를 찾고, 그 User의 1:1 `Account`를 찾은 뒤 `post.account_id`와 비교합니다.
- 선택된 user의 own 1:1 Account가 작성한 Post만 수정할 수 있습니다.
- frontend는 post 생성/수정 시 임의의 `account_id`를 선택하거나 제출하지 않습니다.
- 이 ownership check는 MVP prototype 동작이며 formal authentication/authorization이 아닙니다.
- asset entry는 URL 또는 local path 문자열만 저장합니다. MVP9는 file upload를 구현하지 않습니다.

MVP9 non-goals:

- real file upload
- local file upload
- S3 upload
- drag and drop upload
- image compression 또는 resizing
- rich text editor
- complex metadata schema validation
- metadata search/filtering
- advanced asset viewer
- report template generation
- bot account auto posting
- draft saving
- edit history/version history
- comments, likes, bookmarks
- formal authentication, JWT, sessions, OAuth
- permission system
- multiple account selection
- admin UI
- post moderation
- mock mode removal

## MVP10: External Post Ingestion Pipeline

MVP10의 이름은 **External Post Ingestion Pipeline**입니다.

MVP10은 UI에서 post를 직접 작성하는 기능이 아닙니다. 목표는 외부 분석 프로그램 또는 post 생성 프로그램이 JSON 기반 post package를 만들고, import script가 그 package를 backend DB에 넣어서 기존 UI가 import된 Post를 일반 Post처럼 표시하게 하는 것입니다.

MVP10 target flow:

```text
external analysis/post generation program
  -> post JSON package
  -> image/plot/table/file assets written by that program
  -> import package placed under data/external_posts/incoming
  -> import script reads JSON
  -> backend DB upserts accounts, posts, assets, and metadata
  -> UI reads the DB and displays imported posts like normal posts
```

MVP10 목표:

- external post import JSON format을 정의합니다.
- import script가 JSON을 읽고 `Account`, `Post`, `Asset`, `metadata_json`을 backend DB에 upsert합니다.
- `external_id` 기반 upsert를 사용해 같은 JSON 반복 import 시 중복 Post 생성을 방지합니다.
- DB write 전에 검증할 수 있는 `--dry-run`을 제공합니다.
- `.env` 또는 `DATABASE_URL` 변경으로 test DB와 operational/update DB를 분리할 수 있게 합니다.
- JSON에는 UI가 접근 가능한 asset URL/path만 저장합니다.
- MVP10에서는 asset 파일을 복사하지 않습니다.
- import된 Post와 UI에서 작성한 Post가 같은 generic DB 구조를 사용하게 합니다.
- equipment, recipe, chamber, severity 같은 시나리오 값은 core model/component 이름이 아니라 `metadata_json` 안에 둡니다.

권장 external post package directory:

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

MVP10 non-goals:

- UI file upload
- multipart/form-data upload
- S3 upload
- asset file auto-copy
- folder watch
- scheduler 또는 Airflow integration
- bot account automatic analysis/generation logic
- metadata filter/search
- advanced asset viewer
- chart/table parsing
- batch management UI
- import result dashboard
- formal authentication, JWT, sessions, OAuth
- mock mode removal

## Data And Storage

Frontend mock data는 `feed-prototype/src/data` 아래에 있습니다.

Static browser asset은 `feed-prototype/public/assets` 아래에 둡니다.

MVP10 external post import package는 `feed-prototype/data/external_posts` 아래에 둡니다.

중요 localStorage key:

- `local-feed-active-user-id`
- `local-feed-following-by-user`
- `local-feed-local-users`
- `local-feed-local-accounts`

Backend code는 `feed-prototype/backend/` 아래에 있습니다. Backend state는 Alembic migration과 seed script로 재현 가능해야 합니다. 실제 PostgreSQL DB file, dump, local `.env`는 commit하지 않습니다.

## Development

Vite app directory에서 frontend build를 확인합니다.

```bash
cd feed-prototype
npm run build
```

Backend setup과 실행 방법은 `feed-prototype/backend/README.md`에 정리되어 있습니다.
