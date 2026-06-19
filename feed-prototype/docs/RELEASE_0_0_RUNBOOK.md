# feed-prototype 실행 가이드 (v1.0.0 기준)

이 문서는 `feed-prototype`을 local 환경에서 재현 실행하기 위한 기준 runbook입니다.
현재 릴리즈 `v1.0.0`(배포 가능한 제품 기준선 — session 기반 write 인가 하드닝) 기준으로
mock → API(password 로그인 + session) → 외부 데이터(CLI·디렉터리 일괄 처리·Watch·
managed storage) → 협업 → profile self-service → 계정 비활성화/재활성화 기능 확인까지의
실행 방법을 정리합니다.

> 파일명은 v0.0.0 release 시점의 이름(`RELEASE_0_0_RUNBOOK.md`)을 유지하지만,
> 내용은 항상 현재 릴리즈 기준으로 갱신됩니다. external post package format은 v0.0.0
> 시점에 동결되어 v0.1.x~v0.6.x에서도 바뀌지 않았습니다.

## 1. 개요

`feed-prototype`은 일반 SNS-like feed와 external report feed를 데모할 수 있는
local/internal prototype입니다. 이 runbook은 다음 흐름을 확인하는 데 초점을 둡니다.

- frontend 단독 mock mode UI demo
- FastAPI + PostgreSQL 기반 API mode read/write
- 외부 JSON post package import (단일 파일 CLI / HTTP / 디렉터리 일괄 처리 / Watch)
- imported post의 asset, tag, metadata, filter/search, viewer 확인
- (opt-in) asset managed storage 복사
- API mode 협업 기능 확인(댓글, 북마크/비공개 메모, in-app 알림/mention)
- API mode 인증(password 로그인 + server-side session)과 내 account profile self-service

production-ready app은 아닙니다. v0.6.x에서 password 로그인 + server-side session
(httpOnly cookie)은 추가되었지만, OAuth/SSO/JWT access token/RBAC 같은 정식 권한
시스템은 포함하지 않습니다. v1.0.0부터 write endpoint(post/comment/bookmark/follow/
notification/account profile·deactivate)는 request body/query의 `user_id`가 아니라
**session cookie에서 도출한 현재 로그인 user**로 인가합니다. 로그인 없이 호출하면
401, 다른 user의 리소스에 쓰면 403입니다. backend가 localhost 바인딩을 벗어나는
배포에서는 `SESSION_COOKIE_SECURE=true` + HTTPS 종단 + `CORS_ALLOW_ORIGINS`를 배포
host에 맞게 설정해야 합니다(아래 5절).

실행 mode는 크게 세 가지입니다.

```text
mock  - frontend 단독, backend·DB 불필요
api   - FastAPI + PostgreSQL read/write
외부  - api mode 위에서 external JSON package를 DB로 import
```

## 2. 요구사항

- Node.js / npm
- Python
- PostgreSQL
- backend virtualenv 또는 conda env

정확한 runtime version은 repository에 고정되어 있지 않습니다. 현재
`package.json`, `backend/requirements.txt`에 정의된 dependency 조합 기준으로 실행합니다.

- Frontend: Vite, React, TypeScript (+ Tailwind, react-router)
- Backend: FastAPI, Uvicorn, SQLModel, Alembic, psycopg, pydantic-settings

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
- Account/Profile/Explore/Me 화면이 표시됩니다.
- Mock follow state는 localStorage overlay를 사용합니다.

Mock data는 `src/data`에 있고, runtime overlay state는 localStorage에 저장됩니다.
주요 key: `local-feed-active-user-id`, `local-feed-following-by-user`,
`local-feed-local-users`, `local-feed-local-accounts`.

> Vite 환경변수(`VITE_*`)는 dev server 시작 시점에 읽힙니다. 값을 변경한 뒤에는
> 반드시 `npm run dev`를 재시작합니다.

## 4. PostgreSQL 준비

Local PostgreSQL에 사용할 database를 생성합니다. 권장 database 예: `feed_dev`.

```sql
CREATE DATABASE feed_dev;
```

DB 생성은 pgAdmin, psql, 또는 local PostgreSQL 관리 도구를 사용합니다. 실제 사내 DB
주소, 운영 DB URL, 비밀번호는 문서나 git에 넣지 않습니다.

## 5. Backend API Mode 준비

Backend 폴더로 이동해 Python 환경을 준비합니다.

```bash
cd feed-prototype/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

macOS/Linux 또는 conda 환경을 사용하는 경우에는 같은 backend 폴더에서 활성화된
Python 환경에 `requirements.txt`를 설치합니다.

Backend `.env`를 만들고 `DATABASE_URL`을 local DB에 맞게 설정합니다.

```bash
copy .env.example .env
```

```text
APP_NAME=feed-prototype-backend
APP_ENV=local
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/feed_dev
```

(v1.0.0) 로컬 dev에서는 아래 두 값을 생략해도 기본값(localhost 전제, secure
cookie 끔, Vite dev server origin 허용)으로 동작합니다. backend를 localhost
바인딩 밖(원격 서버, 컨테이너 뒤 reverse proxy 등)으로 옮길 때만 명시적으로
설정합니다.

```text
# HTTPS로 서빙할 때만 true (http에서 true면 브라우저가 쿠키를 보내지 않음)
SESSION_COOKIE_SECURE=false
# 배포된 frontend의 정확한 scheme+host+port, 쉼표로 여러 origin 구분 가능
CORS_ALLOW_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Migration 적용, seed 삽입, backend 실행:

```bash
alembic upgrade head
python -m app.services.seed
python -m uvicorn app.main:app --reload
```

API 기본 URL: `http://127.0.0.1:8000`.

> seed user의 초기 password는 handle과 같습니다(`ari`/`mika`/`nova`). import로 생성된
> paired user의 초기 password는 (v1.0.0부터) 예측 불가능한 임의 문자열이라 알 수
> 없습니다 — import user로 로그인하려면 운영자가 먼저 password를 부여해야 합니다.
> seed의 password 부여는 write-once라 재-seed로 덮이지 않습니다. 분실 시 또는
> import user에게 처음 password를 부여할 때는
> `python -m scripts.reset_password --user <id-or-handle> --password <new>`를 씁니다(v0.6.3).

간단 확인:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/users
curl http://127.0.0.1:8000/api/accounts
curl http://127.0.0.1:8000/api/posts
curl http://127.0.0.1:8000/api/imports   # import batch 이력 (v0.3.1)
curl "http://127.0.0.1:8000/api/users/demo-user-ari/notifications"  # 알림 (v0.5.2)

# 인증 (v0.6.0): 로그인 → session cookie 저장 → 현재 session 조회
curl -c cookies.txt -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" --data '{"login":"ari","password":"ari"}'
curl -b cookies.txt http://127.0.0.1:8000/api/auth/session
```

## 6. Frontend API Mode 실행

Frontend 폴더에서 `.env`를 API mode로 설정합니다.

```bash
cd feed-prototype
copy .env.example .env
```

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Frontend dev server를 실행합니다.

```bash
npm run dev
```

확인할 것:

- 로그인 화면에서 backend user의 id 또는 handle + password로 로그인합니다(v0.6.0).
  seed user는 password가 handle과 같습니다(예: `ari`/`ari`). 로그인하면 server-side
  session(httpOnly cookie)이 발급되고, 새로고침해도 session으로 로그인 상태가 유지됩니다.
- 로그인 화면에서 신규 API user를 등록(Register)할 수도 있습니다(user+1:1 account 생성).
- Home Feed가 backend seed data를 표시합니다.
- Accounts, Account Profile, Post Detail, Explore, Me, Imports(`/imports`) 화면이 표시됩니다.
- Follow/unfollow, post create/edit/delete가 backend DB state에 반영됩니다.
- Post Detail 댓글, 카드/상세 북마크, `/notifications`가 API mode에서 표시됩니다.
- Me 탭에서 내 account profile(display name/bio/avatar URL) 편집과 password 변경이
  동작합니다(v0.6.2 / v0.6.0). handle·kind 등 식별자 값은 수정되지 않습니다.
- 아바타 드롭다운의 Logout으로 session을 폐기하고 로그인 화면으로 돌아갑니다. session이
  서버에서 만료/삭제되면 다음 API 호출 시 자동으로 로그인 화면으로 복귀합니다(v0.6.3).
- Me 탭 Danger zone에서 계정을 비활성화하면 로그아웃되고, 이후 로그인이 차단되며
  Accounts 목록에서 사라집니다. 작성한 post는 보존됩니다(v0.6.4). 재활성화는 운영자
  CLI로만 가능합니다(10. 자주 발생하는 문제의 비활성/재활성 항목 참고).

> `VITE_DATA_SOURCE`를 `mock`에서 `api`로 바꾼 뒤에는 반드시 dev server를 재시작합니다.

## 7. 외부 데이터 사용 (External Import)

External import는 외부 프로그램이 만든 JSON post package를 backend DB에 upsert하는
작업 흐름입니다. import 경로는 네 가지이며, format은 모두 동일합니다.

| 경로 | 명령/엔드포인트 | 파일 이동 | managed storage 복사 |
|------|-----------------|-----------|----------------------|
| 단일 파일 CLI | `import_external_posts --input` | 없음 | 적용 (opt-in) |
| 디렉터리 일괄 처리 | `process_incoming` | `archive/`·`failed/`로 이동 | 적용 (opt-in) |
| Watch 폴링 | `process_incoming --watch` | 위와 동일(반복) | 적용 (opt-in) |
| HTTP import | `POST /api/imports` | 없음 | **미적용**(디스크 파일 없음) |

> import 전에는 항상 `backend/.env`의 `DATABASE_URL`이 의도한 DB를 가리키는지 먼저
> 확인하고, 운영성 DB에는 `--dry-run`을 먼저 돌립니다. dry-run은 DB write와 파일
> 이동을 모두 하지 않습니다.

상세 package 작성 가이드: `EXTERNAL_POST_PACKAGE_GUIDE.md`,
`../data/external_posts/README.md`.

### 7.1 단일 파일 CLI import

Backend 폴더에서 `--input`으로 package JSON 하나를 import합니다. 이 경로는 파일을
이동하지 않습니다.

```bash
cd feed-prototype/backend

# 기본 sample
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
```

예제 package:

```bash
# 일반 SNS-like sample
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json

# 분석 리포트 sample
python -m app.services.import_external_posts --input ../data/external_posts/examples/analysis_report_sample/feed_posts.json

# broken asset fallback sample
python -m app.services.import_external_posts --input ../data/external_posts/examples/broken_asset_sample/feed_posts.json

# MVP12 asset viewer sample (sort_order / lightbox / table / file·link)
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json

# managed storage 복사 sample (상대 로컬 경로 asset)
python -m app.services.import_external_posts --input ../data/external_posts/examples/managed_copy_sample/feed_posts.json
```

특정 DB를 명령에서 직접 지정:

```bash
python -m app.services.import_external_posts \
  --input ../data/external_posts/examples/feed_import_sample.json \
  --database-url postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype_import_test
```

같은 JSON을 다시 import해도 `external_id` 기준으로 update되어 duplicate post가 생기지
않습니다.

### 7.2 HTTP import API (v0.3.0)

backend가 실행 중이면 같은 package JSON을 HTTP로도 보낼 수 있습니다(파일 이동·managed
복사 없음).

```bash
# dry-run (검증·요약만)
curl -X "POST" "http://127.0.0.1:8000/api/imports?dry_run=true" \
  -H "Content-Type: application/json" \
  --data-binary @../data/external_posts/examples/feed_import_sample.json

# 실제 import
curl -X "POST" "http://127.0.0.1:8000/api/imports" \
  -H "Content-Type: application/json" \
  --data-binary @../data/external_posts/examples/feed_import_sample.json
```

선택적 보호: `backend/.env`에 `IMPORT_API_TOKEN`을 설정하면 요청에
`-H "X-Import-Token: <token>"`이 일치해야 합니다(미설정 시 검사 없음). 정식 인증이
아니며 backend는 localhost 바인딩을 전제로 합니다.

### 7.3 디렉터리 일괄 처리 (v0.3.2)

`data/external_posts/incoming/`에 둔 package를 한 번에 처리합니다. package는 단일
`.json` 파일 또는 `feed_posts.json`을 포함한 디렉터리입니다. 성공하면 `archive/`,
실패하면 `failed/`로 자동 이동합니다(이름 충돌 시 덮어쓰지 않고 타임스탬프 접미사).
한 package가 실패해도 나머지는 계속 처리됩니다. `examples/`는 절대 건드리지 않습니다.

```bash
cd feed-prototype/backend

# incoming/을 한 번 처리 (성공→archive/, 실패→failed/)
python -m app.services.process_incoming

# 검증/요약만 (DB·파일 모두 변경 없음)
python -m app.services.process_incoming --dry-run
```

external_posts 루트는 `backend/.env`의 `EXTERNAL_POSTS_DIR` 또는 `--base-dir`로 바꿀
수 있고, 기본값은 리포의 `data/external_posts`입니다.

지속 import 흐름:

1. `data/external_posts/incoming/` 아래에 새 batch 폴더 또는 `.json`을 둡니다.
2. asset 파일을 브라우저가 접근 가능한 위치에 두거나 package 내부 상대 경로로 둡니다.
3. `--dry-run`으로 검증합니다.
4. 실제 `process_incoming`을 실행합니다.
5. API mode UI에서 Home Feed / Account Profile / Post Detail / Imports를 확인합니다.

### 7.4 Watch 폴링 (v0.3.2)

`incoming/`을 일정 간격으로 폴링하며 새 package를 자동 처리합니다. OS scheduler/데몬이나
inotify/watchdog 같은 파일시스템 이벤트가 아니라 단순 폴링입니다. `Ctrl-C`로 종료합니다.

```bash
cd feed-prototype/backend

# 기본 10초 간격
python -m app.services.process_incoming --watch --interval 10

# dry-run watch (DB·파일 무변경, 검증만 반복)
python -m app.services.process_incoming --watch --interval 10 --dry-run
```

권장 실행 배치(터미널 3개):

```text
터미널 A: python -m uvicorn app.main:app --reload         # backend
터미널 B: npm run dev                                       # frontend (API mode)
터미널 C: python -m app.services.process_incoming --watch  # watch 폴링
```

이후 외부 프로그램이 `incoming/`에 package를 떨어뜨리면 Watch가 자동 import하고,
브라우저를 새로고침하면 새 post가 보입니다.

> **외부 프로그램이 package를 쓸 때**: watch가 쓰다 만 파일을 집지 않도록, 임시 파일에
> 쓴 뒤 rename(atomic)으로 `incoming/`에 넣는 것을 권장합니다.

#### Watch 중 `npm run dev`가 꺼지는 문제 (해결됨)

이전에는 Watch가 새 데이터를 갱신할 때 frontend의 `npm run dev`가 종료되는 문제가
있었습니다. 원인은 managed storage 복사(7.5)가 켜진 상태에서 import 때마다 asset
파일이 `public/assets/managed/`(Vite root 내부)로 복사되고, 같은 시점에
`incoming/archive/failed` 사이에서 package 파일이 이동하면서, Vite dev server의 파일
watcher가 그 churn에 반응했기 때문입니다(특히 Windows에서 copy/rename 경합이 watcher
오류로 이어져 dev server가 종료).

이 runbook 버전부터 `vite.config.ts`의 `server.watch.ignored`에
`public/assets/managed/**`와 `data/external_posts/**`를 추가해 Vite가 이 런타임
데이터 경로를 감시하지 않습니다. `public/` 아래 파일은 watch 여부와 무관하게 계속
serve되므로 asset 표시에는 영향이 없고, import마다 발생하던 불필요한 full reload도
사라집니다. dev server를 이미 켜둔 상태에서 `vite.config.ts`를 바꾼 경우에는
`npm run dev`를 한 번 재시작합니다.

### 7.5 Asset Managed Storage 복사 (v0.3.3, opt-in)

기본적으로 import는 asset의 `url` 문자열만 저장합니다(파일 복사 없음). asset 내구성을
위해 `backend/.env`에서 켜면, asset url이 **상대 로컬 경로**(예: `assets/img.png`)일
때 패키지 디렉터리 기준으로 파일을 찾아 `public/assets/managed/<batch>/<asset>`으로
복사하고 DB url을 `/assets/managed/...`로 재작성합니다.

```text
# backend/.env
MANAGE_ASSET_STORAGE=true
# (선택) 복사 위치/서빙 prefix 재정의 — 둘은 같은 위치의 파일/URL 표현, 함께 바꿉니다.
MANAGED_ASSETS_DIR=.../feed-prototype/public/assets/managed
MANAGED_ASSETS_URL_PREFIX=/assets/managed
```

규칙:

- `/assets/...`·`http(s)://`·`//`로 시작하는 url은 **건드리지 않습니다**(format 동결).
- 복사는 디스크 패키지가 있는 CLI(`--input`)와 `process_incoming` 경로에만 적용됩니다.
  **HTTP import는 적용되지 않습니다.**
- 원본 누락·패키지 밖 경로·복사 실패는 import를 실패시키지 않고 원본 url을 유지합니다.
- 목적지가 결정적이라 같은 package 재import 시 덮어씁니다(누적 없음).
- 기본값 OFF에서는 v0.3.2와 동작이 완전히 동일합니다.

예제: `examples/managed_copy_sample/`. 상세 guide:
`archive/V0_3_3_ASSET_STORAGE_SCOPE.md`.

## 8. UI 확인 시나리오

API mode frontend에서 다음을 확인합니다.

- Login/Logout: seed user(id/handle + password)로 로그인, session 유지(새로고침), Logout
  복귀를 확인합니다. 잘못된 password는 거부됩니다(v0.6.0).
- Account Profile self-service: Me 탭에서 display name/bio/avatar URL을 저장하면 Me 헤더와
  내 post 카드의 account 표시가 즉시 갱신되는지, handle/kind는 그대로인지 확인합니다(v0.6.2).
- 계정 비활성화/재활성화: Me 탭 Danger zone에서 비활성화 → 로그아웃·로그인 차단·Accounts
  목록 제외를 확인하고, post가 보존되는지(Account Profile/Post Detail) 확인합니다. 운영자
  `python -m scripts.reactivate_user --user <id|handle>`로 복구되는지 확인합니다(v0.6.4).
- Password change: Me 탭에서 현재 password 검증 후 새 password로 변경, 변경 후 이전
  password 실패 / 새 password 로그인 성공을 확인합니다(v0.6.0).
- Home Feed: active user의 own account와 followed account post가 표시되는지 확인합니다.
- Account Profile: imported account와 imported post가 표시되는지 확인합니다.
- Post Detail: imported post의 title, text, tag, metadata, asset이 표시되는지 확인합니다.
- Follow/unfollow: imported account를 follow한 뒤 Home Feed 표시가 바뀌는지 확인합니다.
- Post create/edit/delete: active API user own post에 대해 생성·수정·삭제를 확인합니다.
- Comments: Post Detail에서 댓글 작성/수정/삭제와 `@mention`·`#hashtag` 렌더를 확인합니다.
- Bookmarks: 카드/상세 북마크 토글, private note 저장, Me 탭 북마크 목록을 확인합니다.
- Notifications: `/notifications` 목록, unread/all 토글, Mark all read, SideNav unread
  badge, Home unread 진입, Me 탭 Mentions 요약을 확인합니다.
- Image/plot lightbox: image/plot thumbnail을 클릭해 modal/lightbox가 열리는지 확인합니다.
- Multi image/plot order: 여러 visual asset이 `sort_order` 순서로 표시되는지 확인합니다.
- Table CSV preview: CSV table asset preview가 표시되는지 확인합니다.
- File/link open: file/link card의 Open original 동작을 확인합니다.
- Filter/search: keyword, tag, metadata key/value, asset type, account filter 적용/reset.
- Imports(`/imports`): import batch 목록·상세가 표시되는지 확인합니다(API mode 전용).

Imported post가 Home Feed에 바로 보이지 않을 수 있습니다. Home Feed는 active user의
own account와 followed account post를 표시하므로, imported account follow 여부를
확인하거나 Account Profile/Post Detail에서 먼저 확인합니다.

## 9. DB 사용 Mode

DB는 목적에 따라 분리해서 사용할 수 있습니다.

```text
feed_dev  - 개발/기능 테스트용
feed_ops  - 외부 post package를 지속적으로 쌓아보는 운영형 테스트용
```

같은 backend code를 사용하되 `backend/.env`의 `DATABASE_URL`만 바꾸거나 import
명령의 `--database-url`로 override합니다. External import 전에는 항상 다음을
확인합니다.

- 현재 활성화된 backend Python 환경
- `backend/.env`의 `DATABASE_URL`
- import command의 `--database-url` override 사용 여부
- dry-run 결과

실제 운영 DB URL이나 비밀번호는 `.env.example`, README, runbook에 넣지 않습니다.

## 10. 자주 발생하는 문제

### Backend가 꺼져 있음
API mode frontend는 `VITE_API_BASE_URL`의 backend에 요청합니다.
`python -m uvicorn app.main:app --reload`가 실행 중인지 확인합니다.

### `VITE_DATA_SOURCE` 설정 오류
`mock`과 `api` 중 하나로 설정합니다. 다른 값이면 의도와 다른 mode로 동작할 수 있습니다.

### Vite env 변경 후 dev server를 재시작하지 않음
Vite 환경변수는 dev server 시작 시점에 읽힙니다. `.env` 수정 후 `npm run dev`를 다시
시작합니다. `vite.config.ts`를 바꾼 경우에도 마찬가지입니다.

### Watch 중 `npm run dev`가 종료됨
7.4의 설명을 참고합니다. 이 runbook 버전 기준 `vite.config.ts`가 managed storage와
external_posts 경로를 watcher에서 제외하므로 해결되어 있습니다. 그래도 발생하면
`vite.config.ts`의 `server.watch.ignored` 값과 dev server 재시작 여부를 확인합니다.

### `DATABASE_URL`이 잘못됨
Backend startup, migration, seed, import가 모두 `DATABASE_URL`에 의존합니다. DB 이름,
user, password, port를 확인합니다.

### Migration 미적용
Table/column 관련 오류가 나면 backend 폴더에서 `alembic upgrade head`를 실행합니다.

### 협업 회귀 스크립트 TestClient 의존성
`python -m scripts.check_comments`, `python -m scripts.check_bookmarks`,
`python -m scripts.check_notifications`는 FastAPI/Starlette `TestClient`를 사용합니다.
현재 Python/Starlette 조합에서 `httpx2` package를 요구하는 경우, 테스트 환경에 해당
package를 설치한 뒤 실행합니다(`requirements.txt`에 이미 포함).

### 회귀 스크립트가 401/403을 반환함 (v1.0.0)
write/self-scoped endpoint를 쓰는 회귀 스크립트(`check_comments`,
`check_bookmarks`, `check_notifications`, `check_account_identity`,
`check_account_profile`, `check_account_lifecycle`)는 더 이상 `user_id`를
보내지 않고 `scripts/auth_test_utils.py`의 `set_known_password` + `login`으로
실제 `/api/auth/login` 세션을 받아 호출합니다. 직접 새 스크립트를 작성한다면 같은
헬퍼로 행위자를 바꿀 때마다 다시 로그인해야 합니다(`TestClient`는 쿠키 하나만
유지).

### Seed data 미삽입
seed user(`ari`/`mika`/`nova`)로 로그인이 안 되거나 Home Feed가 비어 있으면
`python -m app.services.seed`를 실행했는지 확인합니다. (v1.0.0부터 로그인 화면은
전체 user 목록을 더 이상 보여주지 않으므로, handle/id를 직접 입력해 로그인합니다.)

### 로그인 실패 / password 분실 (v0.6.0~v0.6.3)
seed user의 초기 password는 handle과 같습니다(`ari`/`mika`/`nova`). password를 바꾼 뒤
분실했다면 재-seed로는 복구되지 않습니다(seed는 write-once). 운영자가 재설정합니다:

```bash
cd feed-prototype/backend
python -m scripts.reset_password --user ari --password temppass
```

쿠키가 저장되지 않아 로그인이 유지되지 않으면, frontend(`5173`)와 backend(`8000`)
origin이 `app/main.py`의 CORS `allow_origins`와 일치하는지(자격증명 쿠키는 정확한
origin이 필요) 확인합니다.

### 비활성화한 계정으로 다시 로그인할 수 없음 (v0.6.4)
계정 비활성화(Me 탭 Danger zone)는 soft deactivation입니다. 로그인이 차단되고
(`403`) 기존 session은 폐기되며 Accounts 목록에서 숨겨지지만, post는 보존됩니다.
재활성화는 self-service가 아니라 운영자 작업입니다:

```bash
cd feed-prototype/backend
python -m scripts.reactivate_user --user ari
```

비활성 계정의 profile/post는 `GET /api/accounts/{id}`·`.../posts`로 계속 조회되며,
목록에 포함하려면 `GET /api/accounts?include_deactivated=true`를 씁니다.

### `asset.url`이 브라우저에서 접근 불가
단일 파일 CLI는 asset file을 복사하지 않습니다. `asset.url`은 browser-accessible URL
또는 static path여야 합니다. (managed storage(7.5)를 켜면 상대 로컬 경로 asset만
복사·재작성됩니다.)

### Windows 절대경로를 `asset.url`에 넣음
`C:\...` 같은 local filesystem path는 browser URL이 아닙니다. `/assets/...` 또는
`https://...` 형태의 접근 가능한 URL을 사용합니다.

### Imported post가 Home Feed에 안 보임
Home Feed는 active user own account와 followed account post를 보여줍니다. Imported
account를 follow했는지 확인하거나 Account Profile/Post Detail에서 먼저 확인합니다.

### Table preview 실패
CSV file path가 browser-accessible인지, CSV가 UTF-8 text로 읽히는지 확인합니다. 실패
시 UI는 fallback card와 Open original action을 표시해야 합니다.

### incoming/ package가 처리되지 않음
package는 단일 `.json` 또는 `feed_posts.json`을 포함한 디렉터리여야 합니다. 그 외
항목은 skipped 처리됩니다. 쓰다 만 파일을 watch가 집지 않도록 atomic rename으로
넣었는지 확인합니다.

### Port 충돌
Vite 기본 port는 보통 `5173`, backend 기본 port는 `8000`입니다. 이미 사용 중이면
terminal log의 대체 port 또는 backend 실행 옵션을 확인합니다.

## 11. 관련 문서

- `../README.md`
- `RELEASE_0_0_CHECKLIST.md`
- `V1_0_0_RELEASE_SCOPE.md` (session 인가 / cookie / CORS 하드닝 must-do)
- `ACCOUNT_MANAGEMENT.md` (계정 관련 모든 명령어)
- `EXTERNAL_POST_PACKAGE_GUIDE.md`
- `../data/external_posts/README.md`
- `ROADMAP.md`
- `archive/V0_6_0_AUTH_SCOPE.md` (password 로그인 + session)
- `archive/V0_6_1_ACCOUNT_IDENTITY_SCOPE.md` (User:Account 1:1)
- `archive/V0_6_2_PROFILE_SELF_SERVICE_SCOPE.md` (profile self-service)
- `archive/V0_6_3_AUTH_HARDENING_SCOPE.md` (운영자 reset / 401 처리 / 정리, 이연 항목)
- `archive/V0_6_4_ACCOUNT_LIFECYCLE_SCOPE.md` (탈퇴/비활성 + post 보존, 운영자 재활성화)
- `archive/V0_3_2_AUTO_INGESTION_SCOPE.md` (디렉터리 일괄 처리 / Watch)
- `archive/V0_3_3_ASSET_STORAGE_SCOPE.md` (managed storage 복사)
- `archive/MVP10_EXTERNAL_POST_FORMAT.md`
