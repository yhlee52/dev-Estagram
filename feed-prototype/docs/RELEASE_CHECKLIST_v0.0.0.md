# v0.0.0 릴리즈 체크리스트

`v0.0.0`은 `feed-prototype`의 첫 번째 공유 가능한 internal/local prototype release입니다.

production-ready가 아닙니다. formal authentication, authorization, JWT, session, OAuth, role system, production file storage를 포함하지 않습니다.

## 릴리즈 범위

- [ ] 릴리즈 버전은 `v0.0.0`입니다.
- [ ] `feed-prototype/package.json` version은 `0.0.0`입니다.
- [ ] App UI에 `v0.0.0`이 표시됩니다.
- [ ] README가 릴리즈 의미와 prototype 제약을 설명합니다.
- [ ] README가 mock mode, API mode, external import mode를 설명합니다.
- [ ] `.env.example` 파일이 local default를 설명합니다.
- [ ] External post package guide가 MVP12 `asset.sort_order`를 설명합니다.
- [ ] 일반 SNS-like sample이 식별되어 있습니다.
- [ ] 분석/리포트형 external import sample이 식별되어 있습니다.
- [ ] Smoke test procedure가 문서화되어 있습니다.

## Generic Domain 확인

- [ ] Core model/component/route/data-flow name은 generic하게 유지됩니다.
- [ ] Core concept는 User, Account, Post, Feed, Follow, Asset, Metadata입니다.
- [ ] 새 core architecture name에 Equipment, Chamber, Sensor, Recipe, Severity, Report를 사용하지 않습니다.
- [ ] Scenario-specific value는 `metadata_json` 또는 asset metadata에 유지됩니다.

## Mock Mode 확인

- [ ] `VITE_DATA_SOURCE=mock`이 backend 없이 실행됩니다.
- [ ] Home Feed가 static sample post를 표시합니다.
- [ ] Local user selection/registration이 동작합니다.
- [ ] Mock follow state가 localStorage overlay를 계속 사용합니다.
- [ ] 릴리즈 문서 준비 과정에서 mock mode behavior가 제거되지 않았습니다.

## API Mode 확인

- [ ] Local PostgreSQL database가 있습니다.
- [ ] `backend/.env`가 의도한 `DATABASE_URL`을 가리킵니다.
- [ ] `alembic upgrade head`가 성공합니다.
- [ ] `python -m app.services.seed`가 성공합니다.
- [ ] `uvicorn app.main:app --reload`가 시작됩니다.
- [ ] `GET /health`가 healthy status를 반환합니다.
- [ ] `VITE_DATA_SOURCE=api` frontend에서 API user를 선택할 수 있습니다.
- [ ] API Home Feed, Accounts, Account Profile, Post Detail이 표시됩니다.
- [ ] API follow/unfollow가 동작합니다.
- [ ] API post create/edit/delete가 active user own post에 대해 동작합니다.

## External Import 확인

- [ ] `data/external_posts/examples/feed_import_sample.json` dry-run이 성공합니다.
- [ ] 실제 import가 의도한 database에 성공합니다.
- [ ] 같은 JSON을 다시 import하면 duplicate post가 아니라 기존 row update로 처리됩니다.
- [ ] Imported Account/Profile/Post Detail을 API mode에서 볼 수 있습니다.
- [ ] Imported post가 generic Account/Post/Asset/Metadata 구조를 사용합니다.
- [ ] Asset URL은 browser-accessible path 또는 URL입니다.
- [ ] Missing asset URL이 UI에서 graceful fallback으로 처리됩니다.

## Asset Viewer 확인

- [ ] Image와 plot asset이 thumbnail로 표시됩니다.
- [ ] Image/plot 클릭 시 lightbox가 열립니다.
- [ ] 한 post에 visual asset이 여러 개 있으면 prev/next가 동작합니다.
- [ ] Visual asset이 `sort_order` 오름차순을 따릅니다.
- [ ] 접근 가능한 CSV table asset은 짧은 preview를 표시합니다.
- [ ] CSV table preview 실패 시 fallback과 Open original action을 표시합니다.
- [ ] File asset은 inline PDF/HTML preview가 아니라 file card로 표시됩니다.
- [ ] Link asset은 link/card로 표시됩니다.

## 최종 검증

- [ ] `feed-prototype`에서 `npm run build`가 통과합니다.
- [ ] Local `.env`, database dump, generated large binary asset, local PostgreSQL data가 commit되지 않았습니다.
- [ ] 릴리즈 handoff가 `README.md`, `feed-prototype/README.md`, 이 checklist, `SMOKE_TEST_v0.0.0.md`를 안내합니다.
