# Archived Document

This document is archived and may not reflect the v0.0.0 release behavior.
See docs/RELEASE_0_0_RUNBOOK.md for current instructions.

# MVP9 실행 및 테스트 절차

## 1. MVP9 목표 요약

MVP9는 기존 MVP9 후보였던 asset attach/upload skeleton과 기존 MVP10 후보였던 post edit/update + metadata editor를 통합한 단계입니다.

MVP9 목표:

- API mode에서 post 작성 시 assets, tags, metadata를 함께 입력할 수 있다.
- API mode에서 active API user가 본인 1:1 Account로 작성한 post를 수정할 수 있다.
- image asset은 preview로 표시한다.
- table, file, plot, link asset은 placeholder 또는 link card로 표시한다.
- mock mode는 기존 local/static 동작을 유지한다.

MVP9는 실제 file upload, S3, drag and drop, rich text editor, metadata search/filter, CSV parsing, chart rendering library, 정식 auth/JWT/session을 구현하지 않는다.

## 2. 전제 조건

MVP9 테스트 전에 다음 상태가 준비되어 있어야 한다.

- PostgreSQL 실행
- backend `.env` 준비
- Alembic migration 적용 가능
- seed data 삽입 가능
- FastAPI backend 실행 가능
- Vite frontend 실행 가능
- MVP8까지의 API mode post create/delete flow가 동작하는 상태

실제 `user_id`와 `post_id`는 seed data 또는 API 응답에 따라 다를 수 있다. `/api/users`, `/api/posts` 응답을 보고 테스트에 사용할 값을 선택한다.

## 3. Backend 실행 절차

Windows + conda 기준:

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

health check:

```powershell
curl http://127.0.0.1:8000/health
```

## 4. Backend API 테스트

테스트용 user 확인:

```powershell
curl http://127.0.0.1:8000/api/users
```

테스트용 post 확인:

```powershell
curl http://127.0.0.1:8000/api/posts
```

아래 예시의 `user_id`와 `POST_ID`는 실제 API 응답에서 확인한 값으로 바꾼다.

### POST /api/posts

```powershell
curl -X POST http://127.0.0.1:8000/api/posts `
  -H "Content-Type: application/json" `
  -d "{\"user_id\":1,\"title\":\"MVP9 asset post\",\"text\":\"Created from curl\",\"tags\":[\"mvp9\",\"asset\"],\"metadata_json\":{\"source\":\"mvp9\"},\"assets\":[{\"type\":\"image\",\"url\":\"/assets/sample-temp-trend.png\",\"title\":\"Temperature trend\",\"description\":\"Sample image asset\"}]}"
```

확인할 것:

- title/text/tags/metadata_json/assets가 response에 포함된다.
- post의 account는 frontend가 보낸 account_id가 아니라 backend가 user_id로 찾은 1:1 Account이다.
- created_at과 updated_at이 존재한다.
- asset type/url/title/description이 저장된다.

### PATCH /api/posts/{post_id}

```powershell
curl -X PATCH http://127.0.0.1:8000/api/posts/POST_ID `
  -H "Content-Type: application/json" `
  -d "{\"user_id\":1,\"title\":\"Updated MVP9 post\",\"text\":\"Updated from curl\",\"tags\":[\"updated\"],\"metadata_json\":{\"source\":\"mvp9\",\"status\":\"updated\"},\"assets\":[{\"type\":\"link\",\"url\":\"https://example.com\",\"title\":\"Example link\"}]}"
```

확인할 것:

- 본인 post이면 수정된다.
- title/text/tags/metadata_json/assets가 새 값으로 반영된다.
- PATCH payload에 assets가 있으면 기존 assets는 replacement 방식으로 교체된다.
- updated_at이 갱신된다.

### Posts 및 Feed 확인

```powershell
curl http://127.0.0.1:8000/api/posts
curl "http://127.0.0.1:8000/api/feed?user_id=1"
```

주의:

- Home Feed는 followed account와 own account 정책에 따라 보이는 post가 달라질 수 있다.
- post 작성 후 feed에 바로 안 보이면 Account Profile 또는 Post Detail에서 먼저 확인한다.

### DELETE /api/posts/{post_id}

```powershell
curl -X DELETE "http://127.0.0.1:8000/api/posts/POST_ID?user_id=1"
```

확인할 것:

- 본인 post만 삭제된다.
- assets가 있는 post도 삭제된다.
- 삭제 후 `/api/posts`에서 해당 post가 사라진다.
- 이미 삭제된 post detail 접근은 404가 된다.

## 5. Frontend API Mode 테스트

frontend `.env` 또는 실행 환경을 API mode로 설정한다.

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://127.0.0.1:8000
```

frontend 실행:

```powershell
cd C:\...\feed-prototype
npm run dev
```

Vite env 값을 바꾼 뒤에는 dev server를 재시작한다.

### API user entry

확인할 것:

- API user entry 화면이 표시된다.
- 기존 backend user를 id 또는 handle로 선택할 수 있다.
- 없는 handle이면 신규 API user/account registration flow가 동작한다.
- 선택 또는 등록 후 Home Feed로 진입한다.

### Post 작성

1. 본인 Account Profile 또는 `/posts/new`로 이동한다.
2. title 입력
3. text 입력
4. tags 입력

예:

```text
mvp9, asset, manual
```

5. asset 입력

예:

```text
type: image
url: /assets/sample-temp-trend.png
title: Temperature trend
description: Sample image asset
```

6. metadata 입력

예:

```text
source: manual
status: new
```

7. submit
8. 작성 성공 후 Post Detail로 이동하는지 확인한다.

확인할 것:

- submit 중 button이 disabled 된다.
- backend off 상태에서는 network error가 표시된다.
- 400 validation error가 표시된다.
- 작성 성공 후 created post detail로 이동한다.
- Home Feed에서 작성 post를 확인한다.
- Account Profile에서 작성 post를 확인한다.
- Post Detail에서 tags/assets/metadata를 확인한다.
- image asset preview가 표시된다.
- table/file/plot/link asset은 placeholder 또는 link card로 표시된다.

### Post 수정

1. 본인 post의 Post Detail로 이동한다.
2. Edit button이 표시되는지 확인한다.
3. Edit button으로 `/posts/:postId/edit`에 진입한다.
4. 기존 title/text/tags/assets/metadata가 preload 되는지 확인한다.
5. title/text/tags/assets/metadata를 수정한다.
6. Save Changes를 누른다.
7. 성공 후 Post Detail로 이동하는지 확인한다.
8. Post Detail에서 수정 결과와 updated_at 표시를 확인한다.

수정 실패 시 확인할 것:

- form 값이 유지된다.
- backend error가 표시된다.
- 403이면 ownership error가 표시된다.
- 404이면 post/account not found error가 표시된다.

### Post 삭제

1. 본인 post의 Post Detail로 이동한다.
2. Delete button이 표시되는지 확인한다.
3. Delete confirm을 승인한다.
4. 삭제 후 Account Profile 또는 안전한 화면으로 이동하는지 확인한다.
5. Home Feed/Profile/Post Detail에서 삭제된 post가 더 이상 보이지 않는지 확인한다.

## 6. Ownership 테스트

UI 확인:

- 본인이 작성한 post에는 Edit/Delete button이 표시된다.
- 다른 account가 작성한 post에는 Edit/Delete button이 없거나 disabled 상태이다.

API 직접 호출 확인:

```powershell
curl -X PATCH http://127.0.0.1:8000/api/posts/OTHER_POST_ID `
  -H "Content-Type: application/json" `
  -d "{\"user_id\":1,\"title\":\"Should fail\"}"
```

```powershell
curl -X DELETE "http://127.0.0.1:8000/api/posts/OTHER_POST_ID?user_id=1"
```

확인할 것:

- active API user의 1:1 Account와 post.account_id가 다르면 403이 반환된다.
- 이것은 MVP용 ownership check이다.
- 정식 인증, JWT, session, OAuth, permission system은 아니다.

## 7. Validation / Error 테스트

Post create/update form에서 확인:

- 빈 title이면 error 표시
- text가 비어 있어도 submit 가능
- 너무 긴 title/text는 입력 제한 또는 backend validation error로 처리
- tags 입력에서 빈 tag 제거
- asset url이 빈 문자열이면 Add asset 불가
- asset draft를 입력하고 Add asset을 누르지 않은 채 submit하면 error 표시
- metadata key가 빈 문자열이면 Add metadata 불가
- metadata draft를 입력하고 Add metadata를 누르지 않은 채 submit하면 error 표시
- metadata duplicate key는 error 또는 replacement 정책대로 처리
- submit 중 button disabled
- 중복 submit 방지

Backend/API error 확인:

- backend 꺼진 상태에서 작성 시 network error 표시
- backend 꺼진 상태에서 수정 시 network error 표시
- backend 꺼진 상태에서 삭제 시 network error 표시
- user_id가 없거나 잘못되면 error 표시
- user의 1:1 Account가 없으면 error 표시
- post가 없으면 404 표시
- 이미 삭제된 post 접근 시 404 표시
- 남의 post edit route 직접 접근 시 edit unavailable 또는 ownership error 표시

Asset preview error 확인:

- image URL이 깨져도 앱이 깨지지 않고 fallback/placeholder가 표시된다.
- unknown asset type이 와도 fallback card가 표시된다.
- assets가 빈 배열이면 Post Detail assets section이 숨겨진다.
- table/file/link placeholder가 정상 표시된다.

## 8. Mock Mode 회귀 테스트

frontend `.env` 또는 실행 환경을 mock mode로 설정한다.

```text
VITE_DATA_SOURCE=mock
```

frontend 재시작:

```powershell
npm run dev
```

확인할 것:

- backend가 꺼져 있어도 mock mode가 정상 동작한다.
- 기존 local user entry가 표시된다.
- mock local registration이 동작한다.
- mock Home Feed가 표시된다.
- mock follow/unfollow가 동작한다.
- mock Account Profile이 표시된다.
- mock Post Detail이 표시된다.
- mock mode에서 post asset/edit/update는 MVP9 범위가 아니다.
- mock mode에서 post create/edit/delete가 실수로 API write를 호출하지 않는다.

## 9. Build / Git 확인

frontend build:

```powershell
npm run build
```

작업 상태 확인:

```powershell
git status
git diff
```

확인할 것:

- `.env`가 Git에 잡히지 않는다.
- 실제 DB dump가 없다.
- `node_modules`가 없다.
- 기존 mock JSON이 삭제되지 않았다.
- MVP9 migration 파일은 포함되어 있다.
- source code, seed data, mock data, package file이 의도치 않게 삭제되지 않았다.
- 과거 MVP 문서 삭제가 의도한 범위인지 확인한다.
- README / PROJECT_GOALS / AGENTS에 최신 MVP9 요약이 남아 있다.

## 10. 자주 발생하는 문제

### Post 작성 후 Home Feed에 안 보임

active user가 자기 Account를 follow하지 않거나 feed 정책상 표시 대상이 아닐 수 있다.

확인 순서:

1. `/api/posts`에서 post가 생성되었는지 확인
2. Account Profile에서 확인
3. Post Detail URL로 직접 확인
4. `/api/feed?user_id=...` 응답 확인

### Image asset이 안 보임

확인할 것:

- URL 또는 local path가 실제로 접근 가능한지 확인
- `/assets/...` 경로는 frontend `public` asset 위치와 맞아야 함
- backend `/uploads/...` 경로와 frontend `/assets/...` 경로를 혼동하지 말 것
- 깨진 image URL은 placeholder fallback이 정상 동작

### Table/file/plot이 실제 preview되지 않음

MVP9에서는 placeholder 또는 link card가 정상 동작이다.

MVP9 범위 밖:

- CSV parsing
- table data parsing
- chart rendering library
- advanced asset viewer

### 수정 후 값이 반영되지 않음

확인할 것:

- PATCH response의 title/text/tags/metadata_json/assets 확인
- updated_at이 갱신되었는지 확인
- Post Detail로 navigation 되었는지 확인
- Home Feed/Profile 화면이 refetch 되었는지 확인
- browser cache 또는 이전 화면 state인지 확인

### 403 ownership error

확인할 것:

- active API user id 확인
- active API user의 1:1 Account 확인
- target post의 account_id 확인
- active user의 Account와 post.account_id가 일치해야 edit/delete 가능

### Backend off / network error

확인할 것:

- FastAPI server 실행 여부
- `VITE_API_BASE_URL` 값
- Vite dev server 재시작 여부
- CORS 설정
- API mode와 mock mode 혼동 여부

### Vite env 변경 후 반영 안 됨

`.env` 또는 `VITE_DATA_SOURCE` 값을 바꾼 뒤에는 Vite dev server를 재시작한다.

### CORS error

확인할 것:

- backend CORS 설정
- frontend dev server origin
- `VITE_API_BASE_URL`

### Mock/API mode 혼동

확인할 것:

- `VITE_DATA_SOURCE=api`이면 backend가 필요하다.
- `VITE_DATA_SOURCE=mock`이면 backend 없이 동작해야 한다.
- mock mode에서는 MVP9 API write flow가 동작하지 않아도 정상이다.

### 과거 MVP 문서 삭제 후 요약 확인

과거 MVP별 테스트 문서를 삭제한 뒤에도 다음 문서에는 최신 요약이 남아 있어야 한다.

- `README.md`
- `PROJECT_GOALS.md`
- `AGENTS.md`

## 11. MVP9 성공 기준

MVP9는 다음 조건을 만족하면 성공으로 본다.

- API mode에서 asset/tags/metadata 포함 post 작성 가능
- 작성 post가 backend PostgreSQL DB에 저장됨
- 작성 post가 Home Feed, Account Profile, Post Detail 중 적절한 화면에서 확인됨
- image asset preview 가능
- table/file/plot/link asset placeholder 또는 link card 표시
- 본인 post 수정 가능
- 남의 post 수정 불가
- 본인 post 삭제 가능
- asset 있는 post 삭제 가능
- 남의 post 삭제 불가
- 수정/삭제 후 화면이 갱신되거나 안전한 화면으로 이동
- mock mode 기존 기능 유지
- `npm run build` 통과
