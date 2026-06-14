# 외부 Post Import Package

현재 릴리즈 기준: `v0.3.3`. external post package format은 v0.0.0 시점에 동결되어 v0.1.x·v0.2.x·v0.3.x에서도 변경되지 않았습니다(`docs/EXTERNAL_POST_PACKAGE_GUIDE.md`의 Format Stability 참고). v0.3.0은 같은 package를 HTTP(`POST /api/imports`)로도 받을 수 있게 했고, v0.3.1은 import 사건을 `import_batch` 테이블에 기록하며, v0.3.2는 `incoming/`의 package를 일괄 import한 뒤 `archive/`(성공)·`failed/`(실패)로 자동 이동하고, v0.3.3은 opt-in으로 상대 로컬 경로 asset을 managed storage로 복사하지만 format은 그대로입니다.

이 문서는 external import mode의 package guide입니다. 외부 프로그램이 만든 JSON package를 backend DB에 넣고, API mode UI가 import된 post를 일반 post처럼 표시하는 흐름을 다룹니다.

이 폴더는 MVP10 **External Post Ingestion Pipeline**을 위한 외부 post package 작업 공간입니다. MVP12 **Asset Viewer Enhancement**부터 asset descriptor에 optional `sort_order`를 포함해 viewer 표시 순서를 안정적으로 지정할 수 있습니다.

MVP10은 UI에서 post를 직접 작성하는 기능이 아닙니다. 외부 분석 프로그램 또는 post 생성 프로그램이 JSON 기반 post package를 만들고, import script가 그 package를 backend DB에 넣습니다. import된 post는 기존 UI에서 일반 post처럼 표시되어야 합니다.

## 폴더 구조

```text
data/external_posts/
  README.md
  examples/
    feed_import_sample.json
    general_social_sample/
      feed_posts.json
      assets/
        README.md
    analysis_report_sample/
      feed_posts.json
      assets/
        README.md
        sample_summary.csv
    broken_asset_sample/
      feed_posts.json
      assets/
        README.md
    batch_2026-06-09_090000/
      feed_posts.json
      assets/
        README.md
    batch_mvp12_asset_viewer/
      feed_posts.json
      assets/
        README.md
        sample_summary.csv
  incoming/
  archive/
  failed/
```

각 폴더의 의미:

- `examples`: 사람이 참고하거나 외부 generator가 따라 쓸 수 있는 샘플 JSON입니다.
  (자동 처리 대상이 아니며, `process_incoming`은 절대 건드리지 않습니다.)
- `incoming`: import 대기 중인 package를 두는 위치입니다. package는 단일 `.json`
  파일 또는 `feed_posts.json`을 포함한 디렉터리입니다.
- `archive`: import **성공** package가 이동되는 위치입니다.
- `failed`: import **실패** package가 이동되는 위치입니다.

**v0.3.2부터** `python -m app.services.process_incoming`(또는 `--watch`)이
`incoming/`을 일괄 처리하고 결과에 따라 package를 `archive/`(성공)·`failed/`(실패)로
**자동 이동**합니다(이름 충돌 시 덮어쓰지 않고 타임스탬프 접미사). 자동 이동은 이
`incoming/` 처리 경로에서만 일어나며, 단일 파일 CLI(`import_external_posts
--input`)와 HTTP import(`POST /api/imports`)는 파일을 이동하지 않습니다. watch가
쓰다 만 파일을 집지 않도록 package writer는 임시 파일에 쓴 뒤 rename(atomic)으로
`incoming/`에 넣는 것을 권장합니다. 상세는 `docs/V0_3_2_AUTO_INGESTION_SCOPE.md`.
(MVP10~v0.3.1까지는 자동 이동이 없었고 수동 보관만 가능했습니다.)

v0.0.0 / MVP12 기준 JSON package 작성 가이드는 `feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md`를 먼저 참고하세요.

MVP10 format history와 세부 참고는 `feed-prototype/docs/archive/MVP10_EXTERNAL_POST_FORMAT.md`에 남겨둡니다.

현재 실행 절차와 dry-run/import 검증은 `feed-prototype/docs/RELEASE_0_0_RUNBOOK.md`를 참고하세요. 과거 MVP10 회귀 테스트 절차는 `feed-prototype/docs/archive/MVP10_TEST_PROCEDURE.md`에 보관되어 있습니다.

## Import 흐름

```text
분석 프로그램 / post 생성 프로그램
  -> post JSON 생성
  -> image / plot / table / file asset 생성
  -> data/external_posts/incoming 아래에 package 저장
  -> import script가 JSON 읽기
  -> import script가 package 검증
  -> accounts / posts / assets / metadata_json upsert
  -> UI가 API mode로 backend DB 데이터 읽기
  -> import된 post가 일반 post처럼 표시됨
```

## DB 선택

import script는 backend의 `.env` 또는 `DATABASE_URL`에 설정된 DB 연결 정보를 사용합니다.

테스트용 DB와 운영/갱신용 DB는 다른 `DATABASE_URL`로 분리할 수 있습니다. frontend는 계속 FastAPI를 통해 데이터를 읽어야 하며 PostgreSQL에 직접 연결하지 않습니다.

## CLI 사용법

backend 폴더에서 실행합니다.

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

batch package 형태의 예제:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
```

MVP12 asset viewer 전용 예제:

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

CSV preview를 성공 케이스로 확인하려면 sample CSV를 browser-accessible static 위치로 복사합니다.

```text
from: data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
to:   public/assets/generated/sample_summary.csv
url:  /assets/generated/sample_summary.csv
```

이미지, plot, PDF/HTML 같은 큰 binary sample은 repo에 넣지 않습니다. 필요하면 작은 local file을 `public/assets/generated/` 아래에 직접 두고 sample JSON의 URL과 맞춥니다.

특정 DB URL을 명령에서 직접 지정할 수도 있습니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --database-url postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype_import_test
```

## JSON Package 기본 형태

최상위 필드:

- `batch`: import batch 메타데이터입니다.
- `accounts`: import post가 참조할 account 목록입니다.
- `posts`: 생성 또는 update할 post 목록입니다.

최소 형태:

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

`batch` 필드:

- `external_id`: 필수. 안정적인 batch id입니다.
- `source`: optional. generator 또는 source 이름입니다.
- `created_at`: optional. batch 생성 시각입니다.

`accounts[]` 필드:

- `external_id`: 필수. account upsert 기준 key입니다.
- `handle`: UI에 표시될 account handle입니다.
- `display_name`: UI에 표시될 account 이름입니다.
- `bio`: optional. account 소개입니다.
- `avatar_url`: optional. account avatar의 URL/path입니다.

`posts[]` 필드:

- `external_id`: 필수. post upsert 기준 key입니다.
- `account_external_id`: 필수. `accounts[]` 또는 DB에 존재하는 account를 참조합니다.
- `title`: 필수. post 제목입니다.
- `text`: optional. post 본문입니다.
- `created_at`: optional. post 생성 시각입니다.
- `tags`: optional. string list입니다.
- `metadata_json`: optional. 도메인 특화 값을 담는 object입니다.
- `assets`: optional. asset descriptor list입니다.

`assets[]` 필드:

- `external_id`: 권장. 안정적인 asset id입니다.
- `type`: 필수. asset type입니다.
- `url`: 필수. UI 브라우저에서 접근 가능한 URL/path입니다.
- `title`: optional. asset 제목입니다.
- `description`: optional. asset 설명입니다.
- `sort_order`: optional integer. MVP12 viewer에서 asset 표시 순서로 사용합니다.

MVP10에서 허용하는 asset type:

```text
image
plot
table
file
link
```

MVP12 asset viewer 정책:

- `image`와 `plot`은 같은 visual asset으로 처리합니다.
- `plot`은 Plotly/Vega 같은 interactive chart가 아니라 PNG/SVG 등 저장된 image file로 봅니다.
- visual asset은 `sort_order` 오름차순으로 표시합니다.
- `sort_order`가 없으면 기존 배열 순서, 생성 시각, id fallback을 사용할 수 있습니다.
- 같은 `sort_order`가 여러 개 있으면 생성 시각 또는 id fallback으로 보조 정렬할 수 있습니다.
- `table`은 CSV로 보고 앞 몇 행만 preview합니다.
- table preview 실패 시 fallback card와 원본 열기 action을 제공합니다.
- `file`은 PDF/HTML 등을 포함할 수 있지만 inline preview 없이 원본 열기 card로 표시합니다.
- `link`는 hyperlink/card로 표시하며 OpenGraph scraping은 하지 않습니다.
- 깨진 asset URL은 앱 전체 crash가 아니라 fallback state로 처리해야 합니다.

여러 image/plot 작성 가이드:

- 한 post에 여러 image/plot을 넣고 싶으면 기존 `assets` 배열에 여러 asset을 넣습니다.
- `gallery`, `images`, `plots` 같은 새 field를 만들지 않습니다.
- post JSON 최상위 구조를 바꾸지 않습니다.
- `image`와 `plot`은 viewer에서 visual asset group으로 묶입니다.
- `table`, `file`, `link`는 별도 section/card로 표시됩니다.
- 기존 asset에 `sort_order`가 없어도 import와 UI는 동작해야 합니다.
- 안정적인 표시 순서가 필요하면 `sort_order`를 추가하는 것을 권장합니다.

예:

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
    }
  ]
}
```

MVP12 viewer sample package:

```text
data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

포함된 테스트 post:

- multi image/plot post: image 2개, plot 2개, `sort_order` 1-4
- table post: `sample_summary.csv`를 참조하는 table asset
- file/link post: HTML/PDF-like file path와 외부 link card
- broken fallback post: 존재하지 않는 image URL과 CSV URL

sort_order 테스트:

- `mvp12_plot_02.png`가 `sort_order: 1`입니다.
- `mvp12_image_01.png`가 `sort_order: 2`입니다.
- 파일명 순서가 아니라 `sort_order` 순서로 viewer가 표시되는지 확인합니다.

broken URL fallback 테스트:

- `/assets/generated/missing_mvp12_image.png`
- `/assets/generated/missing_mvp12_table.csv`

위 두 URL은 의도적으로 존재하지 않습니다. UI는 crash 대신 fallback preview를 보여야 합니다.

## Upsert 정책

MVP10은 `external_id` 기반 upsert를 사용합니다. 같은 JSON을 여러 번 import해도 같은 post가 계속 중복 생성되지 않습니다.

기준 key:

- Account upsert: `account.external_id`
- Post upsert: `post.external_id`
- Asset id/reference: `asset.external_id`

MVP10은 asset 파일을 복사하지 않습니다. JSON에는 UI가 접근 가능한 URL 또는 path만 저장합니다. (v0.3.3부터 opt-in으로 상대 로컬 경로 asset만 managed storage로 복사할 수 있습니다 — 아래 "Asset Managed Storage 복사" 참고. 기본은 종전과 동일하게 복사하지 않음.)

권장 `external_id` 패턴:

```text
batch-YYYY-MM-DD-HHMMSS
bot-{purpose}
manual-{name}
source-{system-name}
post-{source}-{date}-{serial}
asset-{source}-{date}-{serial}
```

`external_id`가 같으면 기존 데이터가 update됩니다. `external_id`가 바뀌면 새 데이터로 insert됩니다.

## Import Account와 User 연결 정책

MVP 단계에서는 각 `Account`에 정확히 하나의 `User`가 필요합니다. 그래서 import script는 import된 `Account`마다 generic import `User`를 하나 자동 생성합니다.

규칙:

- Imported account key: `account.external_id`
- Generated user id: `import-user-{normalized-account-external-id}`
- Generated user handle: `import.{normalized-account-external-id}`
- Generated account id: `import-account-{normalized-account-external-id}`
- Imported account kind: `bot`

현재 MVP10의 `User` model에는 `external_id`가 없습니다. 대신 deterministic `id`와 `handle` 규칙으로 안정성을 유지합니다. 이 정책은 설비/리포트 전용 개념을 core domain에 넣지 않기 위한 선택입니다.

## Asset Replacement 정책

post payload에 `assets` 필드가 있으면, 그 list를 해당 post의 최신 전체 asset list로 봅니다. 기존 asset은 삭제되고 imported list로 교체됩니다.

post payload에서 `assets` 필드를 생략하면 기존 asset은 유지됩니다. asset이 없는 상태가 정답이라면 외부 generator가 `assets: []`를 명시해야 합니다.

## Asset Managed Storage 복사 (v0.3.3, opt-in)

기본 동작은 종전과 같습니다: import는 asset의 `url` 문자열만 저장하고 파일은 복사하지 않습니다. `backend/.env`에서 `MANAGE_ASSET_STORAGE=true`로 켜면, asset url이 **상대 로컬 경로**일 때 패키지 디렉터리(`feed_posts.json`의 위치) 기준으로 파일을 찾아 `public/assets/managed/<batch>/<asset>`으로 복사하고 DB에 저장되는 url을 `/assets/managed/...`로 재작성합니다.

규칙:

- `/assets/...`·`http(s)://`·`//`로 시작하는 url은 **건드리지 않습니다**(format 동결·하위호환). 이 url을 쓰는 기존 package는 토글과 무관하게 그대로 동작합니다.
- 상대 로컬 경로(예: `assets/img.png`)만 복사 후보입니다. 이 경우 실제 파일을 패키지 폴더 안 `assets/` 등에 함께 두어야 합니다.
- 복사는 디스크 패키지가 있는 CLI(`import_external_posts --input`)와 `process_incoming` 경로에만 적용됩니다. **HTTP import(`POST /api/imports`)는 파일이 없어 적용되지 않습니다.**
- 원본 파일 누락·패키지 밖 경로(`../` 탈출)·복사 실패는 import를 실패시키지 않고 원본 url을 그대로 둡니다(경고 로그).
- 목적지가 결정적이라 같은 package 재import 시 덮어씁니다(누적 없음).
- DB 스키마/마이그레이션·package format 변경은 없습니다.

예제: `examples/managed_copy_sample/`(상대 로컬 SVG asset + 서빙 URL asset). 상세 guide는 `../../docs/V0_3_3_ASSET_STORAGE_SCOPE.md`.

## 지속 import 체크리스트

1. `data/external_posts/incoming` 아래에 새 batch 폴더를 만듭니다.
2. `feed_posts.json`을 작성합니다.
3. asset 파일을 브라우저가 접근 가능한 위치에 둡니다.
4. 각 asset `url`이 그 위치를 가리키는지 확인합니다.
5. dry-run을 실행합니다.
6. validation error 또는 예상과 다른 count를 수정합니다.
7. actual import를 실행합니다.
8. API mode에서 Home Feed, Account Profile, Post Detail을 확인합니다.

예:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json
```

## 테스트 DB와 운영 DB 분리

필요하면 DB를 분리해서 사용합니다.

```text
feed_dev  - MVP 기능 테스트용
feed_ops  - 외부 post import 및 UI 확인용
```

같은 backend code를 사용하되 `.env`, `DATABASE_URL`, 또는 `--database-url` override만 바꿉니다. `.env`는 commit하지 않습니다. 운영 DB에 import하기 전에는 항상 `--dry-run`을 먼저 실행합니다.

## 자주 하는 실수

- 매번 `external_id`를 바꿔서 중복 post가 생김
- 같은 post를 update하려는데 `post.external_id`를 바꿈
- `account_external_id`가 payload와 DB 어디에도 없음
- asset `url`이 브라우저에서 접근 불가능함
- `C:\...` 같은 Windows local path를 asset URL처럼 넣음
- backend 내부 local path를 `asset.url`에 넣음
- `metadata_json`에 너무 복잡한 nested object를 너무 일찍 넣음
- JSON comma 누락 또는 trailing comma 오류
- 운영 DB에 `--dry-run` 없이 바로 import함
- `DATABASE_URL`을 잘못 설정해 의도하지 않은 DB에 import함

## Domain 정책

core feed domain은 generic하게 유지합니다.

```text
User
Account
Post
Feed
Follow
Asset
Metadata
```

core model, shared component, route, data flow에 설비 리포트 전용 이름을 넣지 않습니다. recipe, chamber, severity, equipment state, analysis status 같은 시나리오 전용 값은 `metadata_json` 또는 asset metadata에 넣습니다.

## Dry Run 확인

import command는 DB write 전에 package를 검증하기 위해 `--dry-run`을 지원합니다.

dry-run에서 기대하는 동작:

- JSON 읽기 및 validation
- 필수 필드 확인
- account/post 참조 확인
- create/update 예정 count 출력
- DB write 없음

## MVP10에서 하지 않는 것

MVP10은 다음을 구현하지 않습니다.

- UI file upload
- multipart/form-data upload
- S3 upload
- asset 파일 자동 복사
- folder watch
- scheduler 또는 Airflow 연동
- bot account 자동 분석/생성 로직
- metadata filter/search
- advanced asset viewer
- chart/table parsing
- batch 관리 UI
- import 결과 dashboard
- formal authentication, JWT, sessions, OAuth
- mock mode 제거

## MVP12에서 하지 않는 것

MVP12는 다음을 구현하지 않습니다.

- 실제 file upload
- S3 upload
- asset 파일 복사
- backend static serving 대규모 변경
- folder watch
- interactive chart rendering
- Plotly/Vega rendering
- PDF inline preview
- HTML iframe preview
- Excel parser
- 대용량 CSV 처리
- CSV 인코딩 자동 감지
- image zoom/pan
- touch swipe carousel
- fancy animation
- asset reorder UI
- asset edit 고도화
- OpenGraph link preview
- dashboard
- import pipeline 대규모 변경
- mock mode 제거
