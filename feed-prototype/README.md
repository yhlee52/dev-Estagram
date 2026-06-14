# feed-prototype

`feed-prototype`은 Vite + React + TypeScript 기반의 Instagram-like local/general feed prototype입니다.

현재 릴리즈: `v0.2.3`. v0.2.x(레이아웃 & UI 개편) 테마 완료.

이 릴리즈는 local/internal prototype 기준점입니다. generic SNS-like post와 외부 import된 분석/리포트형 post를 데모할 수 있지만 production-ready 제품은 아닙니다. v0.0.0 기준선 위에 v0.1.x(탐색과 발견) 테마의 pagination·날짜 필터·정렬·해시태그·@mention 기능이 추가되었고, v0.2.x(레이아웃 & UI 개편) 테마에서 데스크톱 3컬럼 레이아웃·헤더 정리·Explore/Accounts/Me 탭 활성화가 추가되었습니다. 자세한 버전 트리는 `docs/ROADMAP.md`를 참고하세요.

## 포함된 기능

- static frontend data와 localStorage overlay를 사용하는 mock-mode local feed
- FastAPI와 PostgreSQL을 사용하는 API-mode feed
- prototype user selection을 위한 API-mode local user/account registration
- API mode follow/unfollow
- API mode personal post create/edit/delete
- Post tags, metadata, asset descriptors
- `external_id` upsert 기반 external JSON post package import
- keyword, tag, metadata key/value, asset type, account, own posts 기준 API-mode filter/search
- image/plot thumbnail, modal navigation, CSV table preview, file card, link card, broken URL fallback을 포함한 asset viewer
- cursor 기반 pagination(더 보기), 날짜 범위 필터(`created_at_from`/`created_at_to`), 최신순/오래된순 정렬 (v0.1.0)
- 필터 상태 ↔ URL query parameter 동기화로 공유/재현 가능한 필터 링크 (v0.1.0)
- 클릭 가능한 해시태그 칩(`#tag` → `/posts?tag=<tag>`) (v0.1.1)
- 검색창 `#` tag 라우팅, 사용 빈도순 tag 자동완성, `GET /api/tags` (v0.1.2)
- post 본문의 `@handle`을 Account Profile 링크로 렌더링 (v0.1.3)
- 데스크톱 3컬럼 레이아웃: 좌측 네비 레일 + 중앙 feed + 우측 컨텍스트 레일(적용 필터·팔로우 바로가기) (v0.2.0)
- 한 줄 헤더 + 아바타 드롭다운(user id·버전 등 디버그 정보 수납), Switch user 단일화 (v0.2.1)
- Explore(Posts) 탭: 인기/최근 태그 진입점, Accounts 탭 활동 신호(최근 N일 post 수)·정렬(최근 활동/post 수/이름) (v0.2.2)
- Me 탭: mock/API 양쪽에서 동작하는 내 활동 요약 + 내 post 관리(New Post·Edit·인라인 Delete), 필터 0건 empty state의 "Reset filters" (v0.2.3)

## 포함되지 않은 기능

- production authentication 또는 authorization
- password, JWT, session, OAuth, role
- real file upload, S3 upload, asset file copy
- folder watch 또는 scheduled import
- advanced search, semantic search, vector search, dashboard, analytics
- equipment/report-specific core model name

## 환경 설정

Frontend `.env`:

```bash
copy .env.example .env
```

지원 값:

```text
VITE_DATA_SOURCE=mock
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Backend `.env`:

```bash
cd backend
copy .env.example .env
```

local PostgreSQL database에 맞게 `DATABASE_URL`을 설정합니다.

`.env.example`을 복사해 `.env`를 만들고, 실제 `.env`는 commit하지 않습니다. Vite 환경변수인 `VITE_DATA_SOURCE`, `VITE_API_BASE_URL`을 변경한 뒤에는 frontend dev server를 재시작합니다. External import를 실행하기 전에는 `backend/.env`의 `DATABASE_URL`이 어느 DB를 가리키는지 먼저 확인합니다.

## Mock Mode 실행

Mock mode는 frontend만 있으면 실행할 수 있습니다.

```bash
cd feed-prototype
copy .env.example .env
```

설정:

```text
VITE_DATA_SOURCE=mock
```

실행:

```bash
npm install
npm run dev
```

Mock data는 `src/data`에 있습니다. Runtime mock overlay state는 localStorage에 저장됩니다.

중요 localStorage key:

```text
local-feed-active-user-id
local-feed-following-by-user
local-feed-local-users
local-feed-local-accounts
```

## API Mode 실행

API mode는 PostgreSQL과 FastAPI backend가 필요합니다.

Backend setup:

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

`backend/.env` 수정:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

Migration, seed, backend 실행:

```bash
alembic upgrade head
python -m app.services.seed
uvicorn app.main:app --reload
```

Frontend setup:

```bash
cd feed-prototype
copy .env.example .env
```

설정:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

실행:

```bash
npm run dev
```

API user selection은 prototype state입니다. login 또는 authentication이 아닙니다.

## External Import Mode 실행

External import는 backend CLI 작업 흐름입니다. JSON post package를 읽고 generic `Account`, `Post`, `Asset`, `Metadata` data를 PostgreSQL에 upsert합니다.

Dry-run:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
```

Import:

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

이후 API mode UI에서 imported post를 확인합니다.

상세 guide:

```text
data/external_posts/README.md
docs/EXTERNAL_POST_PACKAGE_GUIDE.md
```

## Sample Data

일반 SNS-like sample content:

```text
src/data
backend/app/services/seed.py
```

외부 분석/리포트형 sample package:

```text
data/external_posts/examples/general_social_sample/feed_posts.json
data/external_posts/examples/analysis_report_sample/feed_posts.json
data/external_posts/examples/broken_asset_sample/feed_posts.json
data/external_posts/examples/feed_import_sample.json
data/external_posts/examples/batch_2026-06-09_090000/feed_posts.json
data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

recipe, chamber, status, severity 같은 report-like value는 sample metadata value일 뿐입니다. 이런 값은 core architecture name이 아니라 `metadata_json` 또는 asset metadata 안에 유지합니다.

## 릴리즈 문서

```text
docs/RELEASE_0_0_RUNBOOK.md
docs/EXTERNAL_POST_PACKAGE_GUIDE.md
docs/RELEASE_0_0_CHECKLIST.md
docs/README.md
```

## Build 검증

handoff 전에 실행합니다.

```bash
npm run build
```
