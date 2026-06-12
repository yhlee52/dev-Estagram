# feed-prototype v0.0.0 실행 가이드

이 문서는 `feed-prototype` v0.0.0을 local 환경에서 재현 실행하기 위한 기준 runbook입니다.

## 1. v0.0.0 개요

`v0.0.0`은 일반 SNS-like feed와 external report feed를 데모할 수 있는 local/internal prototype release입니다.

이 release는 다음 흐름을 확인하는 데 초점을 둡니다.

- frontend 단독 mock mode UI demo
- FastAPI + PostgreSQL 기반 API mode read/write
- 외부 JSON post package import
- imported post의 asset, tag, metadata, filter/search, viewer 확인

production-ready app은 아니며, 정식 login/JWT/session/permission system은 포함하지 않습니다.

## 2. 요구사항

현재 repository 기준 요구사항:

- Node.js
- npm
- Python
- PostgreSQL
- backend virtualenv 또는 conda env

정확한 runtime version은 repository에 고정되어 있지 않습니다. v0.0.0은 현재 `package.json`, `backend/requirements.txt`에 정의된 dependency 조합 기준으로 실행합니다.

Frontend 주요 dependency:

- Vite
- React
- TypeScript

Backend 주요 dependency:

- FastAPI
- Uvicorn
- SQLModel
- Alembic
- psycopg
- pydantic-settings

## 3. Frontend Mock Mode 실행

Mock mode는 frontend 단독 UI demo mode입니다. Backend와 PostgreSQL 없이 실행할 수 있습니다.

```bash
cd feed-prototype
copy .env.example .env
```

`.env`에서 아래 값을 확인합니다.

```text
VITE_DATA_SOURCE=mock
```

dependency를 설치하고 dev server를 실행합니다.

```bash
npm install
npm run dev
```

확인할 것:

- Local user entry가 표시됩니다.
- Home Feed가 mock post를 표시합니다.
- Account/Profile 화면이 표시됩니다.
- Mock follow state는 localStorage overlay를 사용합니다.

Vite 환경변수를 변경한 뒤에는 frontend dev server를 재시작합니다.

## 4. PostgreSQL 준비

Local PostgreSQL에 사용할 database를 생성합니다.

권장 database 예:

```text
feed_dev
```

DB 생성은 pgAdmin, psql, 또는 local PostgreSQL 관리 도구를 사용합니다.

예시:

```sql
CREATE DATABASE feed_dev;
```

실제 사내 DB 주소, 운영 DB URL, 비밀번호는 문서나 git에 넣지 않습니다.

## 5. Backend API Mode 준비

Backend 폴더로 이동합니다.

```bash
cd feed-prototype/backend
```

Python 환경을 준비합니다.

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

macOS/Linux 또는 conda 환경을 사용하는 경우에는 같은 backend 폴더에서 활성화된 Python 환경에 `requirements.txt`를 설치합니다.

Backend `.env`를 만듭니다.

```bash
copy .env.example .env
```

`backend/.env`에서 `DATABASE_URL`을 local DB에 맞게 설정합니다.

```text
APP_NAME=feed-prototype-backend
APP_ENV=local
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/feed_dev
```

Migration을 적용합니다.

```bash
alembic upgrade head
```

Seed data를 삽입합니다.

```bash
python -m app.services.seed
```

Backend를 실행합니다.

```bash
python -m uvicorn app.main:app --reload
```

API 기본 URL:

```text
http://127.0.0.1:8000
```

간단 확인:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
```

## 6. Frontend API Mode 실행

Frontend 폴더로 이동합니다.

```bash
cd feed-prototype
```

`.env`를 만들거나 수정합니다.

```bash
copy .env.example .env
```

API mode 설정:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Frontend dev server를 실행합니다.

```bash
npm run dev
```

확인할 것:

- API user selection 화면에서 backend user를 id 또는 handle로 선택합니다.
- Home Feed가 backend seed data를 표시합니다.
- Accounts, Account Profile, Post Detail 화면이 표시됩니다.
- Follow/unfollow가 backend DB state에 반영됩니다.

Vite 환경변수를 `mock`에서 `api`로 바꾼 뒤에는 반드시 dev server를 재시작합니다.

## 7. External Sample Import

External import는 backend CLI workflow입니다. Import 전에 `backend/.env`의 `DATABASE_URL`이 의도한 DB를 가리키는지 확인합니다.

Backend 폴더에서 실행합니다.

```bash
cd feed-prototype/backend
```

기본 sample dry-run:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

기본 sample import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

MVP12 asset viewer sample dry-run:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
```

MVP12 asset viewer sample import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

같은 JSON을 다시 import해도 `external_id` 기준으로 update되어 duplicate post가 계속 생기지 않아야 합니다.

## 8. UI 확인 시나리오

API mode frontend에서 다음을 확인합니다.

- Home Feed: active user의 own account와 followed account post가 표시되는지 확인합니다.
- Account Profile: imported account와 imported post가 표시되는지 확인합니다.
- Post Detail: imported post의 title, text, tag, metadata, asset이 표시되는지 확인합니다.
- Follow/unfollow: imported account를 follow한 뒤 Home Feed 표시가 바뀌는지 확인합니다.
- Post create/edit/delete: active API user own post에 대해 생성, 수정, 삭제가 가능한지 확인합니다.
- Imported post 확인: external import로 들어온 post가 일반 post처럼 표시되는지 확인합니다.
- Image/plot lightbox: image/plot thumbnail을 클릭해 modal/lightbox가 열리는지 확인합니다.
- Multi image/plot order: 여러 image/plot asset이 `sort_order` 순서로 표시되는지 확인합니다.
- Table CSV preview: CSV table asset preview가 표시되는지 확인합니다.
- File/link open: file/link card의 Open original 동작을 확인합니다.
- Filter/search: keyword, tag, metadata key/value, asset type, account filter를 적용하고 reset합니다.

Imported post가 Home Feed에 바로 보이지 않을 수 있습니다. Home Feed는 active user의 own account와 followed account의 post를 표시하므로, imported account follow 여부를 확인합니다.

## 9. DB 사용 Mode

DB는 목적에 따라 분리해서 사용할 수 있습니다.

```text
feed_dev
- 개발/기능 테스트용

feed_ops
- 외부 post package를 지속적으로 쌓아보는 운영형 테스트용
```

같은 backend code를 사용하되 `backend/.env`의 `DATABASE_URL`만 바꿉니다.

External import 전에는 항상 다음을 확인합니다.

- 현재 활성화된 backend Python 환경
- `backend/.env`의 `DATABASE_URL`
- import command의 `--database-url` override 사용 여부
- dry-run 결과

실제 운영 DB URL이나 비밀번호는 `.env.example`, README, runbook에 넣지 않습니다.

## 10. 자주 발생하는 문제

### Backend가 꺼져 있음

API mode frontend는 `VITE_API_BASE_URL`의 backend에 요청합니다. `python -m uvicorn app.main:app --reload`가 실행 중인지 확인합니다.

### `VITE_DATA_SOURCE` 설정 오류

`mock`과 `api` 중 하나로 설정합니다. 다른 값이면 frontend 기본값 또는 의도와 다른 mode로 동작할 수 있습니다.

### Vite env 변경 후 dev server를 재시작하지 않음

Vite 환경변수는 dev server 시작 시점에 읽힙니다. `.env` 수정 후 `npm run dev`를 다시 시작합니다.

### `DATABASE_URL`이 잘못됨

Backend startup, migration, seed, import가 모두 `DATABASE_URL`에 의존합니다. DB 이름, user, password, port를 확인합니다.

### Migration 미적용

Table 또는 column 관련 오류가 나면 backend 폴더에서 `alembic upgrade head`를 실행합니다.

### Seed data 미삽입

API user selection 또는 feed가 비어 있으면 `python -m app.services.seed`를 실행했는지 확인합니다.

### `asset.url`이 브라우저에서 접근 불가

Import script는 asset file을 복사하지 않습니다. `asset.url`은 browser-accessible URL 또는 static path여야 합니다.

### Windows 절대경로를 `asset.url`에 넣음

`C:\...` 같은 local filesystem path는 browser URL이 아닙니다. `/assets/...` 또는 `https://...` 형태의 접근 가능한 URL을 사용합니다.

### Imported post가 Home Feed에 안 보임

Home Feed는 active user own account와 followed account의 post를 보여줍니다. Imported account를 follow했는지 확인하거나 Account Profile/Post Detail에서 먼저 확인합니다.

### Table preview 실패

CSV file path가 browser-accessible인지, CSV가 UTF-8 text로 읽히는지 확인합니다. 실패 시 UI는 fallback card와 Open original action을 표시해야 합니다.

### Port 충돌

Vite 기본 port는 보통 `5173`, backend 기본 port는 `8000`입니다. 이미 사용 중이면 terminal log에 표시되는 대체 port 또는 backend 실행 옵션을 확인합니다.

## 11. 관련 문서

- `../README.md`
- `RELEASE_CHECKLIST_v0.0.0.md`
- `SMOKE_TEST_v0.0.0.md`
- `../data/external_posts/README.md`
- `MVP10_EXTERNAL_POST_FORMAT.md`
