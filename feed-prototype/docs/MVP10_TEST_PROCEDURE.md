# MVP10 실행 및 테스트 절차

MVP10은 **External Post Ingestion Pipeline**입니다. 이 문서는 외부 post JSON package를 DB에 넣고, 기존 UI에서 일반 post처럼 확인하기 위한 실행 절차와 테스트 체크리스트입니다.

## 1. MVP10 목표 요약

MVP10의 목표:

- 외부 post JSON package를 backend DB에 import합니다.
- `account`, `post`, `assets`, `metadata_json`을 upsert합니다.
- `external_id` 기반으로 같은 JSON 반복 import 시 post 중복 생성을 방지합니다.
- import 전 검증을 위한 `--dry-run`을 지원합니다.
- 테스트 DB와 운영/갱신 DB를 분리해서 사용할 수 있습니다.
- import된 post가 기존 UI에서 일반 post처럼 표시됩니다.

MVP10은 UI file upload, S3 upload, folder watch, scheduler, import dashboard, metadata search, 정식 auth 기능이 아닙니다.

## 2. 전제 조건

필요한 상태:

- PostgreSQL이 실행 중이어야 합니다.
- `feed-prototype/backend/.env` 또는 `DATABASE_URL`이 준비되어야 합니다.
- Alembic migration이 적용되어야 합니다.
- seed data 삽입이 가능해야 합니다.
- backend 실행이 가능해야 합니다.
- frontend 실행이 가능해야 합니다.
- MVP9까지의 post create/edit/delete, assets, tags, metadata 기능이 동작하는 상태여야 합니다.

`.env` 예:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_dev
```

`.env` 파일은 Git에 올리지 않습니다.

## 2-1. 어떤 DB로 테스트할지 선택하기

MVP10 import 테스트는 크게 두 가지 방식으로 할 수 있습니다.

```text
방식 A: 기존 DB로 테스트
- backend/.env.example의 기본 DB 이름인 feed_prototype을 사용
- 기존 seed data와 MVP 기능 테스트용 data가 같이 들어갈 수 있음
- 빠른 smoke test에 적합

방식 B: 새 DB로 내 데이터 테스트
- 예: feed_ops 또는 feed_import_test 같은 새 DB 생성
- 외부 post import와 UI 확인을 기존 개발 DB와 분리
- 실제 운영/갱신 flow에 더 가까움
```

중요한 원칙:

- backend와 import script는 `backend/.env`의 `DATABASE_URL`을 읽습니다.
- `$env:DATABASE_URL`을 현재 PowerShell session에 설정하면 그 값이 우선 사용될 수 있습니다.
- `--database-url`을 import command에 넘기면 해당 명령에서만 DB URL을 override합니다.
- 새 DB를 한 번 만들어 놓은 뒤 `backend/.env`의 `DATABASE_URL`을 그 DB로 바꾸면 됩니다.
- DB를 새로 만들면 반드시 `alembic upgrade head`를 다시 실행해야 table/migration이 준비됩니다.
- 필요하면 `python -m app.services.seed`로 seed data를 넣습니다. 외부 import만 확인할 DB라면 seed는 선택 사항입니다.

## 2-2. 방식 A: 기존 DB로 테스트하기

`.env.example` 기본값을 사용하는 절차입니다. 기본 DB 이름은 `feed_prototype`입니다.

1. PostgreSQL에서 `feed_prototype` DB를 준비합니다.
2. `.env.example`을 복사해 `backend/.env`를 만듭니다.

```powershell
cd C:\...\feed-prototype
copy backend\.env.example backend\.env
```

3. `backend/.env`가 아래처럼 되어 있는지 확인합니다.

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

4. migration과 seed를 실행합니다.

```powershell
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.services.seed
```

5. sample JSON을 dry-run합니다.

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

6. 문제가 없으면 actual import를 실행합니다.

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

7. backend와 frontend를 실행해 UI에서 확인합니다.

```powershell
python -m uvicorn app.main:app --reload
```

다른 terminal:

```powershell
cd C:\...\feed-prototype
$env:VITE_DATA_SOURCE="api"
npm run dev
```

## 2-3. 방식 B: 새 DB에 내 데이터 올려 테스트하기

기존 개발 DB와 분리해 외부 import용 DB를 새로 만드는 절차입니다. 예시는 `feed_ops`를 사용합니다.

1. PostgreSQL에서 새 DB를 만듭니다.

```text
feed_ops
```

pgAdmin, psql, DBeaver 등 편한 도구로 만들면 됩니다. psql을 쓴다면 예시는 다음과 같습니다.

```powershell
createdb -U postgres feed_ops
```

2. `backend/.env`의 `DATABASE_URL`을 새 DB로 바꿉니다.

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_ops
```

3. 새 DB에 migration을 적용합니다.

```powershell
cd C:\...\feed-prototype\backend
alembic upgrade head
```

4. seed data가 필요하면 넣습니다.

```powershell
python -m app.services.seed
```

seed는 선택 사항입니다. 다만 UI에서 기존 demo user로 login-like selection을 하거나 follow를 테스트하려면 넣는 편이 편합니다.

5. 내 batch package를 `incoming`에 둡니다.

```text
feed-prototype/data/external_posts/incoming/batch_2026-06-09_090000/
  feed_posts.json
  assets/
```

6. 먼저 dry-run합니다.

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --dry-run
```

7. count와 validation 결과가 맞으면 actual import를 실행합니다.

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json
```

8. backend와 frontend를 실행해 UI에서 확인합니다.

```powershell
python -m uvicorn app.main:app --reload
```

다른 terminal:

```powershell
cd C:\...\feed-prototype
$env:VITE_DATA_SOURCE="api"
npm run dev
```

정리하면, 새 DB를 한 번 만든 뒤에는 `backend/.env`의 `DATABASE_URL`만 그 DB로 연결하면 됩니다. 단, 새 DB마다 migration은 반드시 적용해야 합니다.

## 3. 외부 post package 구조

권장 package 구조:

```text
batch_YYYY-MM-DD_HHMMSS/
  feed_posts.json
  assets/
    image_or_plot_files.png
    table_files.csv
```

예제 위치:

```text
feed-prototype/data/external_posts/examples/feed_import_sample.json
feed-prototype/data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
feed-prototype/data/external_posts/examples/batch_2026-06-09_090000/assets/README.md
```

실제 운영 package는 보통 아래에 둡니다.

```text
feed-prototype/data/external_posts/incoming/
```

`incoming`의 실제 운영 데이터는 Git에 넣지 않는 것을 권장합니다.

## 4. feed_posts.json 양식

기본 구조:

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

- `external_id`: 필수. import batch 식별자입니다.
- `source`: optional. JSON을 만든 프로그램 또는 source 이름입니다.
- `created_at`: optional. batch 생성 시각입니다.

`account` 필드:

- `external_id`: 필수. account upsert 기준입니다.
- `handle`: 필수. UI에 표시되는 account handle입니다.
- `display_name`: 필수. UI에 표시되는 account 이름입니다.
- `bio`: optional. account 설명입니다.
- `avatar_url`: optional. 브라우저에서 접근 가능한 avatar URL/path입니다.

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

`post` 필드:

- `external_id`: 필수. post upsert 기준입니다.
- `account_external_id`: 필수. post를 작성한 account의 `external_id`입니다.
- `title`: 필수. post 제목입니다.
- `text`: optional. post 본문입니다.
- `created_at`: optional. post 생성 시각입니다.
- `tags`: optional. `list[string]`입니다.
- `metadata_json`: optional. object입니다. 도메인 특화 값은 여기에 넣습니다.
- `assets`: optional. asset descriptor list입니다.

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

`asset` 필드:

- `external_id`: 권장. asset 식별자입니다.
- `type`: 필수. `image`, `plot`, `table`, `file`, `link` 중 하나입니다.
- `url`: 필수. UI 브라우저에서 접근 가능한 URL/path입니다.
- `title`: optional. asset 제목입니다.
- `description`: optional. asset 설명입니다.

예:

```json
{
  "external_id": "asset-temp-2026-06-09-001",
  "type": "image",
  "url": "/assets/generated/temp_trend_001.png",
  "title": "Temperature trend",
  "description": "Generated temperature trend plot."
}
```

## 5. backend 실행 절차

Windows + conda 기준 예시:

```powershell
cd C:\...\feed-prototype
conda activate feed-backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.services.seed
python -m uvicorn app.main:app --reload
```

backend 기본 URL:

```text
http://127.0.0.1:8000
```

간단 확인:

```powershell
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
```

## 6. dry-run 테스트

backend 폴더에서 실행:

```powershell
cd backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

확인할 것:

- validation error가 없어야 합니다.
- account/user/post/assets create/update count가 표시되어야 합니다.
- `External post import dry-run summary`가 출력되어야 합니다.
- DB에 실제 write가 없어야 합니다.
- dry-run 후 account/post/asset row 수가 늘어나지 않아야 합니다.

예상 출력 형태:

```text
External post import dry-run summary
Input: ../data/external_posts/examples/feed_import_sample.json
Batch: batch-2026-06-09-090000
Accounts:
- create: 1
- update: 0
Posts:
- create: 2
- update: 0
Assets:
- replace target posts: 2
- create: 5
Errors:
- 0
```

## 7. actual import 테스트

backend 폴더에서 실행:

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

확인할 것:

- account가 생성 또는 update됩니다.
- post가 생성 또는 update됩니다.
- assets가 생성 또는 replacement됩니다.
- `imported_at`이 갱신됩니다.
- `import_batch_external_id`가 저장됩니다.
- import summary가 출력됩니다.

예상 출력 형태:

```text
External post import completed
Batch: batch-2026-06-09-090000
Users created: 1
Accounts created: 1
Posts created: 2
Assets created: 5
```

## 8. 중복 import 테스트

같은 명령을 한 번 더 실행합니다.

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

확인할 것:

- 같은 `external_id`의 post가 중복 생성되지 않아야 합니다.
- 첫 import보다 create count는 줄고 update count가 증가해야 합니다.
- UI에 같은 post가 두 개 생기지 않아야 합니다.
- assets는 post 단위 replacement 정책에 따라 최신 JSON 내용으로 교체되어야 합니다.

중요:

```text
같은 post를 update하려면 post.external_id를 유지합니다.
새 post로 넣으려면 post.external_id를 새로 만듭니다.
```

## 9. UI 확인

frontend API mode로 실행합니다.

```powershell
cd feed-prototype
npm run dev
```

API mode 설정은 프로젝트의 기존 `VITE_DATA_SOURCE=api` 방식 또는 `.env` 설정을 따릅니다.

확인할 것:

- imported account profile이 표시되는지 확인합니다.
- imported account의 post list가 표시되는지 확인합니다.
- imported post detail이 표시되는지 확인합니다.
- image asset preview가 표시되는지 확인합니다.
- table/file/link/plot asset이 placeholder 또는 link card로 표시되는지 확인합니다.
- tags가 표시되는지 확인합니다.
- metadata가 표시되는지 확인합니다.
- `created_at`, `updated_at`, `imported_at` 표시가 이상하지 않은지 확인합니다.

Home Feed에서 보이지 않는 경우:

- API Home Feed는 active API user의 own account와 followed account post를 보여줍니다.
- import된 account는 자동 follow되지 않습니다.
- Profile/Post Detail에는 보이지만 Home Feed에는 안 보일 수 있습니다.
- 필요한 경우 active user가 import account를 follow한 뒤 Home Feed를 확인합니다.
- import script가 만든 user를 active API user로 선택하면 imported account의 own post로 보일 수 있습니다.

## 10. 테스트 DB와 운영 DB 분리

권장 DB 분리:

```text
feed_dev
- MVP 기능 개발/테스트용

feed_ops
- 외부 post import 및 UI 확인용
```

같은 backend code를 사용하되, `DATABASE_URL`만 다르게 설정합니다.

운영 DB import 예:

```powershell
$env:DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST:PORT/feed_ops"
cd backend
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/incoming/batch_2026-06-09_090000/feed_posts.json
```

주의:

- `.env`는 Git에 올리지 않습니다.
- 운영 DB에는 반드시 `--dry-run`을 먼저 실행합니다.
- `DATABASE_URL`이 어느 DB를 가리키는지 확인합니다.
- `--database-url` 인자를 쓰는 경우, 명령 하나에만 override가 적용됩니다.

## 11. validation/error 테스트

다음 케이스가 실패하는지 확인합니다.

```text
input file 없음
JSON 문법 오류
batch.external_id 없음
account.external_id 없음
post.external_id 없음
post.account_external_id 없음
post.title 없음
account_external_id가 accounts에도 DB에도 없음
asset.type 없음
asset.type invalid
asset.url 없음
tags가 list가 아님
metadata_json이 object가 아님
```

추가로 확인하면 좋은 케이스:

```text
asset.url이 C:\... 형태의 Windows 절대경로
payload 안 account.external_id 중복
payload 안 post.external_id 중복
payload 안 asset.external_id 중복
```

기대 결과:

- 명확한 error가 출력되어야 합니다.
- 실패한 import는 DB에 부분 반영을 남기지 않아야 합니다.
- dry-run 실패도 DB write를 남기지 않아야 합니다.

## 12. 자주 발생하는 문제

`external_id`를 매번 바꿔서 중복 post가 생김:

- 같은 post를 update하려면 `post.external_id`를 유지해야 합니다.

같은 post를 update하려는데 `post.external_id`를 바꿈:

- 새 post로 insert됩니다.

`account_external_id`가 `accounts`에도 DB에도 없음:

- 해당 post를 어느 account에 연결할 수 없어 import가 실패합니다.

asset URL이 브라우저에서 접근 불가능함:

- DB에는 저장되더라도 UI preview/link가 열리지 않습니다.

Windows 절대경로를 URL처럼 넣음:

- `C:\...` 경로는 브라우저 URL이 아닙니다.
- MVP10 validation에서 Windows 절대경로는 막습니다.

JSON comma 오류:

- JSON parse error가 발생합니다.
- import 전에 JSON formatter나 validator로 확인합니다.

dry-run 없이 운영 DB에 바로 import함:

- 운영 DB import 전에는 항상 `--dry-run`을 먼저 실행합니다.

`DATABASE_URL`을 잘못 잡음:

- 테스트 DB에 넣을 데이터를 운영 DB에 넣을 수 있습니다.
- import 전 현재 `.env` 또는 `$env:DATABASE_URL`을 확인합니다.

Home Feed에 import post가 안 보임:

- follow 정책 때문일 수 있습니다.
- Profile/Post Detail에는 보이지만 Feed에는 안 보일 수 있습니다.
- active user가 import account를 follow한 뒤 확인합니다.

table asset이 실제 table로 안 보임:

- MVP10에서는 table parsing을 하지 않습니다.
- placeholder 또는 link card가 정상입니다.

asset 파일을 import script가 복사한다고 착각함:

- MVP10 import script는 asset 파일을 복사하지 않습니다.
- JSON의 `asset.url`만 DB에 저장합니다.
- 파일은 별도로 UI가 접근 가능한 static 위치에 있어야 합니다.

## 13. mock mode 회귀 테스트

mock mode는 external import 대상이 아닙니다. external import는 backend DB/API mode용 기능입니다.

mock mode 확인:

```powershell
$env:VITE_DATA_SOURCE="mock"
npm run dev
```

확인할 것:

- backend 없이 mock mode가 동작해야 합니다.
- 기존 local user entry가 동작해야 합니다.
- local registration이 동작해야 합니다.
- mock Home Feed가 표시되어야 합니다.
- mock follow/unfollow가 동작해야 합니다.
- mock Account Profile이 표시되어야 합니다.
- mock Post Detail이 표시되어야 합니다.
- mock mode localStorage 동작이 유지되어야 합니다.

## 14. build/git 확인

build 확인:

```powershell
cd feed-prototype
npm run build
```

Git 상태 확인:

```powershell
git status
git diff
```

확인할 것:

- `.env`가 Git에 잡히지 않아야 합니다.
- 실제 DB dump가 없어야 합니다.
- `node_modules`가 Git에 잡히지 않아야 합니다.
- migration 파일은 포함되어야 합니다.
- `data/external_posts/examples`는 포함 가능합니다.
- `data/external_posts/incoming`의 실제 운영 데이터는 Git에 넣지 않는 것을 권장합니다.
- backend `.venv`가 Git에 잡히지 않아야 합니다.

## 15. MVP10 성공 기준

MVP10 완료 판단 기준:

- sample JSON dry-run이 가능해야 합니다.
- sample JSON actual import가 가능해야 합니다.
- 같은 JSON을 두 번 import해도 post 중복 생성이 없어야 합니다.
- import된 account가 DB에 생성/갱신되어야 합니다.
- import된 post가 DB에 생성/갱신되어야 합니다.
- import된 assets가 post에 연결되어야 합니다.
- `metadata_json`, `tags`, `created_at`, `updated_at`, `imported_at`이 UI에서 깨지지 않아야 합니다.
- UI에서 imported post를 Account Profile 또는 Post Detail에서 확인할 수 있어야 합니다.
- Home Feed 표시 여부는 follow 정책과 일치해야 합니다.
- 테스트 DB/운영 DB 분리 가이드가 있어야 합니다.
- 외부 post JSON 작성 가이드가 있어야 합니다.
- mock mode 기존 기능이 유지되어야 합니다.
- `npm run build`가 통과해야 합니다.
