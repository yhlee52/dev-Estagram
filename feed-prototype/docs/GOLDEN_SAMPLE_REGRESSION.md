# GOLDEN_SAMPLE_REGRESSION.md

v0.1.0(Read at Scale)에서 추가된 **golden sample 회귀 테스트** 안내입니다.

## 목적

외부 생성 프로그램들이 동결(freeze)된 external post package JSON format으로
데이터를 계속 생산합니다. import 코드나 format이 의도치 않게 드리프트하면 기존에
생성된 package를 다시 import할 수 없게 됩니다.

`data/external_posts/examples/` 아래의 실제 생성 형태 package들을 **golden
sample**로 repo에 박제하고, 릴리즈 전 이들의 import `--dry-run` 통과를
확인합니다.

## 박제된 golden sample

`data/external_posts/examples/` 아래 모든 package(각 `feed_posts.json`)와
top-level `feed_import_sample.json`을 golden sample로 취급합니다. 대표 baseline:

- `batch_2026-06-09_090000/feed_posts.json` — 실제 batch 생성 형태.
- `general_social_sample/feed_posts.json` — 일반 소셜 feed 형태.
- `analysis_report_sample/feed_posts.json` — 분석 리포트(설비 시나리오) 형태.
- `batch_mvp12_asset_viewer/feed_posts.json` — `sort_order` 포함 asset 형태.
- `broken_asset_sample/feed_posts.json` — 깨진 asset URL fallback 형태.

새 format 사례가 생기면 example로 추가해 자동으로 회귀 대상에 포함시킵니다.

## 실행

`feed-prototype/backend`에서, `DATABASE_URL`이 dev/test DB를 가리키는 상태로
실행합니다. dry-run은 DB에 쓰지 않고 롤백합니다.

```bash
cd feed-prototype/backend
python -m scripts.check_golden_samples
```

- 모든 golden sample의 dry-run이 통과하면 exit code 0.
- 하나라도 실패하면 실패 목록과 함께 non-zero exit.

## 릴리즈 체크 포함

import service 또는 external package format에 영향을 주는 변경 후, 그리고 릴리즈
직전에 위 명령을 실행해 통과를 확인합니다. (AGENTS.md의 External Package Format
Freeze 규칙과 동일한 안전망입니다.)
