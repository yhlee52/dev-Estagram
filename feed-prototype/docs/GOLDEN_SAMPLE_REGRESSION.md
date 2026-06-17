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

### HTTP import 경로 (v0.3.0)

v0.3.0의 `POST /api/imports`도 같은 golden sample을 HTTP dry-run으로 통과하는지
확인합니다. CLI(`run_import`)와 HTTP route가 동일한 `import_payload`를 쓰므로,
이 스크립트는 HTTP 레이어(라우팅·body 검증·트랜잭션·에러 매핑)의 드리프트를
잡습니다. schema 위반 422 / 중복 external_id 400 동작도 함께 확인합니다.

```bash
cd feed-prototype/backend
python -m scripts.check_http_import
```

FastAPI TestClient로 in-process 실행하며 dry-run/거부 요청만 보내므로 DB에
쓰지 않습니다. (`DATABASE_URL`은 동일하게 필요합니다.)

### Import Batch 이력 (v0.3.1)

v0.3.1은 import 사건을 `import_batch` 테이블에 기록합니다. **dry-run은 batch를
기록하지 않으므로 위 두 dry-run 스크립트의 "DB 미기록" 보장과 통과 결과는
동일합니다**(사용 sample도 그대로). batch 기록/조회의 실제 동작은 별도 체크가
DB에 쓰고 스스로 정리합니다.

```bash
cd feed-prototype/backend
python -m scripts.check_batch_history
```

이 스크립트는 실제 import(쓰기)를 수행한 뒤 생성한 행을 삭제하므로 dev/test
`DATABASE_URL`에서 실행합니다. (성공/재import/실패 batch 기록, 목록·상세, 404,
dry-run 불변식을 확인.)

### 디렉터리 일괄 처리 / 자동 이동 (v0.3.2)

v0.3.2의 `process_incoming`(incoming→archive/failed 자동 이동 + 폴링 watch)는
임시 external_posts 트리와 실제 DB를 사용해 end-to-end로 확인합니다. 성공→archive/
이동, 실패→failed/ 이동 + failed batch 기록, dry-run 무변경(DB·파일), 이름 충돌
시 비파괴 이동, 비-package 건너뜀을 검증한 뒤 생성한 행을 정리합니다. 기존 dry-run
스크립트는 `incoming/`을 건드리지 않으므로 영향이 없습니다.

```bash
cd feed-prototype/backend
python -m scripts.check_process_incoming
```

실제 import(쓰기)를 수행하므로 dev/test `DATABASE_URL`에서 실행합니다.

### 인증 & identity / profile (v0.6.x)

v0.6.x(인증 & 멀티유저)는 **external post package JSON format을 바꾸지 않습니다.**
따라서 위 golden sample dry-run의 통과 결과는 v0.6.x에서도 동일합니다. 다만 import가
account마다 paired import User를 만들 때 v0.6.0부터 password credential도 함께
provisioning하므로(format 무관, package에는 credential을 싣지 않음), import가 닿는
identity 규칙을 별도 회귀로 확인합니다.

```bash
cd feed-prototype/backend
python -m scripts.check_account_identity   # User:Account 1:1 + 소유권 (v0.6.1)
python -m scripts.check_account_profile    # profile self-service + 재import 보존 (v0.6.2)
```

- `check_account_identity`: import가 account마다 paired User를 만들고 각 user가 정확히
  하나의 account를 가지며, post 소유권/타 user 거부가 성립하는지 확인합니다.
- `check_account_profile`: user가 편집한 profile(`profile_source=user`)이 같은 package
  재import 후에도 `display_name`/`bio`/`avatar_url`을 보존하는지 확인합니다(format 무변경의
  실증).

두 스크립트는 실제 import(쓰기)를 수행한 뒤 생성한 행을 정리하므로 dev/test
`DATABASE_URL`에서 실행합니다.

## 릴리즈 체크 포함

import service 또는 external package format에 영향을 주는 변경 후, 그리고 릴리즈
직전에 위 명령을 실행해 통과를 확인합니다. (AGENTS.md의 External Package Format
Freeze 규칙과 동일한 안전망입니다.)
