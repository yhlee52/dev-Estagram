# feed-prototype v0.0.0

`feed-prototype`은 Vite + React + TypeScript 기반의 local/internal Instagram-like generic feed prototype입니다.

`v0.0.0`은 처음으로 공유 가능한 기준 릴리즈입니다. 일반 SNS-like feed와 외부 프로그램이 생성한 분석/리포트형 feed content를 모두 데모할 수 있지만, production-ready 제품은 아닙니다.

## 릴리즈 의미

- 릴리즈 이름: `v0.0.0`
- 범위: 첫 번째 internal/local prototype release
- 제품 방향: generic feed model 유지. 설비 리포트 전용 app이 아님
- production 상태: prototype only
- 인증 상태: password, JWT, session, OAuth, formal permission system 없음

## Core Domain 정책

core product model은 generic하게 유지합니다.

- User
- Account
- Post
- Feed
- Follow
- Asset
- Metadata

core model, shared component, route, data flow에 `Equipment`, `Chamber`, `Sensor`, `Recipe`, `Severity`, `Report` 같은 설비 리포트 전용 이름을 넣지 않습니다. 시나리오 전용 값은 `metadata_json`, `post.metadata`, asset metadata에 둡니다.

## v0.0.0 기능 기준

이 릴리즈는 MVP12까지 완료된 작업을 기준으로 합니다.

- MVP5-MVP7.5: FastAPI backend, PostgreSQL schema, API read mode, user/account registration, follow/unfollow
- MVP8: active user의 1:1 Account를 통한 API-mode personal post create/edit/delete
- MVP9: post tags, metadata, asset descriptors, owned post editing
- MVP10: external JSON post package import pipeline
- MVP11: API-mode keyword, tag, metadata, asset type, account, my-post filter
- MVP12: image/plot thumbnail, lightbox navigation, CSV table preview, file/link card, broken asset fallback을 포함한 asset viewer enhancement

## 실행 Mode 구분

`mock` mode는 frontend mock JSON과 localStorage overlay를 사용합니다. backend 없이 빠른 UI demo에 사용할 수 있습니다.

`api` mode는 FastAPI와 PostgreSQL을 사용합니다. backend user/account/post/follow, API-mode post write, filter, imported external post를 지원합니다.

external import mode는 세 번째 frontend mode가 아닙니다. `feed-prototype/data/external_posts`의 JSON package를 backend CLI가 읽고 PostgreSQL에 upsert한 뒤, 기존 API-mode UI에서 표시하는 작업 흐름입니다.

## 빠른 시작

실행 경로는 app README를 먼저 봅니다.

```text
feed-prototype/README.md
```

릴리즈 관련 문서:

```text
feed-prototype/docs/RELEASE_CHECKLIST_v0.0.0.md
feed-prototype/docs/SMOKE_TEST_v0.0.0.md
feed-prototype/data/external_posts/README.md
feed-prototype/docs/MVP10_EXTERNAL_POST_FORMAT.md
```

## Data 위치

- Frontend mock data: `feed-prototype/src/data`
- Static browser asset: `feed-prototype/public/assets`
- External post package: `feed-prototype/data/external_posts`
- Backend code: `feed-prototype/backend`
- Backend DB state: PostgreSQL. Alembic migration, seed script, import script로 재현합니다.

local `.env`, database dump, local PostgreSQL data는 commit하지 않습니다.

## 검증

handoff 전 Vite app directory에서 frontend build를 실행합니다.

```bash
cd feed-prototype
npm run build
```
