# MVP12 실행 및 테스트 절차

MVP12 이름은 **Asset Viewer Enhancement**입니다.

이 문서는 MVP12 asset viewer를 실행하고, loading/error/fallback,
accessibility, API mode 회귀, mock mode 회귀를 확인하기 위한 절차입니다.

## 1. MVP12 목표 요약

MVP12의 목표:

- image/plot asset viewer를 고도화합니다.
- `image`와 `plot`을 동일한 visual asset으로 처리합니다.
- image/plot asset을 thumbnail로 표시합니다.
- thumbnail 클릭 시 lightbox modal을 엽니다.
- 한 post에 여러 visual asset이 있으면 Prev/Next로 이동합니다.
- `asset.sort_order` 기반 표시 순서를 사용합니다.
- table asset은 CSV 앞 몇 행만 preview합니다.
- file asset은 card와 open original action으로 표시합니다.
- link asset은 자연스러운 hyperlink/card로 표시합니다.
- broken URL은 앱 crash 대신 fallback UI로 처리합니다.

MVP12에서 `plot`은 interactive chart가 아니라 PNG/SVG 같은 저장된 이미지
파일입니다. Plotly/Vega rendering은 MVP12 범위가 아닙니다.

## 2. 전제 조건

필요한 상태:

- PostgreSQL이 실행 중이어야 합니다.
- `feed-prototype/backend/.env` 또는 `DATABASE_URL`이 준비되어야 합니다.
- Alembic migration이 적용되어야 합니다.
- MVP10 external import service가 동작해야 합니다.
- MVP11 filter/search가 동작해야 합니다.
- backend 실행이 가능해야 합니다.
- frontend 실행이 가능해야 합니다.
- MVP11까지의 주요 기능이 동작하는 상태여야 합니다.

`.env` 예:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/feed_prototype
```

`.env` 파일은 Git에 올리지 않습니다.

## 3. Backend 실행 절차

Windows + conda 기준 예시:

```powershell
cd C:\...\feed-prototype
conda activate feed-backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.services.seed
```

backend 실행:

```powershell
python -m uvicorn app.main:app --reload
```

기본 URL:

```text
http://127.0.0.1:8000
```

간단 확인:

```powershell
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/posts
```

## 4. MVP12 Sample Package Import

MVP12 sample package:

```text
feed-prototype/data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

CSV preview 성공 테스트용 파일:

```text
feed-prototype/data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
```

CSV를 browser-accessible 위치로 복사합니다.

```text
from: data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
to:   public/assets/generated/sample_summary.csv
url:  /assets/generated/sample_summary.csv
```

import dry-run:

```powershell
cd C:\...\feed-prototype\backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
```

actual import:

```powershell
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

backend 실행:

```powershell
python -m uvicorn app.main:app --reload
```

확인할 것:

- import가 성공해야 합니다.
- `sort_order`가 포함된 asset이 저장되어야 합니다.
- 같은 JSON을 다시 import해도 post가 중복 생성되지 않아야 합니다.
- assets는 post 단위 replacement 정책에 따라 최신 JSON 내용으로 교체되어야 합니다.

## 5. Frontend 실행

API mode로 실행합니다.

```powershell
cd C:\...\feed-prototype
$env:VITE_DATA_SOURCE="api"
npm run dev
```

Vite env를 바꾼 뒤에는 frontend dev server를 재시작합니다.

## 6. Image/Plot Viewer 테스트

확인할 것:

- image asset thumbnail이 표시됩니다.
- plot asset thumbnail이 표시됩니다.
- plot도 image처럼 처리됩니다.
- thumbnail 클릭 시 lightbox가 열립니다.
- lightbox에서 큰 이미지가 표시됩니다.
- title이 표시됩니다.
- description이 표시됩니다.
- Open original이 새 탭으로 열립니다.
- Close button이 동작합니다.
- ESC로 lightbox가 닫힙니다.
- backdrop click으로 lightbox가 닫힙니다.

MVP12에서는 plot을 interactive하게 렌더링하지 않습니다. plot URL이 PNG/SVG
같은 이미지 파일이면 image와 같은 viewer path를 사용합니다.

## 7. Multi Image/Plot 테스트

sample post:

```text
post-mvp12-gallery-001
```

확인할 것:

- 한 post에 image/plot asset 여러 개가 표시됩니다.
- visual asset은 `sort_order` 순서대로 표시됩니다.
- lightbox에서 `1 / N` index가 표시됩니다.
- Prev가 동작합니다.
- Next가 동작합니다.
- 첫 item에서는 Prev가 disabled 처리됩니다.
- 마지막 item에서는 Next가 disabled 처리됩니다.
- PostCard에서는 compact preview가 표시됩니다.
- PostDetail에서는 full gallery가 표시됩니다.

sort_order 테스트 포인트:

```text
mvp12_plot_02.png   sort_order 1
mvp12_image_01.png  sort_order 2
mvp12_plot_01.png   sort_order 3
mvp12_image_02.png  sort_order 4
```

파일명 순서가 아니라 `sort_order` 순서로 보이는지 확인합니다.

## 8. Table CSV Preview 테스트

sample post:

```text
post-mvp12-table-001
```

확인할 것:

- table asset card가 표시됩니다.
- CSV 앞 몇 행만 preview됩니다.
- 첫 행이 header로 표시됩니다.
- column이 많을 때 가로 스크롤이 가능합니다.
- Open original이 새 탭으로 열립니다.
- CSV fetch 실패 시 fallback card가 표시됩니다.

sample CSV:

```text
channel,score,rank,method
TEMP_01,0.98,1,Tail
PRESS_02,0.91,2,MAD
FLOW_03,0.87,3,Trend
```

정책:

- UTF-8 CSV 기준입니다.
- CSV 전체 viewer가 아닙니다.
- 대용량 CSV 처리를 하지 않습니다.
- encoding 자동 감지를 하지 않습니다.
- Excel parser를 만들지 않습니다.

## 9. File/Link 테스트

sample post:

```text
post-mvp12-file-link-001
```

확인할 것:

- file asset card가 표시됩니다.
- file card에 type badge, title, description, URL/path가 표시됩니다.
- PDF/HTML file URL은 Open original로 새 탭에서 열립니다.
- link asset이 자연스러운 hyperlink/card로 표시됩니다.
- Open link가 새 탭으로 열립니다.
- URL 없는 asset이 있어도 crash 없이 fallback text가 표시됩니다.

MVP12에서는 PDF inline preview와 HTML iframe preview를 구현하지 않습니다.

## 10. Broken Asset Fallback 테스트

sample post:

```text
post-mvp12-broken-assets-001
```

확인할 것:

- 깨진 image URL에서 앱이 crash되지 않습니다.
- 깨진 image thumbnail은 fallback box로 표시됩니다.
- 깨진 image를 lightbox로 열어도 fallback message가 표시됩니다.
- 깨진 CSV URL에서 fallback card가 표시됩니다.
- unknown asset type이 있다면 generic fallback card가 표시됩니다.

의도적으로 깨진 URL:

```text
/assets/generated/missing_mvp12_image.png
/assets/generated/missing_mvp12_table.csv
```

## 11. PostCard / PostDetail 표시 차이

PostCard 확인:

- compact preview가 표시됩니다.
- 대표 visual asset이 표시됩니다.
- visual asset count가 표시됩니다.
- 너무 긴 asset list가 펼쳐지지 않습니다.
- non-visual asset은 compact하게 일부만 표시됩니다.

PostDetail 확인:

- full visual gallery가 표시됩니다.
- table preview가 표시됩니다.
- file/link card가 표시됩니다.
- 모든 asset을 확인할 수 있습니다.

## 12. MVP11 Filter/Search 회귀 테스트

API mode에서 확인합니다.

asset type filter:

```text
asset_type=image
asset_type=plot
asset_type=table
```

tag filter 예:

```text
tag=mvp12
tag=gallery
tag=csv
```

metadata filter 예:

```text
metadata_key=source&metadata_value=mvp12-sample-package
metadata_key=contentType&metadata_value=visual-gallery
```

확인할 것:

- Home Feed filter/search가 유지됩니다.
- Browse Posts filter/search가 유지됩니다.
- `asset_type=image` 검색이 동작합니다.
- `asset_type=plot` 검색이 동작합니다.
- `asset_type=table` 검색이 동작합니다.
- tag 검색이 동작합니다.
- metadata 검색이 generic key-value 방식으로 동작합니다.
- filter 결과의 PostCard/PostDetail asset viewer가 깨지지 않습니다.

## 13. Mock Mode 회귀 테스트

mock mode로 frontend를 재시작합니다.

```powershell
cd C:\...\feed-prototype
$env:VITE_DATA_SOURCE="mock"
npm run dev
```

확인할 것:

- backend 없이 mock mode가 동작합니다.
- 기존 local user entry가 동작합니다.
- mock Home Feed가 표시됩니다.
- mock follow/unfollow가 localStorage 기반으로 동작합니다.
- mock Account Profile이 표시됩니다.
- mock Post Detail이 표시됩니다.
- assets가 없는 mock post도 crash되지 않습니다.
- `sort_order`가 없는 mock asset도 fallback 정렬로 표시됩니다.

## 14. Build/Git 확인

build:

```powershell
cd C:\...\feed-prototype
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
- `node_modules`가 Git에 잡히지 않아야 합니다.
- 큰 binary sample file이 없어야 합니다.
- sample CSV 정도는 포함 가능합니다.
- migration 파일은 포함되어야 합니다.
- `data/external_posts/incoming`의 실제 운영 데이터는 Git에 넣지 않는 것을 권장합니다.

범위 위반 scan 예:

```powershell
rg -n "Plotly|Vega|iframe|S3|file upload|asset upload|touch swipe|zoom/pan|asset reorder|dashboard" src backend/app
```

위 검색에서 MVP12 범위를 넓히는 신규 구현이 나오면 안 됩니다.

## 15. 자주 발생하는 문제

image가 안 보임:

- `asset.url`이 브라우저에서 접근 가능한지 확인합니다.
- `/assets/...` 경로가 `public/assets/...` 위치와 맞는지 확인합니다.
- API 응답에 asset URL이 포함되어 있는지 확인합니다.

plot이 interactive하게 안 보임:

- MVP12에서는 정상입니다.
- plot은 PNG/SVG 이미지 파일로 표시합니다.
- Plotly/Vega rendering은 후속 MVP 범위입니다.

여러 이미지 순서가 이상함:

- `asset.sort_order` 값을 확인합니다.
- `sort_order`가 없는 asset은 fallback 정렬을 사용합니다.
- 같은 `sort_order`가 여러 개이면 created_at/id/original order가 보조 정렬로 쓰일 수 있습니다.

table preview가 안 보임:

- CSV URL 접근 가능 여부를 확인합니다.
- CSV 파일이 UTF-8인지 확인합니다.
- 첫 행 header와 최소 한 줄 이상의 data row가 있는지 확인합니다.
- 실패 시 fallback card가 표시되는 것은 정상입니다.

PDF/HTML이 preview되지 않음:

- MVP12에서는 inline preview가 없습니다.
- Open original로 여는 것이 정상입니다.
- HTML iframe preview와 PDF inline viewer는 범위 밖입니다.

Home Feed에 import post가 안 보임:

- follow 정책을 확인합니다.
- imported account는 자동 follow되지 않습니다.
- Post Detail 또는 Browse Posts에서 먼저 확인합니다.
- 필요한 경우 active API user가 imported account를 follow한 뒤 Home Feed를 확인합니다.

mock/API mode 혼동:

- `VITE_DATA_SOURCE` 값을 확인합니다.
- Vite env 변경 후 frontend dev server를 재시작합니다.
- API mode는 backend가 필요하고, mock mode는 backend 없이 동작해야 합니다.

## 16. MVP12 성공 기준

MVP12 완료 판단 기준:

- image asset thumbnail 표시가 가능합니다.
- plot asset도 image처럼 표시됩니다.
- image/plot lightbox가 가능합니다.
- 여러 image/plot을 Prev/Next로 이동할 수 있습니다.
- `sort_order` 순서가 반영됩니다.
- table CSV 일부 preview가 가능합니다.
- table preview 실패 fallback이 가능합니다.
- file card와 open original이 가능합니다.
- link card와 open link가 가능합니다.
- broken asset URL에도 앱이 crash되지 않습니다.
- MVP10 import post asset 표시가 가능합니다.
- MVP11 filter/search가 유지됩니다.
- mock mode 기존 기능이 유지됩니다.
- `npm run build`가 통과합니다.
