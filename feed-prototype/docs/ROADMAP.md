# ROADMAP.md

`feed-prototype`의 v0.0.0 이후 업데이트 로드맵입니다.

이 문서는 버전 테마와 순서를 정의합니다. 개별 버전을 구현할 때는 이 문서를
기준으로 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤 작업합니다.

## 버전 네이밍 규칙

```text
MAJOR.MIDDLE.MINOR  (예: 0.1.2)
```

- `MAJOR`: 제품 성격이 바뀌는 진짜 major 업그레이드. v1.0.0은 "실사용자에게
  배포 가능한 제품"이 되는 시점에만 올립니다.
- `MIDDLE`: 하나의 기능 테마 단위 업그레이드. 테마의 기반 작업이 `x.y.0`입니다.
- `MINOR`: 테마 안의 개별 기능 추가, 개선, 수정.

각 MIDDLE 테마의 마지막 MINOR 슬롯은 `UX_BACKLOG.md`에 쌓인 UX feedback
반영용으로 예약합니다.

## 전체 트리 요약

```text
v0.1.x  탐색과 발견 (Discovery & Navigation)
v0.2.x  레이아웃 & UI 개편 (Layout & UI)
v0.3.x  Ingestion 신뢰성 (Ingestion Hardening)
v0.4.x  협업 (Annotation & Collaboration)
v0.5.x  인증 & 멀티유저 (Auth & Multi-user)
v1.0.0  첫 major: 배포 가능한 제품 기준선
v1.1.x  Rich Asset Experience
```

순서의 근거:

- 외부 프로그램이 주기적으로 post를 생성하므로 데이터는 빠르게 누적됩니다.
  읽기 확장성(pagination 등)이 가장 시급합니다.
- ingestion 신뢰성은 사용자가 도구를 신뢰하기 위한 조건입니다.
- 댓글/북마크는 prototype user selection 상태로도 가치 검증이 가능하므로
  인증보다 먼저 진행합니다. 사내 실배포 일정이 앞당겨지면 v0.4와 v0.5의
  순서를 바꿀 수 있습니다.
- dashboard는 별도 기능으로 만들지 않습니다. saved filter(이름 붙인 필터
  조합의 저장)로 같은 요구를 generic하게 충족합니다.

## 전 버전 공통 제약

- core domain은 User, Account, Post, Feed, Follow, Asset, Metadata로
  유지합니다. 자세한 규칙은 `../../AGENTS.md`의 Core Domain 섹션을 따릅니다.
- external post package JSON format은 동결(freeze)되었습니다. 자세한 정책은
  `EXTERNAL_POST_PACKAGE_GUIDE.md`의 Format Stability 섹션을 따릅니다.
  요약: 기존 필드의 변경/삭제/필수화 금지, 새 필드는 optional로만 추가.
- 이미 생성된 외부 package는 어떤 미래 버전에서도 재import 가능해야 합니다.
- mock mode는 v0.2.x까지 유지합니다. v0.3.0부터 mock mode는 "UI 데모 전용
  동결" 상태로 전환하며, 신규 기능은 API mode에만 추가해도 됩니다.
  mock mode를 제거하지는 않습니다.

## v0.1.x — 탐색과 발견 (Discovery & Navigation)

목표: 데이터가 누적되어도 매일 쓸 수 있는 읽기/탐색 경험.

### v0.1.0 — Read at Scale (기반)

- `GET /api/posts`, `GET /api/feed`에 pagination 추가. cursor 기반 권장,
  최소한 `limit` + cursor/offset 조합.
- frontend feed/browse에 더 보기 또는 infinite scroll.
- 날짜 범위 필터: `created_at_from`, `created_at_to` query parameter.
- 정렬 옵션: 최신순(기본), 오래된순.
- 필터 상태와 URL query parameter 동기화. 이후 해시태그 클릭, saved filter,
  공유 가능한 링크의 기반이 됩니다.
- golden sample package 회귀 테스트 추가: 실제 생성된 package 1개 이상을
  repo에 박제하고 import `--dry-run` 통과를 릴리즈 체크에 포함.
- `metadata_json` 컬럼 JSON → JSONB 전환 + GIN index (Alembic migration).

### v0.1.1 — 해시태그 활성화

- `TagList` 태그 칩을 클릭 가능한 링크로 변경: `/posts?tag=<tag>`.
- PostCard, PostDetail, AccountProfile 어디서든 태그 클릭이 동작.
- backend 변경 없음 (MVP11 tag 필터 재사용).

### v0.1.2 — 해시태그 검색 최적화

- 검색창에서 `#`로 시작하는 입력은 keyword가 아닌 tag 필터로 라우팅.
- `GET /api/tags` 추가: 사용 빈도순 상위 N개 tag 반환.
- 검색창 tag 자동완성(suggestion) UI.

### v0.1.3 — @mention 렌더링

- post text의 `@handle` 패턴을 Account Profile 링크로 렌더링.
- 존재하지 않는 handle은 plain text로 fallback.
- frontend 렌더링만 구현. mention 저장, 알림, "나를 언급한 post" 목록은
  v0.4.x로 미룹니다.
- package format 변경 없음. 기존 생성된 post에도 소급 적용됩니다.

### v0.1.x non-goals

```text
Elasticsearch / full-text search / semantic search
saved filter 저장 기능 (URL 동기화까지만)
mention 알림
external package format 변경
```

## v0.2.x — 레이아웃 & UI 개편

목표: 데스크톱 화면 활용과 정보 위계 정리.

### v0.2.0 — 데스크톱 3컬럼 레이아웃

- 현재 `max-w-[430px]` 단일 컬럼을 데스크톱 폭 3컬럼으로 확장.
- 좌측 레일(navigation, 현재 BottomNav의 데스크톱 형태) + 중앙 feed +
  우측 레일(적용 중 필터, 팔로우 계정 바로가기).
- **데스크톱(PC) 전용.** 이 prototype은 당분간 PC 브라우저에서만 쓰는 것을
  전제로 하므로, 모바일/좁은 폭 반응형 대응은 v0.2.x 범위 밖으로 미룹니다.

### v0.2.1 — 헤더/검색창 정리

- 헤더 한 줄 압축. 사용자 카드는 아바타 클릭 시 드롭다운으로 이동.
- user id, 버전 배지 등 디버그성 정보는 드롭다운/메뉴 안으로.
- Switch user / Logout 중복 버튼 정리.
- 검색창 크기와 위치 조정.

### v0.2.2 — 탭 활성화 1 (Posts, Accounts)

- Posts 탭을 탐색(Explore) 성격으로: 인기/최근 태그 모음, 태그/계정 단위
  둘러보기 진입점.
- Accounts 탭: 최근 활동순 정렬, 최근 N일간 post 수 같은 활동 신호 표시.

### v0.2.3 — 탭 활성화 2 (Me) + UX backlog 반영

- Me 탭: 내 post 관리 강화. (북마크/언급됨 목록 자리는 v0.4.x에서 채움)
- `UX_BACKLOG.md`에 쌓인 항목 중 합의된 것 반영.

### v0.2.x non-goals

```text
다크 모드 등 테마 시스템
디자인 시스템/컴포넌트 라이브러리 도입
모바일 네이티브 대응
모바일/태블릿 폭 반응형 대응 (PC 전용 전제)
```

## v0.3.x — Ingestion 신뢰성

목표: 외부 프로그램이 만든 데이터가 확실히 들어왔음을 보장.

- v0.3.0: HTTP import API. 기존 import service 로직을 재사용해 동일한
  package JSON을 HTTP로 수신. CLI import는 그대로 유지.
- v0.3.1: import batch 이력 API + 최소 UI (batch별 성공/실패/post 수).
  `import_batch_external_id` 활용.
- v0.3.2: incoming/archive/failed 자동 이동, folder watch 또는 스케줄 실행,
  asset 파일 managed storage 복사(opt-in, 기존 URL 방식 계속 지원).

### v0.3.x 제약

```text
HTTP import는 기존 package JSON과 동일한 형식을 받는다 (전송 수단만 추가)
asset 파일 복사는 opt-in이며 기존 /assets/... 경로 package는 계속 동작한다
기존 CLI import workflow를 제거하지 않는다
```

## v0.4.x — 협업 (Annotation & Collaboration)

목표: 봇/사람이 올린 post에 사람의 판단과 반응을 기록.

- v0.4.0: comments (post별 댓글, 작성/삭제).
- v0.4.1: bookmark (post 북마크, Me 탭에 북마크 목록).
- v0.4.2: in-app 알림(팔로우 계정 새 post, 내 post의 새 댓글),
  mention 수신(나를 언급한 post 목록, mention 알림),
  Home Feed unread/since-last-visit 표시.

like 기능은 북마크 사용 양상을 본 뒤 별도 결정합니다.

## v0.5.x — 인증 & 멀티유저

목표: 여러 사람이 실제로 쓰기 직전의 관문.

- v0.5.0: password 로그인 + server-side session. 현재 prototype user
  selection을 실제 인증으로 교체. OAuth/SSO/JWT는 범위 밖.
- v0.5.1: User:Account 1:1 → 1:N. 봇/프로그램 계정을 user가 소유하는 구조.
  bot 여부 같은 분류는 core 필드가 아닌 generic한 소유 관계로 표현.

## v1.0.0 — 첫 major

v0.1(읽기 확장성) + v0.3(ingestion 신뢰성) + v0.5(인증)가 갖춰지면
v1.0.0으로 올립니다. 별도 신규 기능 없이 안정화/문서화/배포 절차 정리가
중심인 릴리즈입니다.

## v1.1.x — Rich Asset Experience (post-1.0)

- 이미지/plot zoom & pan.
- interactive chart opt-in: 새 asset type을 추가하지 않고 `mime_type`이
  Vega-Lite/Plotly JSON일 때 인터랙티브 렌더링.
- PDF inline preview.
- CSV preview 확장 (정렬, 더 보기).

## 그 이후 후보 (시기 미정)

```text
semantic search / vector search
외부 알림 채널 (메일, 메신저)
RBAC / SSO
S3 등 외부 asset storage
saved filter 공유
```
