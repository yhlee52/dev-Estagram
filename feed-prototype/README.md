# feed-prototype

`feed-prototype`은 Vite + React + TypeScript 기반의 Instagram-like local/general feed prototype입니다.

현재 릴리즈: `v1.0.0` (배포 가능한 제품 기준선). v0.1.x(탐색과 발견) ~ v0.6.x(인증 &
멀티유저) 테마가 모두 완료되어 v1.0.0 전제가 갖춰졌고, v1.0.0 자체는 **새 기능 없이**
write endpoint를 session 기반으로 인가하는 보안 하드닝·안정화 릴리즈입니다(상세는
`docs/V1_0_0_RELEASE_SCOPE.md`). 자세한 버전 트리는 `docs/ROADMAP.md`를 참고하세요.

이 릴리즈는 local/internal prototype 기준점입니다. generic SNS-like post와 외부
import된 분석/리포트형 post를 데모할 수 있고, password 로그인 + server-side session
기반 write 인가가 적용되어 있지만, OAuth/SSO/JWT/RBAC 같은 정식 권한 시스템을 갖춘
production-ready 제품은 아닙니다.

## 포함된 기능

- static frontend data와 localStorage overlay를 사용하는 mock-mode local feed
- FastAPI와 PostgreSQL을 사용하는 API-mode feed
- password 로그인 + server-side session(httpOnly cookie) 기반 API-mode user 가입/인증 (v0.6.0)
- API mode follow/unfollow
- API mode personal post create/edit/delete — 행위자는 항상 로그인 session에서 도출(v1.0.0)
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
- HTTP import API: 기존 CLI와 동일한 package JSON을 `POST /api/imports`로 수신(`?dry_run=true`, 선택적 `X-Import-Token` 보호) (v0.3.0)
- Import batch 이력: import 사건을 `import_batch`에 기록(success/failed·사건 카운트·import 횟수), `GET /api/imports`(목록)·`GET /api/imports/{batch_external_id}`(상세) 조회, `/imports` UI 목록/상세 (API mode 전용) (v0.3.1)
- 디렉터리 일괄 처리/자동 이동/Watch: `process_incoming` CLI가 `incoming/`의 package(단일 `.json` 또는 `feed_posts.json` 포함 디렉터리)를 일괄 import하고 성공→`archive/`/실패→`failed/`로 자동 이동(이름 충돌 시 타임스탬프 접미사), `--watch --interval N` 단순 폴링, `--dry-run`은 DB·파일 무변경. 단일 파일 `--input` CLI·HTTP import는 파일 이동 없음 (v0.3.2)
- Asset managed storage 복사(opt-in): `MANAGE_ASSET_STORAGE`를 켜면 import 시 asset url이 **상대 로컬 경로**일 때만 패키지 디렉터리 기준으로 파일을 `public/assets/managed/`로 복사하고 DB url을 `/assets/managed/...`로 재작성. `/assets/...`·`http(s)://` url은 무손상, 기본 OFF, CLI/`process_incoming` 경로만 적용(HTTP import 미적용), 복사 실패·원본 누락은 원본 url 유지. DB 스키마/format 변경 없음 (v0.3.3)
- UX backlog 반영: Me 탭(API 모드) 내 post를 `MY_POSTS_PAGE_SIZE`(20)개씩 "Load more"로 점진 렌더(클라이언트 사이드 윈도잉, 백엔드 변경 없음), post 삭제 확인을 브라우저 `window.confirm` 대신 공용 `ConfirmDialog`(오버레이/Escape/백드롭/포커스 제어)로 교체. v0.3.x 테마 완료 (v0.3.4)
- Metadata-first reading: 데이터에서 파생한 metadata key/value facet API와 필터 패널
  선택 UI, 카드 pinned metadata chip, metadata value sort, 중복 metadata 표시 제거와
  정렬 안내. **API mode 전용**, generic key-value 기반 (v0.4.x)
- Comments: post별 평면 댓글 작성/조회/수정/삭제, 작성자 account 신원, 댓글 수 칩,
  caption/comment 본문의 `@mention`·`#hashtag` 렌더. **API mode 전용** (v0.5.0)
- Bookmarks: post 북마크 토글, 비공개 메모, Me 탭 북마크/Following 목록,
  메인 Browse `bookmarked_only` 필터. **API mode 전용** (v0.5.1)
- Notifications & mentions: 팔로우 계정 새 post, 내 post의 새 댓글, 나를 언급한
  post/comment를 `/notifications`에서 확인하고 모두 읽음 처리. 알림 item은 파생하고
  읽음 상태만 user별 워터마크로 저장합니다. **API mode 전용** (v0.5.2)
- Collaboration UX wrap-up: `/notifications` Unread empty state와 Me 탭 Bookmarks
  empty copy 정리, 협업 표면 문서/검증 절차 정비 (v0.5.3)
- 인증 & 멀티유저: password 로그인 + server-side session(httpOnly cookie, v0.6.0),
  User:Account 1:1 identity 운영 정책(v0.6.1), 내 account profile self-service
  (display name/bio/avatar, v0.6.2), 운영자 password reset CLI + 세션 만료 시 로그인
  복귀(v0.6.3), 계정 soft deactivation(post 보존 + 운영자 재활성화, v0.6.4). 상세 명령어
  모음은 `docs/ACCOUNT_MANAGEMENT.md` (v0.6.x)
- 보안 하드닝(v1.0.0, 새 기능 아님): write endpoint(posts/comments/bookmarks/
  notifications/follows/accounts)가 더 이상 request body/query의 `user_id`를 신뢰하지
  않고 로그인 session에서 행위자를 도출, cookie `secure`/CORS allow-origin 환경설정
  분리, 로그인 화면의 전체 user 목록 노출 제거, import로 생성되는 user의 초기
  password를 예측 불가능한 임의 값으로 변경

## 포함되지 않은 기능

- OAuth / SSO / JWT / RBAC 같은 정식 권한 시스템(password 로그인 + server-side
  session 기반 write 인가는 v0.6.x~v1.0.0에서 제공)
- User:Account 1:N (1:1 고정, v0.6.1 운영 정책)
- real file upload, S3 upload, UI/HTTP asset 업로드 (v0.3.3 asset managed storage 복사는 opt-in으로 상대 로컬 경로 파일에 한해 제공)
- OS 레벨 scheduler/데몬 (v0.3.2의 단순 폴링 watch와 일괄 처리 CLI는 제공)
- watchdog/inotify 등 OS 파일시스템 이벤트 기반 watch (단순 폴링만)
- advanced search, semantic search, vector search, dashboard, analytics
- equipment/report-specific core model name
- 신규 기능 일반(v1.0.0은 하드닝/안정화 전용 — 새 기능은 v1.1.x부터)

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

local PostgreSQL database에 맞게 `DATABASE_URL`을 설정합니다. localhost를 벗어나는
배포에서는 `SESSION_COOKIE_SECURE`(HTTPS 전용 cookie)와 `CORS_ALLOW_ORIGINS`(허용할
frontend origin)도 함께 설정합니다 — 둘 다 `.env.example`에 주석으로 설명되어 있고
기본값은 localhost dev 기준입니다.

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

API mode는 PostgreSQL과 FastAPI backend가 필요하고, 로그인(password + server-side
session)이 필수입니다.

Backend setup:

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

`backend/.env` 수정(local DB 자격증명으로 교체):

```text
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5432/feed_dev
```

Migration, seed, backend 실행:

```bash
alembic upgrade head
python -m app.services.seed
uvicorn app.main:app --reload
```

`seed`는 로그인용 user(`ari`/`mika`/`nova`, 초기 password=handle)와 1:1 account,
데모 post를 만듭니다. 이미 있으면 덮어쓰지 않습니다.

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

API base host와 앱을 여는 host를 맞추세요(둘 다 `localhost` 또는 둘 다 `127.0.0.1`).
다르면 세션 cookie(SameSite=Lax)가 cross-site로 취급돼 드랍되고 로그인이 유지되지
않습니다.

로그인 화면에서 seed user(예: id/handle `ari`, password `ari`)로 로그인하거나
"Register new API user"로 새 user+1:1 account를 만듭니다. curl로 확인하려면:

```bash
curl -c cookies.txt -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" --data '{"login":"ari","password":"ari"}'
curl -b cookies.txt http://127.0.0.1:8000/api/auth/session
```

가입/로그인/profile 수정/password 변경/계정 비활성화·재활성화 등 모든 계정 관련
명령어는 `docs/ACCOUNT_MANAGEMENT.md`에 정리되어 있습니다.

## External Import Mode 실행

External import는 backend CLI 작업 흐름입니다. JSON post package를 읽고 generic `Account`, `Post`, `Asset`, `Metadata` data를 PostgreSQL에 upsert합니다. 이 경로는
session 로그인 대상이 아닙니다(운영자/ingestion 도구로 간주, v1.0.0에서도 유지) —
import로 새로 생성되는 paired user는 예측 불가능한 임의 password를 받고 로그인
용도가 아닙니다.

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

### HTTP Import API (v0.3.0)

동일한 package JSON을 backend가 실행 중일 때 HTTP로 보내 import할 수도 있습니다.
CLI와 같은 `import_payload` 로직을 재사용하며, package 형식은 동일합니다.

```bash
# dry-run (DB write 없이 검증·요약만)
curl -X "POST" "http://127.0.0.1:8000/api/imports?dry_run=true" \
  -H "Content-Type: application/json" \
  --data-binary @../data/external_posts/examples/feed_import_sample.json

# 실제 import
curl -X "POST" "http://127.0.0.1:8000/api/imports" \
  -H "Content-Type: application/json" \
  --data-binary @../data/external_posts/examples/feed_import_sample.json
```

응답은 `ImportSummary`(accounts/users/posts/assets 생성·수정·스킵 수)입니다. 같은
payload를 다시 보내면 `external_id` 기준 upsert로 중복 없이 갱신됩니다.

선택적 보호: `backend/.env`에 `IMPORT_API_TOKEN`을 설정하면 요청에
`-H "X-Import-Token: <token>"`이 일치해야 합니다(미설정 시 검사 없음). session 로그인
기반 인가가 아닌 별도의 shared-token 보호이며, backend는 localhost 바인딩을
전제로 합니다.

상세 guide:

```text
data/external_posts/README.md
docs/EXTERNAL_POST_PACKAGE_GUIDE.md
docs/archive/V0_3_0_HTTP_IMPORT_SCOPE.md
```

### Import Batch 이력 (v0.3.1)

CLI/HTTP 어느 경로로 import해도 backend가 import 사건을 `import_batch` 테이블에
기록합니다(`batch.external_id` 기준 upsert, status success/failed, 사건 카운트
스냅샷 + import 횟수). dry-run은 아무 것도 기록하지 않습니다.

```bash
# batch 목록 (최근 import 순)
curl "http://127.0.0.1:8000/api/imports"

# batch 상세 (귀속 post 목록 포함)
curl "http://127.0.0.1:8000/api/imports/<batch_external_id>"
```

API mode UI에서는 좌측 네비의 **Imports** 탭(`/imports`)에서 batch 목록과 상세를
볼 수 있습니다(mock mode에서는 노출되지 않음). 상세 guide는
`docs/archive/V0_3_1_BATCH_HISTORY_SCOPE.md`.

### 디렉터리 일괄 처리 / 자동 이동 / Watch (v0.3.2)

`incoming/`에 둔 package를 한 번에 처리하고 결과에 따라 자동 이동합니다. package는
단일 `.json` 파일 또는 `feed_posts.json`을 포함한 디렉터리이며, 성공하면
`archive/`, 실패하면 `failed/`로 옮겨집니다(이름이 겹치면 덮어쓰지 않고 타임스탬프
접미사). 한 package가 실패해도 나머지는 계속 처리됩니다.

```bash
cd feed-prototype/backend

# incoming/을 한 번 처리 (성공→archive/, 실패→failed/)
python -m app.services.process_incoming

# 검증/요약만 (DB·파일 모두 변경 없음)
python -m app.services.process_incoming --dry-run

# 폴링 watch (기본 10초 간격, Ctrl-C로 종료)
python -m app.services.process_incoming --watch --interval 10
```

자동 이동은 이 `incoming/` 경로에서만 일어납니다. 단일 파일 CLI
(`import_external_posts --input`)와 HTTP import(`POST /api/imports`)는 파일을
이동하지 않습니다. external_posts 루트는 `backend/.env`의 `EXTERNAL_POSTS_DIR`
(또는 `--base-dir`)로 바꿀 수 있고, 기본값은 리포의 `data/external_posts`입니다.
watch가 쓰다 만 파일을 집지 않도록, package writer는 임시 파일에 쓴 뒤 rename
(atomic)으로 `incoming/`에 넣는 것을 권장합니다. 상세 guide는
`docs/archive/V0_3_2_AUTO_INGESTION_SCOPE.md`.

### Asset Managed Storage 복사 (v0.3.3, opt-in)

기본적으로 import는 asset의 `url` 문자열만 저장합니다(파일 복사 없음). asset 내구성을
위해 `backend/.env`에서 `MANAGE_ASSET_STORAGE=true`로 켜면, asset url이 **상대 로컬
경로**(예: `assets/img.png`)일 때 패키지 디렉터리(`feed_posts.json`의 위치) 기준으로
파일을 찾아 `public/assets/managed/<batch>/<asset>`으로 복사하고 DB에 저장되는 url을
`/assets/managed/...`로 재작성합니다.

```bash
# backend/.env
MANAGE_ASSET_STORAGE=true
# (선택) 복사 위치/서빙 prefix 재정의 — 둘은 같은 위치의 파일/URL 표현
MANAGED_ASSETS_DIR=.../feed-prototype/public/assets/managed
MANAGED_ASSETS_URL_PREFIX=/assets/managed
```

규칙:

- `/assets/...`·`http(s)://`·`//`로 시작하는 url은 **건드리지 않습니다**(format
  동결·하위호환). 이미 import된 package에도 영향 없음.
- 복사는 디스크 패키지가 있는 CLI(`import_external_posts --input`)와
  `process_incoming` 경로에만 적용됩니다. **HTTP import(`POST /api/imports`)는
  파일이 없어 적용되지 않습니다.**
- 원본 파일 누락·패키지 밖 경로·복사 실패는 import를 실패시키지 않고 원본 url을
  그대로 둡니다(경고 로그).
- 목적지가 결정적이라 같은 package 재import 시 덮어씁니다(누적 없음).
- 기본값 OFF에서는 v0.3.2와 동작이 완전히 동일합니다. 상세 guide는
  `docs/archive/V0_3_3_ASSET_STORAGE_SCOPE.md`.

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
data/external_posts/examples/managed_copy_sample/feed_posts.json
```

recipe, chamber, status, severity 같은 report-like value는 sample metadata value일 뿐입니다. 이런 값은 core architecture name이 아니라 `metadata_json` 또는 asset metadata 안에 유지합니다.

## 릴리즈 문서

```text
docs/V1_0_0_RELEASE_SCOPE.md
docs/ACCOUNT_MANAGEMENT.md
docs/RELEASE_0_0_RUNBOOK.md
docs/RELEASE_0_0_CHECKLIST.md
docs/EXTERNAL_POST_PACKAGE_GUIDE.md
docs/README.md
```

## Build 검증

handoff 전에 실행합니다.

```bash
npm run build
npm run lint
```
