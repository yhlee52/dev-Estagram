# V0_3_3_ASSET_STORAGE_SCOPE.md

`feed-prototype` v0.3.3 — **Asset Managed Storage 복사 (opt-in)** 상세 scope
문서입니다.

`ROADMAP.md`의 v0.3.x(Ingestion 신뢰성) 테마 네 번째 MINOR이며, v0.3.0(HTTP
Import API)·v0.3.1(Import Batch 이력)·v0.3.2(자동 이동/일괄 처리/Watch) 위에
**asset 내구성(durability)** 을 opt-in으로 얹습니다. ROADMAP의 "개별 버전 구현 시
해당 버전의 상세 scope 문서를 작성한 뒤 작업한다" 규칙과
`V0_3_X_INGESTION_PLAN.md` 3장 v0.3.3 후보, 그리고 v0.3.2에서 분리된 ③ 항목을
구체화한 것입니다.

## 범위 분할 배경 (2026-06-14)

원안의 v0.3.2는 ① 자동 이동, ② folder watch, ③ asset 파일 managed storage 복사를
한 묶음으로 두었으나, "하나의 MINOR = 하나의 집중된 변경" 원칙에 맞춰 ①②를
v0.3.2로, **③을 이 문서(v0.3.3)로** 분리했습니다(`V0_3_2_AUTO_INGESTION_SCOPE.md`
범위 분할 결정 참고). import가 현재 asset 파일을 읽지 않고 `url` 문자열만 저장하므로,
파일 해석·복사·서빙·URL 재작성을 새로 설계해야 하는 가장 크고 위험한 작업이라
별도 MINOR로 격리했습니다.

## 배경 (현재 동작)

- import는 asset의 `url` **문자열만** DB에 저장합니다. 파일을 읽거나 복사하지
  않습니다(`data/external_posts/README.md` Upsert 정책: "MVP10은 asset 파일을
  복사하지 않습니다").
- asset은 **frontend(Vite `public/`)가 서빙**합니다. `getAssetUrl`(
  `src/utils/assetUtils.ts`)이 `asset.url`을 그대로 반환하고, 브라우저는 그 URL을
  **frontend origin** 기준으로 가져옵니다. `/assets/generated/...`가 동작하는
  이유입니다.
- **backend는 정적 파일을 서빙하지 않습니다**(`app/main.py`에 `StaticFiles`
  마운트 없음, `/api/...` JSON만 제공).
- 결과적으로 asset 파일의 내구성은 전적으로 외부 운영자에게 달려 있습니다.
  package 작성자가 파일을 브라우저 접근 위치(`public/assets/generated/` 등)에
  직접 두어야 하고, 그 원본이 사라지면 import된 post의 이미지/표/파일이 깨집니다.

v0.3.3은 **opt-in** 으로, package가 함께 들고 온 로컬 파일을 backend가 관리하는
서빙 위치로 복사해 내구성을 확보합니다. 끄면 오늘과 완전히 동일하게 동작합니다.

## 설계 원칙 — "가장 안정적이고 변화가 적은" 방향

이 MINOR는 의도적으로 **새 서빙 인프라를 도입하지 않고, 이미 URL인 asset은 절대
손대지 않는** 최소 변경 설계를 택합니다.

- **기본 OFF.** 토글을 켜지 않으면 DB·파일·응답이 v0.3.2와 바이트 단위로 동일.
- **기존 서빙 트리 재사용.** 복사 대상은 Vite가 이미 서빙하는 `public/assets`
  하위(`public/assets/managed/`). FastAPI `StaticFiles` 마운트 추가 없음, 새
  origin 없음, CORS 변경 없음.
- **동결 URL 무손상.** `/assets/...`·`http(s)://` 로 시작하는 asset url은 복사도
  재작성도 하지 않습니다(format freeze·하위호환 유지).
- **format/스키마 무변경.** package JSON에 새 필드 없음. `import_batch` 테이블
  변경 없음 → 마이그레이션 없음. `post_assets.url` 컬럼에 다른 문자열을 넣을 뿐.

> 검토했으나 채택하지 않은 대안: backend에 `StaticFiles` 마운트 + 새 url
> prefix(`/managed-assets/...`) + cross-origin. 아키텍처적으로는 더 정석이지만 새
> 서빙 스택·CORS·혼합 origin을 들이는 정반대로 변화가 큰 방향이라, "안정·최소
> 변경" 목표에 맞춰 보류합니다(필요 시 후속 MINOR/테마에서 재검토).

## 결정 사항 (진입 시 확정)

- **토글:** `Settings`의 단일 env 플래그 `manage_asset_storage: bool = False`
  (env `MANAGE_ASSET_STORAGE`)로 **단일화**. 요청별 옵션(HTTP query)이나 CLI
  플래그를 추가하지 않음 → CLI 인터페이스·API 표면·format 무변경, 토글의 진실
  원천은 `Settings` 하나. 회귀/테스트는 env(또는 settings override)로 ON 상태를
  구성합니다.
- **저장 위치:** `public/assets/managed/`(Vite 서빙 트리). `Settings`에
  `managed_assets_dir: Path`(기본 = 리포 내 `feed-prototype/public/assets/managed`)
  와 `managed_assets_url_prefix: str = "/assets/managed"`를 추가해 파일시스템
  경로와 서빙 URL을 일관되게 묶습니다.
- **복사 적용 대상:** **package 디렉터리(로컬 파일)가 있는 경로에서만.** 즉
  CLI(`import_external_posts --input`)와 `process_incoming`. HTTP
  import(`POST /api/imports`)는 디스크에 asset 파일이 없으므로(JSON body만 수신)
  복사 대상이 아닙니다(v0.3.2의 "HTTP는 디스크 파일 없음" 논리와 동일).
- **복사 판정(asset url별):**
  - `/`로 시작(절대 브라우저 경로) 또는 `http://`·`https://`·`//`(원격/프로토콜
    상대) → **무손상.** 복사 안 함, url 유지.
  - 그 외(상대 로컬 경로, 예: `assets/foo.png`, `./foo.png`) → package
    `feed_posts.json` 디렉터리 기준으로 해석한 로컬 파일을 복사 후보로 봄.
  - Windows 절대경로(`C:\...`)는 이미 스키마 url validator가 **거부**하므로
    여기 도달하지 않습니다(추가 처리 불필요).
- **복사 동작:** 토글 ON + 복사 후보 + `dry_run=False`일 때만, 원본 파일을
  managed 디렉터리로 복사하고 **DB에 저장되는 url만** `<url_prefix>/...`로 재작성.
  package 원본 JSON과 디스크 파일은 변경하지 않습니다.
- **대상 경로 결정성:** 목적지는 asset 정체성에서 **결정적으로** 도출
  (`<managed_assets_dir>/<batch_external_id>/<asset_key><ext>`,
  `asset_key`는 `external_id` 우선, 없으면 안전화한 원본 파일명). 같은 package
  재import 시 같은 경로를 덮어써 누적되지 않음(`external_id` upsert와 정합).
- **실패 관용:** 토글 ON인데 원본을 못 찾거나 복사 실패 시 **import를 실패시키지
  않음.** 해당 asset은 url을 **원본 그대로 유지**(=종전 동작)하고 경고 로그를
  남깁니다(기존 broken-asset 관용과 일치).
- **경로 안전:** 해석한 원본 경로가 package 디렉터리를 벗어나면(`../` 탈출 등)
  복사하지 않고 경고. 목적지는 항상 `managed_assets_dir` 안.

## 재사용 기반 (코드 현황)

- `app/services/import_external_posts.py`
  - `replace_assets_for_post(...)`: 현재 `PostAsset(url=asset_input.url,
    src=asset_input.url, ...)`로 생성. **복사 + url 재작성의 단일 hook 지점.**
  - `import_payload(session, payload, *, dry_run)`: CLI/HTTP 공용 진입점. 여기에
    **`asset_source_dir: Path | None = None`** 컨텍스트를 추가해 복사 가능 여부를
    전달(아래 Goals 참고). HTTP route는 `None`(복사 없음), CLI/`process_incoming`은
    package 디렉터리를 전달.
  - `run_import(*, input_path, dry_run, database_url, print_result)`: `input_path`
    의 부모가 곧 `asset_source_dir`. 호출부에서 주입.
- `app/core/config.py`의 `Settings`: 토글/경로 필드 3개 추가
  (`manage_asset_storage`, `managed_assets_dir`, `managed_assets_url_prefix`).
- `app/schemas/external_import.py`의 `ExternalImportAsset.validate_url`: 이미
  Windows 절대경로를 거부하고 url을 strip. 추가 검증 불필요(format 무변경).
- 폴더/서빙 관례: `public/assets/generated/`가 이미 "비커밋·브라우저 서빙" 관례.
  `public/assets/managed/`는 그 자매 폴더로 자연스러움.
- 회귀 스크립트 패턴: `backend/scripts/check_*.py`(실제 DB/임시 폴더 사용 후 정리).

## Goals

### 1) 설정 (`Settings`)

`app/core/config.py`에 3개 필드 추가:

```text
manage_asset_storage: bool = False            # env MANAGE_ASSET_STORAGE
managed_assets_dir: Path = <repo>/public/assets/managed
managed_assets_url_prefix: str = "/assets/managed"
```

기본값에서 동작 변화 0. `managed_assets_dir`와 `managed_assets_url_prefix`는
같은 위치의 파일시스템/URL 두 표현이며 운영자가 다른 서빙 배치를 쓰면 함께
바꿉니다.

### 2) 복사 + URL 재작성 hook

신규 헬퍼(예: `app/services/asset_storage.py`)에 순수 함수로 격리:

```text
resolve_local_source(url, source_dir) -> Path | None
    # /·http(s)·// 로 시작하면 None(무손상). 상대 경로면 source_dir 기준 해석,
    # 디렉터리 탈출/부재면 None.
copy_into_managed(source, *, batch_external_id, asset_key, settings) -> str
    # 결정적 목적지로 복사하고 서빙 url 문자열 반환.
```

`import_payload`는 `asset_source_dir: Path | None`을 받아 다음 조건을 **모두**
만족할 때만 복사를 시도하고, 성공 시 `PostAsset.url`/`.src`에 재작성된 url을
저장합니다:

```text
settings.manage_asset_storage is True
asset_source_dir is not None         # = 로컬 package 디렉터리가 있는 경로
dry_run is False
resolve_local_source(...) 가 실제 파일을 가리킴
```

위 조건을 하나라도 못 채우면 **원본 url 그대로** 저장(종전 동작). 복사 실패는
경고 로그 후 원본 url 유지(import는 계속).

### 3) 호출부 배선

- `run_import`: `import_payload(..., asset_source_dir=input_path.parent)`.
- `process_incoming`: package별로 `run_import`를 호출하므로 자동 반영(디렉터리형
  package는 `feed_posts.json`의 부모, 단일 `.json`도 그 파일의 부모가 source dir).
- HTTP route(`app/api/routes/imports.py`): `import_payload(..., asset_source_dir=
  None)` 명시 → HTTP 경로는 복사 안 함(불변).

### 4) 관측성 (마이그레이션 없이)

- 복사 성공/실패/건너뜀은 **로그**로 남기고, CLI 1회 실행 요약에 "copied N /
  skipped M" 한 줄을 추가합니다.
- **`import_batch` 테이블과 `ImportSummary`의 영속 카운트 컬럼은 변경하지
  않습니다**(마이그레이션 회피). 복사 통계는 영속화하지 않습니다. (영속 집계가
  필요해지면 후속 MINOR에서 컬럼 추가로 분리.)

## 회귀 안전장치

- **기존 dry-run/HTTP 회귀 무변경 통과.** `check_golden_samples.py`·
  `check_http_import.py`·`check_batch_history.py`·`check_process_incoming.py`의
  기존 example들은 url이 모두 `/assets/...`라 토글 ON이어도 **복사 no-op**.
  토글 기본 OFF에서도 당연히 무변경.
- **신규 example package**: 상대 로컬 asset을 들고 오는 작은 package를 추가
  (예: `examples/managed_copy_sample/`에 `feed_posts.json` + `assets/<작은 파일>`).
  binary는 넣지 않고 **작은 텍스트성 파일**(예: 소형 `.csv`/`.svg`)로 복사 경로를
  exercise. golden dry-run 목록에도 포함(dry-run은 복사 안 하므로 안전).
- **신규 회귀 스크립트** `scripts/check_managed_asset_copy.py`(실제 DB + 임시
  managed/source 폴더, 종료 시 정리). 커버:
  1. 토글 ON + 상대 로컬 asset → 파일이 managed로 복사되고 DB url이
     `<prefix>/...`로 재작성됨. 재import 시 같은 경로 덮어쓰기(누적 없음).
  2. 토글 ON + `/assets/...`·`http(s)://` asset → 복사 없음, url 그대로.
  3. 토글 OFF → 복사 없음, url 그대로(어떤 형태든).
  4. `--dry-run` → 토글 ON이어도 파일/DB 무변경.
  5. 원본 파일 부재/디렉터리 탈출 경로 → import 실패하지 않고 원본 url 유지 +
     경고.
  6. HTTP import 경로(`asset_source_dir=None`) → 복사 없음.

## 정책 / 주의

- **external post package JSON format 변경 없음.** 새 필드를 추가하지 않으며,
  복사 여부는 기존 `url` 문자열의 형태(절대 URL vs 상대 로컬 경로)로만 판정합니다.
  상대 로컬 경로는 종전에도 허용된 문자열이지만 UI에서 깨지던 케이스로, v0.3.3은
  그것에 **opt-in으로 정의된 의미**를 부여할 뿐입니다.
- **하위호환.** 기존 `/assets/...` URL package는 토글 상태와 무관하게 그대로
  동작(복사·재작성 대상 아님). 이미 import된 post에도 영향 없음.
- **import 로직 중복 금지.** 복사는 `replace_assets_for_post` 한 곳에서만 일어나며
  검증/upsert/배치 기록 규약은 v0.3.0~v0.3.2 그대로.
- **dry_run = 부작용 없음.** 토글 ON이어도 dry-run은 파일을 쓰지 않습니다.
- **core domain 유지.** 새 테이블·모델·도메인 개념 없음(AGENTS.md Core Domain).
  asset은 generic asset으로만 다룸.
- **mock 무관.** backend·CLI 전용. frontend/mock 변경 없음(mock 동결 정책 부합).
  frontend는 재작성된 `/assets/managed/...` url도 기존과 동일하게 렌더링.
- **인증 범위 밖.** 토글은 운영 설정이며 HTTP token(v0.3.0)과 무관.
- **원격 fetch 안 함.** `http(s)://` asset은 네트워크로 가져오지 않습니다(egress
  0, 새 실패모드 없음).

## Non-goals

```text
backend StaticFiles 마운트 / 새 url prefix / cross-origin asset 서빙 — 보류(대안)
원격 http(s):// asset 다운로드/캐싱 — fetch 안 함
UI file upload / multipart 업로드 / S3 등 외부 storage — 범위 밖
HTTP import의 asset 파일 수신(멀티파트) — HTTP는 JSON body만
managed 파일 가비지 컬렉션 / 재import 시 옛 복사본 정리 — 후속(결정적 덮어쓰기까지만)
복사 통계의 import_batch 영속화 — 로그/CLI 출력까지만 (마이그레이션 회피)
external package format 변경 / 새 필드
DB 스키마 변경 / 마이그레이션
frontend 변경 / mock 연동
asset 무결성 해시 / 중복 제거(content-addressed) — 후속 후보
```

## 검증 요약

1. 토글 OFF(기본): import 동작이 v0.3.2와 동일(복사 없음, url 그대로). 기존
   check_* 회귀 0.
2. 토글 ON + 상대 로컬 asset를 가진 package를 `--input`/`process_incoming`으로
   import → 파일이 `public/assets/managed/...`로 복사되고 DB url이
   `/assets/managed/...`로 재작성, API mode UI에서 정상 렌더링.
3. 토글 ON + `/assets/...`·`http(s)://` asset → 복사 없음, url 무손상.
4. `--dry-run`은 토글 ON이어도 파일·DB 무변경.
5. 원본 부재/경로 탈출 → import 실패 없이 원본 url 유지 + 경고 로그.
6. HTTP import는 복사 없음(불변), 기존 HTTP 회귀 0.
7. `python -m scripts.check_managed_asset_copy` 통과(+ 기존 check_* 회귀 0).
8. `npm run build`(tsc + vite) 통과(frontend 변경 없음).
9. 완료 시 `appVersion.ts` 라벨 `v0.3.3`로 상향, `AGENTS.md` Completed Scope
   History·`docs/README.md` 색인·README들·`PROJECT_GOALS.md`·
   `V0_3_X_INGESTION_PLAN.md` 현황·`data/external_posts/README.md`(managed
   storage opt-in 동작) 갱신.
