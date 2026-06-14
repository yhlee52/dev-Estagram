# External Post Package Guide

이 문서는 `feed-prototype` v0.0.0 / MVP12 기준 external post package 작성 가이드입니다.

목표는 외부 프로그램, 분석 script, 또는 GPT가 생성한 JSON post package를 안정적으로 backend DB에 import하고, API mode UI에서 일반 post처럼 표시하는 것입니다.

## 0. Format Stability (v0.0.0 동결)

이 package format은 v0.0.0 시점에 동결되었습니다. 외부 생성 프로그램이
이 형식으로 데이터를 지속 생산하므로, 이미 생성된 package는 모든 미래
버전에서 그대로 import 가능해야 합니다.

변경 정책:

```text
허용     optional 필드 추가 (없으면 기존 동작 유지)
금지     기존 필드 이름 변경 / 삭제 / 의미 변경
금지     optional 필드의 required 전환
금지     허용 asset type의 의미 변경
유지     external_id 기반 upsert (재import 안전성)
유지     timezone 없는 created_at 허용 (naive datetime)
```

회귀 확인:

- `examples/` 아래 sample package들은 golden sample입니다. import 관련
  코드 변경 후에는 각 sample에 대해 `--dry-run`이 통과하는지 확인합니다.
- 실제 운영에서 생성된 package를 golden sample로 추가할 수 있습니다.
  golden sample은 수정하지 않고 추가만 합니다.

## 1. Package 목적

External post package는 외부 프로그램이 생성한 `account`, `post`, `assets`, `metadata` JSON을 backend DB에 import하기 위한 입력 파일입니다.

Import service는 JSON을 읽어 generic feed domain에 맞게 upsert합니다.

- Account
- Post
- Asset
- Metadata

외부 분석 리포트에 필요한 scenario-specific value는 `metadata_json` 또는 asset metadata에 둡니다. Core model/component/route 이름을 report-specific하게 바꾸지 않습니다.

## 2. JSON 최상위 구조

최상위 구조는 항상 다음 형태를 사용합니다.

```json
{
  "batch": {},
  "accounts": [],
  "posts": []
}
```

필드 의미:

- `batch`: package 자체의 metadata입니다.
- `accounts`: import할 post가 참조하는 account 목록입니다.
- `posts`: 생성 또는 update할 post 목록입니다.

## 3. Batch Schema

`batch` field:

- `external_id`: 필수. batch를 식별하는 안정적인 id입니다.
- `source`: optional. package를 만든 program/source 이름입니다.
- `created_at`: optional. package 생성 시각입니다.

예:

```json
{
  "external_id": "batch-2026-06-09-090000",
  "source": "analysis-program",
  "created_at": "2026-06-09T09:00:00"
}
```

## 4. Account Schema

`accounts[]` field:

- `external_id`: 필수. account upsert key입니다.
- `handle`: 필수. UI에 표시될 account handle입니다.
- `display_name`: 필수. UI에 표시될 account 이름입니다.
- `bio`: optional. account 소개입니다.
- `avatar_url`: optional. browser-accessible avatar URL/path입니다.

예:

```json
{
  "external_id": "sample-gallery-account",
  "handle": "sample_gallery",
  "display_name": "Sample Gallery Account",
  "bio": "Sample account for visual post packages.",
  "avatar_url": "/assets/generated/sample-gallery-account.png"
}
```

## 5. Post Schema

`posts[]` field:

- `external_id`: 필수. post upsert key입니다.
- `account_external_id`: 필수. post owner account를 `accounts[].external_id` 또는 DB의 existing account로 참조합니다.
- `title`: 필수. post 제목입니다.
- `text`: optional. post 본문입니다.
- `created_at`: optional. post 생성 시각입니다.
- `tags`: optional. string array입니다.
- `metadata_json`: optional. domain-specific value를 담는 object입니다.
- `assets`: optional. asset descriptor array입니다.

예:

```json
{
  "external_id": "post-gallery-2026-06-10-001",
  "account_external_id": "sample-gallery-account",
  "title": "Multi image gallery",
  "text": "A general social-style post with several images.",
  "created_at": "2026-06-10T09:00:00",
  "tags": ["gallery", "sample"],
  "metadata_json": {
    "source": "manual-json",
    "contentType": "gallery"
  },
  "assets": []
}
```

## 6. Asset Schema

`assets[]` field:

- `external_id`: 권장. asset을 안정적으로 식별하는 id입니다.
- `type`: 필수. asset type입니다.
- `url`: 필수. browser-accessible URL/path입니다.
- `title`: optional. asset 제목입니다.
- `description`: optional. asset 설명입니다.
- `sort_order`: optional integer. 표시 순서입니다.

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
  "external_id": "asset-gallery-2026-06-10-001-image-001",
  "type": "image",
  "url": "/assets/generated/gallery_001_01.png",
  "title": "First image",
  "description": "Representative image.",
  "sort_order": 1
}
```

## 7. MVP12 Asset 정책

MVP12 기준 asset viewer 정책:

- `image`와 `plot`은 visual asset으로 처리됩니다.
- `plot`은 PNG/SVG 등 이미지 파일로 저장된 plot으로 봅니다.
- interactive chart rendering은 v0.0.0에서 지원하지 않습니다.
- 한 post에 여러 `image`/`plot` asset을 넣을 수 있습니다.
- Visual asset은 `sort_order` 순서대로 gallery/lightbox에 표시됩니다.
- `table`은 CSV preview 대상입니다.
- `file`은 inline preview가 아니라 Open original 중심으로 표시됩니다.
- `link`는 hyperlink/card로 표시됩니다.

한 post에 여러 visual asset을 넣을 때 새 top-level field를 만들지 않습니다.

잘못된 예:

```json
{
  "images": [],
  "plots": []
}
```

올바른 예:

```json
{
  "assets": [
    { "type": "image", "url": "/assets/generated/a.png", "sort_order": 1 },
    { "type": "plot", "url": "/assets/generated/b.svg", "sort_order": 2 }
  ]
}
```

## 8. `external_id` 정책

`external_id`는 import 안정성의 핵심입니다.

- 같은 post를 update하려면 `post.external_id`를 유지합니다.
- 새 post를 만들려면 `post.external_id`를 새로 만듭니다.
- `account.external_id`는 안정적으로 유지합니다.
- `asset.external_id`도 안정적으로 유지하는 것을 권장합니다.
- 매번 `post.external_id`를 바꾸면 같은 내용이 새 post로 계속 insert될 수 있습니다.

권장 naming:

```text
batch-YYYY-MM-DD-HHMMSS
account-{source-or-purpose}
post-{source}-{date}-{serial}
asset-{source}-{date}-{serial}
```

## 9. `asset.url` 정책

`asset.url`은 UI 브라우저에서 접근 가능한 URL/path여야 합니다.

권장:

```text
/assets/generated/sample_summary.csv
/assets/generated/trend_plot_001.png
https://example.com/static/report-file.pdf
```

금지:

```text
C:\data\report\trend_plot_001.png
feed-prototype/backend/local/trend_plot_001.png
```

중요 정책:

- import script는 asset 파일을 복사하지 않습니다.
- JSON에는 browser-accessible URL/path만 저장합니다.
- local file을 UI에서 보여주려면 `public/assets/generated/` 같은 static/public 위치에 두고 `/assets/generated/...` path로 참조하는 것을 권장합니다.
- Windows 절대경로 `C:\...`는 browser URL이 아니므로 사용하지 않습니다.

## 10. `sort_order` 정책

`sort_order`는 각 post의 `assets` 안에서 표시 순서를 안정화합니다.

- 각 post의 assets 안에서 `1`부터 시작하는 integer를 권장합니다.
- image/plot gallery 및 lightbox 표시 순서에 사용됩니다.
- table/file/link section 표시 순서에도 사용할 수 있습니다.
- `sort_order`가 없어도 fallback은 가능하지만 명시를 권장합니다.
- 같은 post 안에서 같은 `sort_order`를 중복 사용하지 않는 것을 권장합니다.

예:

```json
[
  { "type": "plot", "url": "/assets/generated/trend.png", "sort_order": 1 },
  { "type": "table", "url": "/assets/generated/summary.csv", "sort_order": 2 },
  { "type": "file", "url": "/assets/generated/source.json", "sort_order": 3 }
]
```

## 11. 예시 JSON

### 일반 SNS post 예시: image 여러 개

```json
{
  "batch": {
    "external_id": "batch-social-gallery-2026-06-10",
    "source": "manual-gallery-generator",
    "created_at": "2026-06-10T09:00:00"
  },
  "accounts": [
    {
      "external_id": "account-local-gallery",
      "handle": "local_gallery",
      "display_name": "Local Gallery",
      "bio": "General SNS-like gallery samples.",
      "avatar_url": "/assets/generated/local-gallery-avatar.png"
    }
  ],
  "posts": [
    {
      "external_id": "post-local-gallery-2026-06-10-001",
      "account_external_id": "account-local-gallery",
      "title": "Weekend photo set",
      "text": "Several images in one post.",
      "created_at": "2026-06-10T09:00:00",
      "tags": ["gallery", "weekend"],
      "metadata_json": {
        "source": "manual-gallery-generator",
        "contentType": "social-gallery"
      },
      "assets": [
        {
          "external_id": "asset-local-gallery-2026-06-10-001-image-001",
          "type": "image",
          "url": "/assets/generated/weekend_001.png",
          "title": "First image",
          "description": "First gallery image.",
          "sort_order": 1
        },
        {
          "external_id": "asset-local-gallery-2026-06-10-001-image-002",
          "type": "image",
          "url": "/assets/generated/weekend_002.png",
          "title": "Second image",
          "description": "Second gallery image.",
          "sort_order": 2
        }
      ]
    }
  ]
}
```

### 분석 리포트 post 예시: plot + table + file + link

```json
{
  "batch": {
    "external_id": "batch-analysis-2026-06-10-090000",
    "source": "analysis-program",
    "created_at": "2026-06-10T09:00:00"
  },
  "accounts": [
    {
      "external_id": "account-analysis-bot",
      "handle": "analysis_bot",
      "display_name": "Analysis Bot",
      "bio": "Generated analysis report posts.",
      "avatar_url": "/assets/generated/analysis-bot-avatar.png"
    }
  ],
  "posts": [
    {
      "external_id": "post-analysis-2026-06-10-001",
      "account_external_id": "account-analysis-bot",
      "title": "Daily analysis summary",
      "text": "Generated plot, CSV table, source file, and link are attached.",
      "created_at": "2026-06-10T09:00:00",
      "tags": ["daily-report", "analysis"],
      "metadata_json": {
        "source": "analysis-program",
        "reportDate": "2026-06-10",
        "status": "generated",
        "scenario": "metadata_json example"
      },
      "assets": [
        {
          "external_id": "asset-analysis-2026-06-10-001-plot",
          "type": "plot",
          "url": "/assets/generated/analysis_trend_001.png",
          "title": "Trend plot",
          "description": "Saved PNG plot generated by analysis program.",
          "sort_order": 1
        },
        {
          "external_id": "asset-analysis-2026-06-10-001-table",
          "type": "table",
          "url": "/assets/generated/analysis_summary_001.csv",
          "title": "Summary CSV",
          "description": "CSV table preview target.",
          "sort_order": 2
        },
        {
          "external_id": "asset-analysis-2026-06-10-001-file",
          "type": "file",
          "url": "/assets/generated/source_payload_001.json",
          "title": "Source payload",
          "description": "Original source payload.",
          "sort_order": 3
        },
        {
          "external_id": "asset-analysis-2026-06-10-001-link",
          "type": "link",
          "url": "https://example.com/internal/analysis/2026-06-10-001",
          "title": "External analysis record",
          "description": "Plain hyperlink card.",
          "sort_order": 4
        }
      ]
    }
  ]
}
```

## 12. Dry-run / Import 명령

Backend 폴더에서 실행합니다.

```bash
cd feed-prototype/backend
```

Dry-run:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

MVP12 asset viewer sample:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

v0.0.0 demo sample:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json

python -m app.services.import_external_posts --input ../data/external_posts/examples/analysis_report_sample/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/analysis_report_sample/feed_posts.json

python -m app.services.import_external_posts --input ../data/external_posts/examples/broken_asset_sample/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/broken_asset_sample/feed_posts.json
```

Import 전에 `backend/.env`의 `DATABASE_URL`이 의도한 DB를 가리키는지 확인합니다.

## 13. 자주 하는 실수

- `post.external_id`를 매번 바꿔서 duplicate post가 생깁니다.
- `account_external_id`가 `accounts[]`에도 없고 DB에도 없습니다.
- `asset.url`이 브라우저에서 열리지 않습니다.
- Windows 절대경로 `C:\...`를 `asset.url`에 넣습니다.
- 같은 post 안에서 `sort_order`가 중복됩니다.
- JSON trailing comma 때문에 parse error가 납니다.
- `metadata_json`이 object가 아니라 string/list/null입니다.
- `tags`가 string array가 아니라 string 하나로 들어갑니다.
- image/plot을 `assets`가 아닌 `images`, `plots` field에 따로 넣습니다.
- interactive chart spec을 `plot` asset으로 넣고 UI rendering을 기대합니다.

## 14. 기존 문서와의 관계

이 문서가 v0.0.0 / MVP12 기준 external post package의 중심 guide입니다.

기존 문서 역할:

- `archive/MVP10_EXTERNAL_POST_FORMAT.md`: MVP10 format history와 상세 참고
- `../data/external_posts/README.md`: external post package 작업 폴더 설명
- `archive/MVP10_TEST_PROCEDURE.md`: 과거 MVP10 회귀 테스트 절차

새 package를 작성할 때는 이 문서를 먼저 보고, 세부 회귀 확인이 필요할 때 historical MVP 문서를 참고합니다.
