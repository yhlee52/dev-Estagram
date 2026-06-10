# MVP10 External Post Format

MVP10은 **External Post Ingestion Pipeline**입니다. 외부 분석 프로그램 또는 post 생성 프로그램이 JSON 기반 post package를 만들고, import service가 그 package를 읽어 generic feed data를 backend DB에 upsert합니다. UI는 import된 post를 일반 post처럼 표시합니다.

MVP10은 UI post creation, file upload, S3 upload, folder watch, scheduler, metadata search, advanced asset viewer 기능이 아닙니다. MVP12에서는 이 format에 `asset.sort_order`를 추가해 visual asset viewer의 안정적인 표시 순서를 지원합니다.

## Package 구조

권장 package layout:

```text
batch_YYYY-MM-DD_HHMMSS/
  feed_posts.json
  assets/
    image_or_plot_files.png
    table_files.csv
```

repository 위치:

```text
data/external_posts/
  README.md
  examples/
    feed_import_sample.json
    batch_2026-06-09_090000/
      feed_posts.json
      assets/
        README.md
  incoming/
  archive/
  failed/
```

`examples`는 참고용입니다. `incoming`은 import 대기 package를 두는 곳입니다. `archive`와 `failed`는 MVP10에서 수동 보관용으로 사용할 수 있는 optional folder입니다.

## 기본 feed_posts.json

최소 top-level shape:

```json
{
  "batch": {
    "external_id": "batch-2026-06-09-090000",
    "source": "manual-generator",
    "created_at": "2026-06-09T09:00:00"
  },
  "accounts": [],
  "posts": []
}
```

top-level field:

- `batch`: generated package의 metadata입니다.
- `accounts`: imported post를 소유할 account 목록입니다.
- `posts`: create 또는 update할 imported post 목록입니다.

schema는 unknown field를 허용할 수 있지만, import service는 문서화된 field만 저장합니다.

## Account Format

권장 field:

- `external_id`: 필수 import/upsert key입니다.
- `handle`: 필수 UI-facing handle입니다.
- `display_name`: 필수 UI-facing name입니다.
- `bio`: optional account description입니다.
- `avatar_url`: optional browser-accessible avatar URL/path입니다.

예:

```json
{
  "external_id": "bot-temp-report",
  "handle": "temp_report_bot",
  "display_name": "Temperature Report Bot",
  "bio": "Generated temperature analysis posts.",
  "avatar_url": "/assets/generated/bot-temp-report.png"
}
```

MVP 단계에서는 각 `Account`에 대응하는 `User`가 하나 필요합니다. import service는 imported Account마다 generic paired import User를 자동 생성합니다.

```text
user id: import-user-{normalized-account-external-id}
user handle: import.{normalized-account-external-id}
account id: import-account-{normalized-account-external-id}
account kind: bot
```

## Post Format

권장 field:

- `external_id`: 필수 post import/upsert key입니다.
- `account_external_id`: 필수 account reference입니다.
- `title`: 필수 post title입니다.
- `text`: optional post body text입니다.
- `created_at`: optional post creation timestamp입니다.
- `tags`: optional string list입니다.
- `metadata_json`: optional object입니다. domain-specific value를 넣습니다.
- `assets`: optional asset descriptor list입니다.

예:

```json
{
  "external_id": "post-temp-2026-06-09-001",
  "account_external_id": "bot-temp-report",
  "title": "Daily temperature summary",
  "text": "TEMP-related signals were detected today.",
  "created_at": "2026-06-09T09:00:00",
  "tags": ["daily-report", "temperature"],
  "metadata_json": {
    "source": "analysis-program",
    "reportDate": "2026-06-09",
    "recipe": "ABC",
    "chamber": "CH01"
  },
  "assets": []
}
```

core feed model은 generic하게 유지합니다. recipe, chamber, status, severity, equipment state, analysis result 같은 domain-specific value는 core model/component name이 아니라 `metadata_json` 또는 asset metadata에 넣습니다.

## Asset Format

권장 field:

- `external_id`: 권장 stable asset key입니다.
- `type`: 필수 asset type입니다.
- `url`: 필수 browser-accessible URL/path입니다.
- `title`: optional asset title입니다.
- `description`: optional asset description입니다.
- `sort_order`: optional integer입니다. MVP12 viewer에서 stable display order로 사용합니다.

허용 asset type:

```text
image
plot
table
file
link
```

예:

```json
{
  "external_id": "asset-temp-2026-06-09-001",
  "type": "image",
  "url": "/assets/generated/temp_trend_001.png",
  "title": "Temperature trend",
  "description": "Generated temperature trend plot.",
  "sort_order": 1
}
```

MVP12 asset viewer policy:

- `image`와 `plot`은 같은 visual asset으로 취급합니다.
- `plot`은 interactive chart가 아니라 PNG/SVG 같은 저장된 image file로 봅니다.
- 한 post에 여러 visual asset이 있으면 `sort_order` 오름차순으로 표시합니다.
- `sort_order`가 없으면 기존 배열 순서, created_at, id 같은 fallback을 사용할 수 있습니다.
- 같은 `sort_order`가 여러 개 있으면 created_at/id 같은 fallback 기준으로 보조 정렬합니다.
- `table`은 CSV preview 대상입니다. preview 실패 시 fallback card와 원본 열기 action을 제공합니다.
- `file`은 inline preview 없이 원본 열기 card로 표시합니다.
- `link`는 hyperlink/card로 표시합니다.

Multi visual asset 작성 규칙:

- 한 post에 여러 image/plot을 넣고 싶으면 기존 `assets` 배열에 여러 asset을 넣습니다.
- `gallery`, `images`, `plots` 같은 별도 field를 만들지 않습니다.
- post JSON top-level shape는 그대로 유지합니다.
- viewer는 `type`이 `image` 또는 `plot`인 asset을 visual asset group으로 묶을 수 있습니다.
- `table`, `file`, `link` asset은 visual gallery가 아니라 별도 section/card로 표시됩니다.
- 기존 asset에 `sort_order`가 없어도 import와 UI는 동작해야 합니다.
- 안정적인 표시 순서가 필요하면 `sort_order`를 넣는 것을 권장합니다.

Multi visual asset 예:

```json
{
  "external_id": "post-gallery-2026-06-10-001",
  "account_external_id": "sample-gallery-account",
  "title": "Multi visual asset post",
  "text": "This post has multiple image and plot assets.",
  "created_at": "2026-06-10T09:00:00",
  "tags": ["gallery", "multi-image", "plot"],
  "metadata_json": {
    "source": "manual-json",
    "contentType": "gallery"
  },
  "assets": [
    {
      "external_id": "asset-gallery-2026-06-10-001-img-001",
      "type": "image",
      "url": "/assets/generated/gallery_001_01.png",
      "title": "First image",
      "description": "Representative image.",
      "sort_order": 1
    },
    {
      "external_id": "asset-gallery-2026-06-10-001-img-002",
      "type": "image",
      "url": "/assets/generated/gallery_001_02.png",
      "title": "Second image",
      "description": "Second image.",
      "sort_order": 2
    },
    {
      "external_id": "asset-gallery-2026-06-10-001-plot-001",
      "type": "plot",
      "url": "/assets/generated/gallery_001_plot_01.png",
      "title": "Trend plot",
      "description": "PNG plot generated by analysis program.",
      "sort_order": 3
    },
    {
      "external_id": "asset-gallery-2026-06-10-001-table-001",
      "type": "table",
      "url": "/assets/generated/gallery_001_summary.csv",
      "title": "Summary table",
      "description": "CSV table preview sample.",
      "sort_order": 4
    }
  ]
}
```

Asset replacement policy:

- post에 `assets`가 포함되면 그 list를 해당 post의 최신 전체 asset list로 봅니다.
- 해당 post의 기존 assets는 삭제되고 imported list로 교체됩니다.
- post가 `assets`를 생략하면 기존 assets는 유지됩니다.
- asset이 없는 상태가 정답이면 `assets: []`를 사용합니다.

## external_id 규칙

권장 naming:

```text
batch external_id:   batch-YYYY-MM-DD-HHMMSS
account external_id: bot-{purpose}
account external_id: manual-{name}
account external_id: source-{system-name}
post external_id:    post-{source}-{date}-{serial}
asset external_id:   asset-{source}-{date}-{serial}
```

중요 동작:

- `external_id`가 같으면 기존 row가 update됩니다.
- `external_id`가 바뀌면 import service는 새 data로 보고 insert합니다.
- 같은 post를 update하려면 같은 `post.external_id`를 유지합니다.
- 새 post를 만들려면 새 `post.external_id`를 만듭니다.

가장 흔한 실수는 같은 post를 update하려는 상황에서 매번 `post.external_id`를 바꾸는 것입니다.

## Asset URL/path 규칙

MVP10은 asset 파일을 복사하지 않습니다. import service는 JSON의 `url` 값만 저장합니다.

브라우저에서 접근 가능한 URL 또는 path를 사용합니다.

```text
/assets/generated/temp_trend_001.png
https://example.com/assets/temp_trend_001.png
```

피해야 할 값:

```text
C:\data\temp_trend_001.png
feed-prototype/backend/local/temp_trend_001.png
```

frontend UI는 브라우저에서 실행됩니다. path는 frontend/backend/static asset setup을 통해 브라우저가 request할 수 있을 때만 유효합니다.

## 지속 Import 절차

새 batch마다 권장 workflow:

1. `batch_2026-06-09_090000` 같은 새 package folder를 생성합니다.
2. `feed_posts.json`을 작성합니다.
3. asset file을 UI가 접근 가능한 static 위치에 저장합니다.
4. 각 asset `url`이 해당 browser-accessible 위치를 가리키는지 확인합니다.
5. dry-run import를 실행합니다.
6. validation error 또는 예상과 다른 count를 수정합니다.
7. actual import를 실행합니다.
8. Home Feed, Account Profile, Post Detail에서 UI를 확인합니다.

## UI 표시 및 Edit/Delete 정책

imported post는 UI에서 작성한 post와 같은 generic `Account`, `Post`, `Asset`, `Metadata` 구조를 사용합니다.

Home Feed behavior:

- API Home Feed는 active API user의 own account와 followed account의 post를 보여줍니다.
- imported account는 모든 active user에게 자동 follow되지 않습니다.
- imported account를 follow하지 않았다면 해당 active user의 Home Feed에는 보이지 않을 수 있습니다.
- Account Profile과 Post Detail API route에서는 imported content를 확인할 수 있습니다.

Account Profile behavior:

- imported account의 `handle`, `display_name`, `bio`, `avatar_url`은 기존 profile UI에 표시됩니다.
- 해당 account의 imported posts는 최신순으로 표시됩니다.

Post Detail behavior:

- `title`, `text`, `tags`, `metadata_json`, `created_at`, `updated_at`, `imported_at`은 기존 post detail UI를 사용합니다.
- image/plot asset은 URL이 browser-accessible이면 visual thumbnail과 lightbox viewer로 표시됩니다.
- 한 post에 image/plot asset이 여러 개 있으면 `sort_order` 기준으로 prev/next 이동을 제공합니다.
- table asset은 CSV 앞 몇 행을 preview하고 원본 열기 action을 제공합니다.
- file asset은 inline preview 없이 원본 열기 card로 표시됩니다.
- link asset은 hyperlink/card로 표시됩니다.
- asset URL이 깨져도 fallback state를 표시하고 앱 전체가 crash되지 않아야 합니다.

Edit/delete behavior:

- imported post도 기존 MVP ownership policy를 따릅니다.
- active API user가 post account owner일 때만 Edit/Delete button이 표시됩니다.
- 일반 active API user는 imported account가 소유한 post의 Edit/Delete를 볼 수 없습니다.
- imported account용 generated import User를 active API user로 선택하면 Edit/Delete가 보일 수 있습니다. MVP 단계에서는 허용되는 prototype ownership checking이며 formal authentication/authorization이 아닙니다.

명령:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json
```

## Test DB와 Operational DB

MVP 개발/테스트 DB와 external post operational/update DB는 분리할 수 있습니다.

같은 backend code를 사용하되 `DATABASE_URL`만 다른 DB로 지정합니다.

```text
feed_dev
- MVP feature testing

feed_ops
- external post import and UI confirmation
```

운영 지침:

- `.env`는 git에 올리지 않습니다.
- import 전에 active `DATABASE_URL`을 확인합니다.
- operational DB에 import하기 전에는 `--dry-run`을 먼저 실행합니다.
- `--database-url`은 의도적으로 한 명령만 override할 때 사용합니다.

예:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --database-url postgresql+psycopg://postgres:postgres@localhost:5432/feed_ops --dry-run
```

## 자주 하는 실수

- 매번 `external_id`를 바꿔 duplicate post를 만듭니다.
- 같은 post를 update하려는데 `post.external_id`를 바꿉니다.
- payload와 DB 어디에도 없는 `account_external_id`를 참조합니다.
- 브라우저가 접근할 수 없는 asset `url`을 사용합니다.
- Windows local path를 browser URL처럼 사용합니다.
- backend-only local file path를 `asset.url`에 넣습니다.
- 너무 복잡한 nested object를 `metadata_json`에 너무 일찍 넣습니다.
- JSON comma 누락 또는 trailing comma로 syntax error를 만듭니다.
- operational DB에 `--dry-run` 없이 바로 import합니다.
- test DB를 쓰려 했는데 `DATABASE_URL`이 operational DB를 가리킵니다.

## 전체 예제

아래 파일을 참고합니다.

```text
data/external_posts/examples/feed_import_sample.json
data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
```

validation, dry-run, rollback, backend regression, frontend regression check는 아래 문서를 참고합니다.

```text
docs/MVP10_TEST_PROCEDURE.md
```
