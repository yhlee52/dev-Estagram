# feed-prototype v0.0.0 릴리즈 체크리스트

이 문서는 `feed-prototype` v0.0.0 릴리즈 직전 확인 항목입니다.

실제 실행 순서는 위에서 아래로 진행하는 것을 권장합니다. Local `.env`, database, sample import 대상 DB가 의도한 상태인지 먼저 확인한 뒤 backend, frontend, external import, UI smoke test, documentation, tag 순서로 진행합니다.

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

- [ ] `/api/posts`가 응답합니다.
- [ ] `/api/feed`가 응답합니다.

```bash
curl http://127.0.0.1:8000/api/posts
curl "http://127.0.0.1:8000/api/feed?user_id=demo-user-ari"
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

Vite env 변경 후에는 dev server를 재시작합니다.

## 4. External Import

Backend 폴더에서 실행합니다.

```bash
cd feed-prototype/backend
```

Import 전 확인:

- [ ] `backend/.env`의 `DATABASE_URL`이 의도한 DB를 가리킵니다.
- [ ] 실제 운영 DB URL이나 비밀번호를 사용하지 않습니다.
- [ ] 먼저 dry-run을 실행합니다.

Dry-run 확인:

- [ ] `general_social_sample` dry-run이 가능합니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json --dry-run
```

- [ ] `analysis_report_sample` dry-run이 가능합니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/analysis_report_sample/feed_posts.json --dry-run
```

- [ ] `broken_asset_sample` dry-run이 가능합니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/broken_asset_sample/feed_posts.json --dry-run
```

Actual import 확인:

- [ ] `general_social_sample` actual import가 가능합니다.
- [ ] `analysis_report_sample` actual import가 가능합니다.
- [ ] `broken_asset_sample` actual import가 가능합니다.

```bash
python -m app.services.import_external_posts --input ../data/external_posts/examples/general_social_sample/feed_posts.json
python -m app.services.import_external_posts --input ../data/external_posts/examples/analysis_report_sample/feed_posts.json
python -m app.services.import_external_posts --input ../data/external_posts/examples/broken_asset_sample/feed_posts.json
```

Re-import 확인:

- [ ] 같은 sample을 다시 import해도 duplicate post가 계속 생성되지 않습니다.
- [ ] `external_id` 기준 update/upsert로 동작합니다.

## 5. UI Smoke Test

API mode frontend에서 확인합니다.

- [ ] Home Feed가 표시됩니다.
- [ ] Browse Posts 화면이 있으면 표시됩니다.
- [ ] Account Profile이 표시됩니다.
- [ ] Post Detail이 표시됩니다.
- [ ] follow/unfollow가 동작합니다.
- [ ] post create/edit/delete가 active API user own post에 대해 동작합니다.
- [ ] filter/search가 동작합니다.
- [ ] image/plot lightbox가 열립니다.
- [ ] multi image/plot prev/next가 동작합니다.
- [ ] multi image/plot이 `sort_order` 순서로 표시됩니다.
- [ ] table CSV preview가 표시됩니다.
- [ ] file/link Open original이 동작합니다.
- [ ] broken asset fallback이 crash 없이 표시됩니다.
- [ ] UI 어딘가에 `feed-prototype v0.0.0`이 표시됩니다.

Imported post가 Home Feed에 바로 보이지 않으면 imported account follow 정책을 확인합니다. Account Profile과 Post Detail에서도 imported post를 확인합니다.

## 6. Documentation

- [ ] Root `README.md`가 v0.0.0 기준으로 최신화되어 있습니다.
- [ ] `RELEASE_0_0_RUNBOOK.md`가 존재합니다.
- [ ] `EXTERNAL_POST_PACKAGE_GUIDE.md`가 존재합니다.
- [ ] `RELEASE_0_0_CHECKLIST.md`가 존재합니다.
- [ ] Sample package 설명이 존재합니다.
- [ ] `general_social_sample/assets/README.md`가 존재합니다.
- [ ] `analysis_report_sample/assets/README.md`가 존재합니다.
- [ ] `broken_asset_sample/assets/README.md`가 존재합니다.
- [ ] v0.0.0 limitations가 명시되어 있습니다.
- [ ] production-ready가 아님이 명시되어 있습니다.
- [ ] 정식 login/JWT/session/permission system이 없다는 점이 명시되어 있습니다.
- [ ] external import 전 `DATABASE_URL` 확인이 문서화되어 있습니다.

## 7. Release Tag

최종 문제가 없으면 아래 절차를 사용합니다.

```bash
git checkout dev_feed
git status
npm run build
```

Backend 확인:

```bash
cd backend
python -m compileall app
alembic upgrade head
```

Tag 생성 및 push:

```bash
cd ..
git tag v0.0.0
git push origin v0.0.0
```

Branch 정책에 따라 `main` 또는 release branch로 merge한 뒤 tag할 수도 있습니다. 실제 팀 branch/tag 정책이 있다면 그 정책을 우선합니다.

Tag 전 마지막 확인:

- [ ] `git status`가 clean입니다.
- [ ] tag 대상 commit이 의도한 commit입니다.
- [ ] release 문서와 sample package가 포함되어 있습니다.
- [ ] 실제 `.env`, DB dump, 큰 binary asset이 포함되어 있지 않습니다.
