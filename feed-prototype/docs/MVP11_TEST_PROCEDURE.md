# MVP11 실행 및 테스트 절차

MVP11은 **Metadata / Tag / Asset Filter & Search** 단계입니다. 이 문서는 backend filter API, API mode Home Feed, Browse Posts, MVP10 import data, mock mode 회귀 테스트를 확인하기 위한 실행 절차와 체크리스트입니다.

## 1. MVP11 목표 요약

MVP11의 목표:

- post 목록과 feed를 `keyword`, `tag`, metadata key-value, asset type, account 기준으로 필터링합니다.
- API mode Home Feed 상단에 filter/search panel을 제공합니다.
- 전체 post 탐색을 위해 Browse Posts page(`/posts`)를 제공합니다.
- API mode 중심으로 동작합니다.
- mock mode의 기존 local/static 동작을 유지합니다.
- domain-specific field를 core model, route, shared component, UI control에 하드코딩하지 않습니다.
- metadata는 generic key-value filter로 처리합니다.

예를 들어 사용자는 `metadata_key=severity&metadata_value=high`처럼 검색할 수 있습니다. 그러나 `severity`, `recipe`, `chamber`, `equipment` 같은 이름은 core architecture가 아니라 `metadata_json` 안의 data value입니다.

MVP11은 Elasticsearch, PostgreSQL full-text search 고도화, semantic search, vector search, saved search, advanced query builder, dashboard, analytics, pagination 고도화를 구현하지 않습니다.

## 2. 전제 조건

필요한 상태:

- PostgreSQL이 실행 중이어야 합니다.
- `feed-prototype/backend/.env` 또는 `DATABASE_URL`이 준비되어 있어야 합니다.
- Alembic migration이 적용되어 있어야 합니다.
- seed data를 삽입할 수 있어야 합니다.
- MVP10 sample import를 실행할 수 있어야 합니다.
- backend FastAPI server를 실행할 수 있어야 합니다.
- frontend Vite app을 실행할 수 있어야 합니다.
- MVP10까지의 기능이 동작하는 상태여야 합니다.

예시 `.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

주의:

- `.env`는 Git에 포함하지 않습니다.
- 실제 DB dump나 local 운영 data는 Git에 포함하지 않습니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다.

## 3. Backend 실행 절차

Windows + conda 기준 예시입니다.

```powershell
cd C:\...\feed-prototype
conda activate feed-backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.services.seed
python -m app.services.import_external_posts --input ../data/external_posts/examples/feed_import_sample.json
python -m uvicorn app.main:app --reload
```

확인:

- `http://127.0.0.1:8000/health`가 정상 응답해야 합니다.
- `http://127.0.0.1:8000/api/posts`가 post list를 반환해야 합니다.
- `http://127.0.0.1:8000/api/feed?user_id=1`은 해당 user가 존재할 때 feed를 반환해야 합니다.

## 4. Backend Filter API 테스트

아래 명령은 backend server가 `http://127.0.0.1:8000`에서 실행 중이라고 가정합니다.

keyword:

```powershell
curl "http://127.0.0.1:8000/api/posts?keyword=temperature"
```

tag:

```powershell
curl "http://127.0.0.1:8000/api/posts?tag=daily-report"
```

metadata key only:

```powershell
curl "http://127.0.0.1:8000/api/posts?metadata_key=source"
```

metadata key/value:

```powershell
curl "http://127.0.0.1:8000/api/posts?metadata_key=source&metadata_value=analysis-program"
```

asset type:

```powershell
curl "http://127.0.0.1:8000/api/posts?asset_type=image"
```

account handle:

```powershell
curl "http://127.0.0.1:8000/api/posts?account_handle=temp_report_bot"
```

my posts only:

```powershell
curl "http://127.0.0.1:8000/api/posts?user_id=1&my_posts_only=true"
```

feed filter:

```powershell
curl "http://127.0.0.1:8000/api/feed?user_id=1&tag=daily-report&asset_type=image"
```

기대 동작:

- response shape는 기존 API와 같아야 합니다.
- posts API는 `assets`, `tags`, `metadata_json`, `created_at`, `updated_at`, `imported_at`을 유지해야 합니다.
- feed API는 `user`, `items[].post`, `items[].account`, `items[].assets` 구조를 유지해야 합니다.

## 5. Filter 조합 테스트

다음 조합을 확인합니다.

- keyword only
- tag only
- metadata_key only
- metadata_key + metadata_value
- asset_type only
- account_handle only
- my_posts_only only
- keyword + tag
- tag + asset_type
- metadata + asset_type
- feed + tag
- feed + metadata
- feed + asset_type

확인 기준:

- 여러 filter를 함께 쓰면 모든 조건을 만족하는 post만 반환되어야 합니다.
- 빈 `keyword` 또는 빈 `tag`는 무시되어야 합니다.
- 존재하지 않는 `account_handle`은 빈 결과를 반환해야 합니다.
- `metadata_json`이 `null`인 post가 있어도 crash가 나면 안 됩니다.
- `tags` 또는 `assets`가 비어 있어도 crash가 나면 안 됩니다.

## 6. Frontend API Mode 테스트

PowerShell 예시:

```powershell
cd C:\...\feed-prototype
$env:VITE_DATA_SOURCE="api"
$env:VITE_API_BASE_URL="http://127.0.0.1:8000"
npm run dev
```

브라우저에서 Vite URL로 접속합니다. 보통 `http://localhost:5173`입니다.

확인 절차:

1. API user entry에서 기존 user를 선택하거나 신규 등록합니다.
2. Home Feed에 진입합니다.
3. filter/search panel이 표시되는지 확인합니다.
4. Keyword에 `temperature`를 입력하고 Apply를 누릅니다.
5. Tag에 `daily-report`를 입력하고 Apply를 누릅니다.
6. Metadata key에 `source`만 입력하고 Apply를 누릅니다.
7. Metadata key에 `source`, Metadata value에 `analysis-program`을 입력하고 Apply를 누릅니다.
8. Asset type에서 `image`를 선택하고 Apply를 누릅니다.
9. Account handle에 `temp_report_bot`을 입력하고 Apply를 누릅니다.
10. My posts only를 체크하고 Apply를 누릅니다.
11. Reset을 눌러 전체 feed가 복원되는지 확인합니다.
12. 결과가 없는 filter를 입력했을 때 empty state가 표시되는지 확인합니다.
13. backend를 끄거나 잘못된 API URL을 설정했을 때 error가 표시되는지 확인합니다.

확인할 UI 상태:

- Apply/Reset button은 loading 중 disabled되어야 합니다.
- metadata value만 입력하고 key를 비우면 inline error가 표시되어야 합니다.
- 일반 empty feed, filter 결과 없음, backend error 문구가 구분되어야 합니다.

## 7. Browse Posts Page 테스트

MVP11에서는 `/posts` Browse Posts page가 구현되어 있습니다.

확인 절차:

1. `/posts`로 이동합니다.
2. 전체 API post가 표시되는지 확인합니다.
3. Home Feed와 달리 follow 관계와 무관하게 전체 post를 탐색하는지 확인합니다.
4. filter/search panel이 표시되는지 확인합니다.
5. keyword, tag, metadata key/value, asset type, account handle, my posts only가 동작하는지 확인합니다.
6. MVP10 imported post가 검색되는지 확인합니다.

Home Feed와 Browse Posts의 차이:

- Home Feed는 active user의 follow 기반 feed입니다.
- Browse Posts는 전체 post browse page입니다.
- MVP11에는 formal permission/public scope 개념이 없으므로 Browse Posts는 전체 API post를 보여줍니다.

Account Profile filter는 MVP11 범위에 포함하지 않습니다. 필요하면 후속 polish 또는 다음 MVP에서 추가합니다.

## 8. MVP10 Import 데이터 기반 테스트

MVP10 sample data를 import한 뒤 아래 값을 검색합니다.

Sample file:

```text
feed-prototype/data/external_posts/examples/feed_import_sample.json
```

확인할 값:

```text
tag = daily-report
metadata_key = source
metadata_value = analysis-program
asset_type = image
account_handle = temp_report_bot
```

예시 확인:

```powershell
curl "http://127.0.0.1:8000/api/posts?tag=daily-report"
curl "http://127.0.0.1:8000/api/posts?metadata_key=source&metadata_value=analysis-program"
curl "http://127.0.0.1:8000/api/posts?asset_type=image"
curl "http://127.0.0.1:8000/api/posts?account_handle=temp_report_bot"
```

주의:

- metadata key 이름은 generic하게 입력합니다.
- `severity`, `recipe`, `chamber` 같은 key도 metadata key로 검색할 수 있습니다.
- 그러나 UI/backend에 해당 key를 domain-specific field로 하드코딩하지 않습니다.

## 9. Validation/Error 테스트

invalid asset_type:

```powershell
curl "http://127.0.0.1:8000/api/posts?asset_type=video"
```

기대: `400`

metadata value만 있고 metadata key 없음:

```powershell
curl "http://127.0.0.1:8000/api/posts?metadata_value=high"
```

기대: `400`

my_posts_only=true인데 user_id 없음:

```powershell
curl "http://127.0.0.1:8000/api/posts?my_posts_only=true"
```

기대: `400`

존재하지 않는 user_id:

```powershell
curl "http://127.0.0.1:8000/api/posts?user_id=missing-user&my_posts_only=true"
```

기대: `404`

존재하지 않는 account_handle:

```powershell
curl "http://127.0.0.1:8000/api/posts?account_handle=missing_account"
```

기대: 빈 배열

backend 꺼진 상태:

- frontend API mode에서 Home Feed 또는 Browse Posts를 엽니다.
- API 연결 error가 표시되어야 합니다.

빈 filter apply:

- 모든 filter input을 비우고 Apply합니다.
- 전체 목록 또는 기존 feed 범위가 표시되어야 합니다.

reset:

- filter 적용 후 Reset합니다.
- 전체 목록 또는 기존 feed 범위가 복원되어야 합니다.

filter 결과 없음:

- 존재하지 않는 keyword/tag/account handle을 입력합니다.
- filter 결과 없음 empty state가 표시되어야 합니다.

## 10. Mock Mode 회귀 테스트

PowerShell 예시:

```powershell
cd C:\...\feed-prototype
$env:VITE_DATA_SOURCE="mock"
npm run dev
```

Vite env를 변경한 뒤에는 dev server를 재시작해야 합니다.

확인 절차:

1. backend를 끈 상태에서도 frontend가 동작하는지 확인합니다.
2. 기존 local user entry가 동작하는지 확인합니다.
3. local registration이 동작하는지 확인합니다.
4. mock Home Feed가 표시되는지 확인합니다.
5. mock follow/unfollow가 동작하는지 확인합니다.
6. mock Account Profile이 표시되는지 확인합니다.
7. mock Post Detail이 표시되는지 확인합니다.
8. mock mode에서 API filter 요청이 발생하지 않는지 browser Network tab으로 확인합니다.
9. filter/search는 API mode 중심 기능임을 확인합니다.

MVP11 mock mode 정책:

- Home Feed의 API filter panel은 mock mode에서 표시하지 않습니다.
- Browse Posts는 mock posts를 표시하지만 filter/search panel은 API mode에서만 표시합니다.
- mock localStorage behavior는 유지합니다.

## 11. Build/Git 확인

build 확인:

```powershell
cd C:\...\feed-prototype
npm run build
```

API mode build 확인:

```powershell
$env:VITE_DATA_SOURCE="api"
npm run build
```

mock mode build 확인:

```powershell
$env:VITE_DATA_SOURCE="mock"
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
- `node_modules`가 없어야 합니다.
- 기존 mock JSON이 삭제되지 않아야 합니다.
- MVP10 import guide가 깨지지 않았는지 확인합니다.
- MVP10 sample data가 유지되어야 합니다.

## 12. 자주 발생하는 문제

Home Feed에 import post가 안 보임:

- Home Feed는 follow 기반입니다.
- active user가 imported account를 follow하지 않으면 feed에 보이지 않을 수 있습니다.
- Browse Posts(`/posts`) 또는 Account Profile에서 먼저 확인합니다.
- 필요하면 active user가 imported account를 follow한 뒤 Home Feed를 새로고침합니다.

filter 결과가 없음:

- tag 철자를 확인합니다.
- metadata key/value 철자를 확인합니다.
- account handle이 실제 handle과 같은지 확인합니다.
- metadata value는 문자열 변환 후 case-insensitive partial match입니다.
- metadata key는 정확한 key 이름을 사용해야 합니다.

metadata value만 넣고 key를 안 넣음:

- MVP11에서는 inline error 또는 backend `400`이 정상입니다.
- metadata value filter를 쓰려면 metadata key도 입력합니다.

asset_type invalid:

- 허용 값은 `image`, `plot`, `table`, `file`, `link`입니다.
- 다른 값은 backend `400`이 정상입니다.

account_handle이 실제 handle과 다름:

- `display_name`이 아니라 `handle`을 입력해야 합니다.
- 예: `temp_report_bot`

my posts only가 feed 결과를 더 좁힘:

- `my_posts_only=true`는 active API user의 1:1 Account post만 반환합니다.
- Home Feed에서는 follow 기반 후보에서 다시 own post만 남기므로 결과가 매우 적거나 없을 수 있습니다.

backend는 결과가 있는데 frontend에 안 보임:

- query string 생성이 맞는지 확인합니다.
- browser Network tab에서 `/api/feed` 또는 `/api/posts` 요청 URL을 확인합니다.
- API base URL이 `VITE_API_BASE_URL`과 일치하는지 확인합니다.
- response는 오지만 카드가 안 보이면 account 정보가 함께 로드되는지 확인합니다.

mock/API mode 혼동:

- `VITE_DATA_SOURCE` 값을 확인합니다.
- env 변경 후 Vite dev server를 재시작합니다.
- mock mode에서는 backend filter API를 호출하지 않습니다.

## 13. MVP11 성공 기준

MVP11 완료 판단 기준:

- API mode에서 keyword search가 가능합니다.
- tag filter가 가능합니다.
- metadata key filter가 가능합니다.
- metadata key-value filter가 가능합니다.
- asset type filter가 가능합니다.
- account handle filter가 가능합니다.
- my posts only filter가 가능합니다.
- Home Feed filter panel이 동작합니다.
- Browse Posts page에서 전체 post browse와 filter가 동작합니다.
- Apply/Reset이 동작합니다.
- filter 결과 없음 empty state가 표시됩니다.
- backend error state가 표시됩니다.
- MVP10 imported post를 검색할 수 있습니다.
- 기존 post create/edit/delete가 유지됩니다.
- 기존 external import flow가 유지됩니다.
- mock mode 기존 기능이 유지됩니다.
- `npm run build`가 통과합니다.

