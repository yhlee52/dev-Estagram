# feed-prototype 릴리즈 체크리스트 (v0.6.3 기준)

이 문서는 `feed-prototype` 릴리즈 직전 확인 항목입니다. 현재 릴리즈 `v0.6.3`
(인증 & 멀티유저 theme — auth hardening & cleanup) 기준으로
갱신됩니다.

> 파일명은 v0.0.0 release 시점의 이름(`RELEASE_0_0_CHECKLIST.md`)을 유지하지만, 내용은
> 항상 현재 릴리즈 기준입니다. v0.0.0 시점 historical 사본은
> `archive/RELEASE_CHECKLIST_v0.0.0.md`에 있습니다. 실행 절차 상세는
> `RELEASE_0_0_RUNBOOK.md`를 참고하세요.

실제 실행 순서는 위에서 아래로 진행하는 것을 권장합니다. Local `.env`, database,
sample import 대상 DB가 의도한 상태인지 먼저 확인한 뒤 backend, frontend, external
import, UI smoke test, documentation, tag 순서로 진행합니다.

## 1. Git 상태

- [ ] 릴리즈 대상 branch가 맞습니다.
- [ ] `git status`가 clean입니다.
- [ ] `.env` 파일이 commit 대상에 없습니다.
- [ ] `backend/.env` 파일이 commit 대상에 없습니다.
- [ ] `*.env.local` 파일이 commit 대상에 없습니다.
- [ ] `node_modules`가 commit 대상에 없습니다.
- [ ] `dist` build output이 commit 대상에 없습니다.
- [ ] DB dump 또는 local PostgreSQL data가 commit 대상에 없습니다.
- [ ] 큰 binary sample asset이 commit 대상에 없습니다.
- [ ] sample CSV처럼 의도적으로 작은 text sample만 포함되어 있습니다.
- [ ] managed storage 런타임 산출물(`public/assets/managed/*`)이 commit 대상에 없습니다(`.gitkeep` 제외).
- [ ] `incoming/`·`archive/`·`failed/`에 실제 운영 package가 commit 대상으로 남아 있지 않습니다.

확인 명령:

```bash
git status
```

## 2. Backend

Backend 폴더에서 실행합니다.

```bash
cd feed-prototype/backend
```

- [ ] Python 환경이 활성화되어 있습니다.
- [ ] `backend/.env`의 `DATABASE_URL`이 의도한 local/test DB를 가리킵니다.
- [ ] Python compile check가 통과합니다.

```bash
python -m compileall app
```

- [ ] Migration이 통과합니다.

```bash
alembic upgrade head
```

- [ ] Seed 실행이 가능합니다.

```bash
python -m app.services.seed
```

- [ ] Backend server 실행이 가능합니다.

```bash
python -m uvicorn app.main:app --reload
```

다른 terminal에서 확인합니다.

- [ ] `/health`가 응답합니다.
- [ ] `/api/posts`가 응답합니다.
- [ ] `/api/feed`가 응답합니다.
- [ ] `/api/imports`(import batch 이력, v0.3.1)가 응답합니다.
- [ ] `/api/users/{id}/notifications`(in-app 알림, v0.5.2)가 응답합니다.
- [ ] `/api/auth/login` → `/api/auth/session`(password 로그인 + session, v0.6.0)이 동작합니다.

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/posts
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
curl http://127.0.0.1:8000/api/imports
curl "http://127.0.0.1:8000/api/users/demo-user-ari/notifications"
curl -c cookies.txt -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" --data '{"login":"ari","password":"ari"}'
curl -b cookies.txt http://127.0.0.1:8000/api/auth/session
```

협업 회귀 스크립트:

- [ ] `scripts/check_comments.py`가 통과합니다(v0.5.0).
- [ ] `scripts/check_bookmarks.py`가 통과합니다(v0.5.1).
- [ ] `scripts/check_notifications.py`가 통과합니다(v0.5.2).
- [ ] 현재 Python 환경의 `starlette.testclient`가 `httpx2`를 요구하는 경우 해당 package
  설치 또는 테스트 환경 조정을 먼저 완료합니다.

```bash
python -m scripts.check_comments
python -m scripts.check_bookmarks
python -m scripts.check_notifications
```

인증 & identity / profile 회귀 스크립트 (v0.6.x):

- [ ] `scripts/check_account_identity.py`가 통과합니다(v0.6.1, User:Account 1:1).
- [ ] `scripts/check_account_profile.py`가 통과합니다(v0.6.2, profile self-service).
- [ ] (선택) `scripts/reset_password.py`로 임의 seed user의 password를 재설정하고
  이전 password 실패 / 새 password 로그인 성공을 확인합니다(v0.6.3).

```bash
python -m scripts.check_account_identity
python -m scripts.check_account_profile
```

## 3. Frontend

Frontend app 폴더에서 실행합니다.

```bash
cd feed-prototype
```

- [ ] `npm install`이 가능합니다.

```bash
npm install
```

- [ ] `npm run build`가 통과합니다.

```bash
npm run build
```

- [ ] `npm run lint`가 통과합니다.

```bash
npm run lint
```

- [ ] Mock mode 실행이 가능합니다.

```text
VITE_DATA_SOURCE=mock
```

```bash
npm run dev
```

- [ ] API mode 실행이 가능합니다.

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

```bash
npm run dev
```

- [ ] Vite env 변경 후 dev server 재시작이 문서대로 동작합니다.
- [ ] `vite.config.ts`의 `server.watch.ignored`에 `public/assets/managed/**`와
  `data/external_posts/**`가 포함되어 있습니다(Watch 중 dev server 종료 방지, 7.4 참고).

## 4. External Import

Backend 폴더에서 실행합니다.

```bash
cd feed-prototype/backend
```

Import 전 확인:

- [ ] `backend/.env`의 `DATABASE_URL`이 의도한 DB를 가리킵니다.
- [ ] 실제 운영 DB URL이나 비밀번호를 사용하지 않습니다.
- [ ] 먼저 dry-run을 실행합니다.

### 4.1 단일 파일 CLI (dry-run → import)

- [ ] `general_social_sample` dry-run / import가 가능합니다.
- [ ] `analysis_report_sample` dry-run / import가 가능합니다.
- [ ] `broken_asset_sample` dry-run / import가 가능합니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json
python -m app.services.import_external_posts --input ../data/external_posts/examples/analysis_report_sample/feed_posts.json
python -m app.services.import_external_posts --input ../data/external_posts/examples/broken_asset_sample/feed_posts.json
```

- [ ] Re-import 시 `external_id` 기준 upsert로 동작하며 duplicate post가 생기지 않습니다.

### 4.2 HTTP import API (v0.3.0)

- [ ] backend 실행 중 `POST /api/imports?dry_run=true`가 요약을 반환합니다.
- [ ] `POST /api/imports`(실제 import)가 동작합니다.
- [ ] (`IMPORT_API_TOKEN` 설정 시) `X-Import-Token` 불일치 요청이 거부됩니다.

```bash
curl -X "POST" "http://127.0.0.1:8000/api/imports?dry_run=true" \
  -H "Content-Type: application/json" \
  --data-binary @../data/external_posts/examples/feed_import_sample.json
```

### 4.3 디렉터리 일괄 처리 / Watch (v0.3.2)

- [ ] `incoming/`에 둔 package를 `process_incoming`이 일괄 처리합니다.
- [ ] 성공 package가 `archive/`로, 실패 package가 `failed/`로 이동합니다(이름 충돌 시 타임스탬프 접미사).
- [ ] `--dry-run`이 DB·파일을 모두 변경하지 않습니다.
- [ ] `examples/`는 처리 대상에서 제외됩니다(건드리지 않음).
- [ ] `--watch --interval N` 폴링이 새 package를 자동 처리하고 `Ctrl-C`로 정상 종료됩니다.
- [ ] Watch 실행 중 frontend `npm run dev`가 종료되지 않습니다(7.4 / `vite.config.ts` 확인).

```bash
python -m app.services.process_incoming --dry-run
python -m app.services.process_incoming
python -m app.services.process_incoming --watch --interval 10
```

### 4.4 Asset Managed Storage 복사 (v0.3.3, opt-in)

- [ ] 기본값(미설정)에서는 asset 파일 복사가 일어나지 않습니다(v0.3.2와 동일 동작).
- [ ] `MANAGE_ASSET_STORAGE=true`에서 상대 로컬 경로 asset이 `public/assets/managed/`로 복사되고 DB url이 `/assets/managed/...`로 재작성됩니다.
- [ ] `/assets/...`·`http(s)://` url은 건드리지 않습니다.
- [ ] HTTP import 경로에는 복사가 적용되지 않습니다.
- [ ] 원본 누락·복사 실패가 import를 실패시키지 않고 원본 url을 유지합니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/managed_copy_sample/feed_posts.json --dry-run
```

## 5. UI Smoke Test

API mode frontend에서 확인합니다.

- [ ] 로그인 화면에서 seed user(id/handle + password, 예: `ari`/`ari`)로 로그인됩니다(v0.6.0).
- [ ] 잘못된 password가 거부되고, 새로고침해도 session으로 로그인 상태가 유지됩니다(v0.6.0).
- [ ] 로그인 화면에서 신규 API user 등록(user+1:1 account 생성)이 동작합니다.
- [ ] Logout으로 로그인 화면에 복귀하고, 서버 session 만료/삭제 시 다음 호출에서 자동
  복귀합니다(v0.6.3).
- [ ] Me 탭에서 내 account profile(display name/bio/avatar URL) 편집이 저장되고 Me 헤더·
  내 post 카드 account 표시가 즉시 갱신됩니다. handle/kind는 바뀌지 않습니다(v0.6.2).
- [ ] Me 탭 password 변경 후 이전 password 실패 / 새 password 로그인 성공입니다(v0.6.0).
- [ ] Home Feed가 표시됩니다.
- [ ] Explore(Posts) / Accounts / Me 탭이 표시됩니다.
- [ ] Imports(`/imports`) 탭에서 batch 목록·상세가 표시됩니다(API mode 전용, mock에는 미노출).
- [ ] Account Profile이 표시됩니다.
- [ ] Post Detail이 표시됩니다.
- [ ] follow/unfollow가 동작합니다.
- [ ] post create/edit/delete가 active API user own post에 대해 동작합니다.
- [ ] post 삭제 시 공용 `ConfirmDialog`(오버레이/Escape/백드롭)가 동작합니다(v0.3.4).
- [ ] Me 탭(API mode) 내 post가 "Load more"로 점진 렌더됩니다(v0.3.4).
- [ ] Post Detail 댓글 작성/수정/삭제와 댓글 mention/hashtag 렌더가 동작합니다(v0.5.0).
- [ ] 카드/상세 북마크 토글, Post Detail private note, Me 탭 북마크 목록이 동작합니다(v0.5.1).
- [ ] Me 탭 Following 목록이 팔로우 account 프로필로 이동합니다(v0.5.1).
- [ ] `/notifications` 목록, unread/all 토글, Unread empty state, Mark all read,
  SideNav unread badge, Home unread 진입, Me 탭 Mentions 요약이 동작합니다(v0.5.2~v0.5.3).
- [ ] filter/search가 동작하고, 0건 empty state의 "Reset filters"가 동작합니다.
- [ ] image/plot lightbox가 열리고 prev/next가 동작합니다.
- [ ] multi image/plot이 `sort_order` 순서로 표시됩니다.
- [ ] table CSV preview가 표시됩니다.
- [ ] file/link Open original이 동작합니다.
- [ ] broken asset fallback이 crash 없이 표시됩니다.
- [ ] managed storage로 복사된 asset이 `/assets/managed/...`에서 정상 표시됩니다(해당 시).
- [ ] UI 어딘가(아바타 드롭다운 등)에 현재 버전(`feed-prototype v0.6.3`)이 표시됩니다.

Imported post가 Home Feed에 바로 보이지 않으면 imported account follow 정책을
확인합니다. Account Profile과 Post Detail에서도 imported post를 확인합니다.

## 6. Documentation

- [ ] Root `README.md`가 현재 릴리즈 기준으로 최신화되어 있습니다.
- [ ] `RELEASE_0_0_RUNBOOK.md`가 현재 릴리즈 기준 실행 절차를 담고 있습니다.
- [ ] `RELEASE_0_0_CHECKLIST.md`(이 문서)가 현재 릴리즈 기준입니다.
- [ ] `EXTERNAL_POST_PACKAGE_GUIDE.md`가 존재합니다.
- [ ] `../data/external_posts/README.md`가 존재합니다.
- [ ] `ROADMAP.md`의 버전 트리가 현재 릴리즈를 반영합니다.
- [ ] `V0_6_0`~`V0_6_3` scope 문서가 존재하고, `V0_6_4`(계정 라이프사이클)는 계획으로
  표시되어 있습니다.
- [ ] Sample package 설명과 각 sample `assets/README.md`가 존재합니다.
- [ ] limitations가 명시되어 있습니다: production-ready 아님. password 로그인 +
  server-side session은 있으나 OAuth/SSO/JWT/RBAC는 없고, write endpoint는 아직
  user_id 기반 인가(비-localhost 이전 시 session-only 전환 예정)입니다.
- [ ] external import 전 `DATABASE_URL` 확인이 문서화되어 있습니다.

## 7. Release Tag

최종 문제가 없으면 아래 절차를 사용합니다. (버전 문자열은 현재 릴리즈에 맞춥니다.)

```bash
git status
npm run build
```

Backend 확인:

```bash
cd backend
python -m compileall app
alembic upgrade head
```

Tag 생성 및 push (예: 현재 릴리즈):

```bash
cd ..
git tag v0.6.3
git push origin v0.6.3
```

Branch 정책에 따라 `main` 또는 release branch로 merge한 뒤 tag할 수도 있습니다. 실제
팀 branch/tag 정책이 있다면 그 정책을 우선합니다.

Tag 전 마지막 확인:

- [ ] `git status`가 clean입니다.
- [ ] tag 대상 commit이 의도한 commit입니다.
- [ ] release 문서와 sample package가 포함되어 있습니다.
- [ ] 실제 `.env`, DB dump, 큰 binary asset, managed storage 산출물이 포함되어 있지 않습니다.
