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
v0.4.x  메타데이터 일급화 & 트리아지 (Metadata-first Reading)
v0.5.x  협업 (Annotation & Collaboration)
v0.6.x  인증 & 멀티유저 (Auth & Multi-user)
v1.0.0  첫 major: 배포 가능한 제품 기준선
v1.1.x  Rich Asset Experience
v1.2.x  외부/객체 스토리지 Ingestion (S3/MinIO)
```

순서의 근거:

- 외부 프로그램이 주기적으로 post를 생성하므로 데이터는 빠르게 누적됩니다.
  읽기 확장성(pagination 등)이 가장 시급합니다.
- ingestion 신뢰성은 사용자가 도구를 신뢰하기 위한 조건입니다.
- ingestion으로 metadata 풍부한 post가 대량 누적되면, 그 다음 병목은 "읽기"가
  아니라 "트리아지"입니다. metadata를 일급 차원(facet 필터, 카드 칩, 값 정렬)으로
  올리는 v0.4.x를 협업보다 먼저 둡니다. generic 메커니즘이지만 리포트/분석 post
  (severity·chamber·recipe를 한눈에)에서 특히 강력합니다.
- 댓글/북마크는 prototype user selection 상태로도 가치 검증이 가능하므로
  인증보다 먼저 진행합니다. 사내 실배포 일정이 앞당겨지면 협업(v0.5)과
  인증(v0.6)의 순서를 바꿀 수 있습니다.
- dashboard는 별도 기능으로 만들지 않습니다. saved filter(이름 붙인 필터
  조합의 저장)로 같은 요구를 generic하게 충족하며, v0.4.x의 후속 후보입니다.

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
  v0.5.x로 미룹니다.
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

- Me 탭: 내 post 관리 강화. (북마크/언급됨 목록 자리는 v0.5.x에서 채움)
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
- v0.3.2: incoming/archive/failed 자동 이동 + 디렉터리 일괄 처리 CLI
  (`process_incoming`) + 단순 폴링 watch. import 성공/실패(v0.3.1 batch status)에
  따라 package를 `archive`/`failed`로 이동.
- v0.3.3: asset 파일 managed storage 복사(opt-in, 기존 URL 방식 계속 지원).
- v0.3.4: `UX_BACKLOG.md` 반영(테마 마지막 MINOR). Me 탭 Load more + 공용
  ConfirmDialog. **이로써 v0.3.x 테마 완료.**
- v0.3.5: 테마 완료 후 운영 안정화 patch. `process_incoming --watch` 실행 중
  managed storage·`data/external_posts/` 파일 churn으로 Vite dev server가
  종료되던 문제를 `vite.config.ts`의 `server.watch.ignored`로 해결하고, 릴리즈
  runbook/checklist를 현재 버전 기준으로 최신화. 추가로 watch 중 생성 자산을
  `public/assets/generated/`에 직접 떨궈 넣을 때 Vite watcher가 아직 잠긴 파일에
  `fs.watch`를 붙이며 `EBUSY`로 dev server가 종료되던 동일 버그 클래스를, watcher
  제외 대상을 `public/assets/managed/**`에서 `public/assets/**` 전체로 확장해
  함께 해결. 신규 기능 없음(코드 변경 `vite.config.ts` 1개).

> v0.3.2는 원래 자동 이동·watch·asset 복사를 한 묶음으로 두었으나, "하나의
> MINOR = 하나의 집중된 변경" 원칙에 맞춰 운영 자동화(이동/CLI/watch)와 asset
> managed storage 복사를 v0.3.2 / v0.3.3으로 분리했습니다(2026-06-14 결정).

### v0.3.x 제약

```text
HTTP import는 기존 package JSON과 동일한 형식을 받는다 (전송 수단만 추가)
asset 파일 복사는 opt-in이며 기존 /assets/... 경로 package는 계속 동작한다
기존 CLI import workflow를 제거하지 않는다
```

## v0.4.x — 메타데이터 일급화 & 트리아지 (Metadata-first Reading)

목표: metadata가 풍부한 고volume feed에서, 자유 입력 필터(MVP11)를 넘어 metadata를
일급 차원으로 읽고 트리아지한다. 일반 피드에도 적용되지만(평점·장르·출처 등),
리포트/분석 post에서 severity·chamber·recipe를 한눈에 보고 정렬하는 데 특히
강력하다.

- v0.4.0: facet 기반 필터(기반). `GET /api/metadata/keys`류 facet API(distinct
  key/value + 사용 빈도). 필터 패널의 자유 입력 metadata key/value를 알려진
  key·value의 드롭다운/칩 선택으로 보강(자유 입력은 유지). v0.1.2 tag 자동완성과
  같은 패턴 재사용. **완료.**
- v0.4.1: 카드 metadata 노출 & 값 정렬. 사용자가 고른 metadata key를 카드에
  칩으로 고정 표시(pinned keys, localStorage). metadata 값 기준 정렬(텍스트
  사전순 + key 보유 post 한정, 기존 newest/oldest sort 확장). 숫자 인식 정렬과
  pinned keys URL 동기화는 테마 후속 후보로 보류. **완료.**
- v0.4.2: `UX_BACKLOG.md` 반영(테마 마지막 MINOR). 카드 metadata 중복 제거 +
  정렬 기대치 안내 + 테마 문서 일괄 정리. **이로써 v0.4.x 테마 완료.**

### v0.4.x 메타데이터 정책 (재확인)

```text
facet/정렬/칩은 모두 generic key-value 위에서 동작한다
severity, recipe, chamber, equipment 같은 도메인 필드를 core model / 공유
  component / route / 주요 UI 컨트롤에 하드코딩하지 않는다 (값으로만 유지)
distinct key/value 목록은 데이터에서 파생한다 (스키마를 새로 정의하지 않는다)
```

### v0.4.x non-goals

```text
analytics / 시계열 추세 차트 / dashboard
복잡한 AND/OR 쿼리 빌더
saved filter(이름 붙인 조합 저장) — 후속 후보로 보류
batch/source 단위 그룹 읽기 — 후속 후보로 보류
metadata 스키마 강제/검증
```

## v0.5.x — 협업 (Annotation & Collaboration)

목표: 봇/사람이 올린 post에 사람의 판단과 반응을 기록. 읽기(v0.1)·UI(v0.2)·
ingestion(v0.3)·metadata 트리아지(v0.4)로 "데이터를 잘 읽는" 축이 갖춰졌으니,
그 위에 사람의 입력을 얹는 단계입니다.

진입 판단·후보 계획·재사용 기반은 `archive/V0_5_X_COLLABORATION_PLAN.md`를 참고합니다.
각 MINOR 확정 scope는 `archive/V0_5_*_SCOPE.md`에 보관합니다.

- v0.5.0: comments (테마 기반). **완료.** post별 평면 댓글 — 작성/조회/수정/삭제
  (작성자 본인). 신규 `comments` 테이블 + `GET`/`POST /api/posts/{id}/comments`·
  `PATCH`/`DELETE /api/comments/{id}`. PostDetail 댓글 섹션 + 작성자 신원
  (display_name/avatar) + 본문 `@mention`(계정 링크)·`#hashtag`(`/posts?tag=`
  링크) 렌더(공용 `MentionText`로 caption·댓글 앱 전역 적용) + 카드 댓글 수 칩
  (트리아지 신호). `Follow` join 테이블 패턴 재사용.
- v0.5.1: bookmark. **완료.** post 북마크 토글 + 비공개 메모(annotation) + Me 탭
  북마크 목록. 신규 `bookmarks` 테이블(`note` optional, `UniqueConstraint(user,
  post)`) + user-scoped `POST`/`GET`/`PATCH`/`DELETE /api/users/{id}/bookmarks/
  {post}`·`GET /api/users/{id}/bookmarks`·`.../bookmark-ids`. 북마크 목록은 v0.4.x
  facet 필터·정렬 재사용, 메인 Browse엔 `bookmarked_only` 필터 토글. 같은 Me 탭
  작업으로 `UX_BACKLOG.md`의 이연 Open 항목("내가 팔로우한 계정" 목록,
  v0.2.3→v0.5.x)도 함께 처리.
- v0.5.2: in-app 알림. **완료.** 팔로우 계정 새 post, 내 post의 새 댓글, 나를
  언급한 새 post/댓글을 앱 안에서 모아 봅니다. 신규 `notification_state` 테이블
  (user별 `last_read_at` 읽음 워터마크) + user-scoped
  `GET /api/users/{id}/notifications`·`POST .../read-all`. 알림 item은 post/comment/
  follow/text에서 파생하고 같은 source의 reason을 병합합니다. mention 수신은
  post·댓글 본문 `@handle`을 v0.1.3/v0.5.0 렌더 규칙과 같은 regex로 판정(email
  오탐 방지). frontend는 `/notifications` 목록 + SideNav unread badge + Home unread
  진입 + Me 탭 Mentions 요약. **API mode 전용**, external package format 무변경.
- v0.5.3: `UX_BACKLOG.md` 반영(테마 마지막 MINOR). **완료.** 현재 Open backlog는
  없었으므로 협업 표면 UX audit으로 `/notifications` Unread empty state, Mark all
  read 로딩 비활성화, Me 탭 Bookmarks empty copy를 작게 정리하고 현재 릴리즈
  문서/검증 절차를 v0.5.3 기준으로 맞췄습니다. 상세는
  `archive/V0_5_3_UX_BACKLOG_SCOPE.md`. 이로써 **v0.5.x 테마 완료**.

작성자/북마크 소유자/알림 수신자는 prototype active user selection으로
식별합니다(MVP8 1:1 ownership 체크 패턴). 실제 인증/권한은 v0.6.x입니다.
like 기능은 북마크 사용 양상을 본 뒤 별도 결정합니다.

### v0.5.x 협업 정책 / 제약

```text
인증/JWT/session/OAuth는 범위 밖 (v0.6.x) — 작성자/소유자는 active user selection
Comment·Bookmark·Notification은 generic 협업 개념이라 새 core type으로 허용
  (설비 전용 용어 Chamber/Recipe/Severity와 다름 — 도메인 값은 계속 metadata로)
협업 데이터는 앱 내부 행동이며 external package JSON format을 바꾸지 않는다
mock mode는 데모 전용 동결 — 협업 기능은 API mode 전용
```

### v0.5.x non-goals

```text
인증/로그인/권한 시스템 (v0.6.x)
like / reaction — 북마크 사용 양상을 본 뒤 별도 결정
북마크 폴더/컬렉션 — post-theme 후보로 이연
외부 알림 채널 (메일, 메신저) — "그 이후 후보"
실시간 push / websocket (in-app 조회/폴링까지)
댓글 대댓글(threading) / 리치 텍스트 / 멘션 자동완성 (렌더만)
external package에 댓글/북마크 싣기 (format 변경 필요)
```

## v0.6.x — 인증 & 멀티유저

목표: 여러 사람이 실제로 쓰기 직전의 관문.

- v0.6.0: password 로그인 + server-side session. 현재 prototype user
  selection을 실제 인증으로 교체. OAuth/SSO/JWT는 범위 밖. Password는 서버에
  hash로 저장하고, 로그인 화면에서 현재 password 기반 변경을 지원한다. 상세 scope와
  검증은 `archive/V0_6_0_AUTH_SCOPE.md`를 따른다.
- v0.6.1: User:Account 1:1 운영 정책 정리. 봇/프로그램/설비 계정도 로그인 가능한
  별도 user로 취급하며, 하나의 user는 정확히 하나의 account를 가진다는 원칙을
  유지한다. 계정 전환은 "다른 user로 로그인"하는 문제로 다루고, user가 여러
  account를 소유하거나 대리 작성하는 구조는 범위 밖. 상세 scope와 검증은
  `archive/V0_6_1_ACCOUNT_IDENTITY_SCOPE.md`를 따른다.
- v0.6.2: 내 account profile self-service. 로그인한 user가 자기 1:1 account의
  display_name/bio/avatar를 UI에서 직접 수정. account/handle처럼 식별자에
  해당하는 값은 등록 시 고정(수정 불가). Profile asset은 post asset과 분리된
  profile 전용 storage 정책으로 다룬다. 상세 scope와 검증은
  `archive/V0_6_2_PROFILE_SELF_SERVICE_SCOPE.md`를 따른다.
- v0.6.3: auth hardening & cleanup. 신규 도메인 기능 없이 인증 표면의 운영성/품질을
  보강한다. (1) 운영자 password reset CLI(`scripts/reset_password.py`)로 V0_6_0
  Password Policy의 운영자 reset 경로를 실제 구현, (2) session 만료/무효 시 frontend가
  401을 받아 로그인 화면으로 복귀, (3) 로그인 화면의 dead code 정리. session cookie
  `secure` 분리·write endpoint의 session-only 인가·로그인 화면 user 목록 숨김은
  비-localhost 이전 시점으로 명시 이연. 상세 scope와 검증은
  `archive/V0_6_3_AUTH_HARDENING_SCOPE.md`를 따른다.
- v0.6.4: 계정 라이프사이클 (탈퇴/비활성 + post 보존). **완료.** 계정을 그만 쓰는
  경로를 soft deactivation으로 다룬다. `accounts.deactivated_at`(null=active)에 상태를
  두고, 소유자 self-service 비활성화(`POST /api/accounts/{id}/deactivate`) 시 로그인
  차단 + 세션 폐기 + discovery 제외를 적용하되 post/협업 데이터는 보존한다. 신규 follow는
  409로 차단(기존 follow 보존). 재활성화는 운영자 CLI(`scripts/reactivate_user.py`)만.
  ROADMAP 제약의 "비활성/삭제 시 post 처리 정책 별도 확정"을 이 MINOR에서 닫는다.
  상세 scope와 검증은 `archive/V0_6_4_ACCOUNT_LIFECYCLE_SCOPE.md`를 따른다. **이로써 v0.6.x
  테마 완료** — v1.0.0 전제(v0.1 읽기확장 + v0.3 ingestion + v0.6 인증)가 갖춰졌다.

> 배경(2026-06-17 결정): v0.6.x에서는 User:Account 1:N으로 확장하지 않고 1:1
> 원칙을 유지한다. 설비/봇 계정도 별도의 로그인 user로 취급하면, post/comment/
> follow/bookmark/notification의 주체가 항상 현재 로그인 user 하나로 정해져
> v0.5.x 협업 데이터와 권한 체크를 단순하게 유지할 수 있다.

```text
User:Account identity
  - User는 로그인, session, password, comment/bookmark/notification/read state의 주체.
  - Account는 feed에 보이는 profile/post/follow/mention identity.
  - 현 단계에서는 User 1개 : Account 1개를 유지한다.
  - 봇/프로그램/설비 account도 필요하면 별도 User와 1:1 Account로 생성한다.
  - 한 user가 여러 account를 소유하거나, 로그인 user가 다른 account로 대리 작성하는
    기능은 v0.6.x 범위 밖이다.

incoming 패키지 / profile 갱신 규칙
  - 기존 external post package format은 변경하지 않는다.
  - 기존처럼 `accounts[]`가 있으면 import가 해당 account profile을 upsert한다.
  - post는 계속 `account_external_id`로 `accounts[].external_id` 또는 DB existing
    account를 참조할 수 있다.
  - 로그인 사용자가 UI에서 profile을 수정하는 기능(v0.6.2)은 자기 1:1 account에만
    적용한다. import-managed account와 user-edited profile의 충돌 정책은 v0.6.2
    scope에서 확정하되, 기존 package를 깨지 않는다.

계정 추가/삭제(라이프사이클)
  - 신규 계정: 가입/운영 흐름으로 User+Account 1:1을 생성하거나, import가 기존처럼
    paired import User+Account를 생성한다.
  - 비활성/삭제: post는 account FK로 연결되므로, 계정 삭제 시 post 처리
    정책(보존/비활성/숨김)은 v0.6.x scope에서 별도 확정한다.

테스트 데이터
  - 로그인 가능한 테스트 user/account는 seed에 둔다. seed는 write-once(있으면 안 덮음)
    방식으로 import와 충돌하지 않게 유지한다.
  - 설비/봇 시나리오도 별도 로그인 user + 1:1 account fixture로 표현할 수 있다.
  - import 패키지(외부 생성 콘텐츠)와 seed(개발/테스트 픽스처)는 별개 경로로
    유지한다.
```

## v1.0.0 — 첫 major

v0.1(읽기 확장성) + v0.3(ingestion 신뢰성) + v0.6(인증)가 갖춰지면
v1.0.0으로 올립니다. 별도 신규 기능 없이 안정화/문서화/배포 절차 정리가
중심인 릴리즈입니다.

전제는 v0.6.x 완료로 모두 충족되어 **이 마일스톤을 개시**합니다. 다만 v1.0.0은
"실사용자에게 배포 가능한 기준선"이므로, `archive/V0_6_3`에서 "비-localhost 이전 시"로 이연한
보안 하드닝(write endpoint의 session 기반 인가, cookie `secure`, 로그인 화면 user 목록
숨김)이 태그 전 필수입니다. 상세 must-do/안정화 항목과 태그 조건은
`V1_0_0_RELEASE_SCOPE.md`를 따릅니다. 이 항목들이 통과하기 전에는 v1.0.0을 태그하지
않습니다.

## v1.1.x — Rich Asset Experience (post-1.0)

- 이미지/plot zoom & pan.
- interactive chart opt-in: 새 asset type을 추가하지 않고 `mime_type`이
  Vega-Lite/Plotly JSON일 때 인터랙티브 렌더링.
- PDF inline preview.
- CSV preview 확장 (정렬, 더 보기).

## v1.2.x — 외부/객체 스토리지 Ingestion (S3/MinIO)

목표: 외부 분석/생성 프로그램이 배치를 S3-compatible object storage(집: 로컬
MinIO / 회사: S3)에 업로드하면, backend watch worker가 이를 주기적으로 발견해
기존 import 파이프라인으로 DB에 반영한다. 기존 filesystem ingestion(v0.3.x)은
그대로 두고 S3를 두 번째 discovery backend로 추가한다. "그 이후 후보"에 있던
`S3 등 외부 asset storage`를 이 테마로 승격한다.

핵심 원칙:

- S3/MinIO 객체는 immutable. rename/move/copy-delete/삭제 없이 원본 key 그대로
  둔다. 처리 상태의 source of truth는 PostgreSQL이다(S3 이름/위치 아님).
- `_READY.json`은 "이 배치를 읽어도 된다"는 완료 신호일 뿐, 상태 저장소가 아니다.
  같은 배치가 매 polling마다 보이는 것은 정상이며 재처리 여부는 DB로 판단한다.
- import 검증/DB 생성 로직은 복제하지 않고 `import_payload`를 재사용한다.

- v1.2.0: Storage 추상화 + S3 discovery (기반). read-only S3 client
  (list ready markers/read json/head/exists/pagination, mutation 없음), `S3_*`
  설정, `_READY.json` 모델·검증(schema version, batch_external_id↔prefix 일치,
  manifest_key 상대경로/traversal 차단, manifest·asset 존재, optional checksum/
  asset_count), S3 batch discovery. MinIO 없이 통과하는 단위 테스트(botocore
  Stubber/fake adapter). DB 스키마 변경 없음.
- v1.2.1: PostgreSQL ingestion tracking 확장. 기존 `import_batch`를 nullable
  컬럼으로 확장하고 신규 `ingest_state`(pending/processing/completed/failed/
  ignored) 컬럼 추가(기존 `status`/`/api/imports` 무영향). Alembic migration.
  batch claim(unique + row lock), post/asset external_id 기반 idempotency,
  processing timeout·failed retry 정책. `import_payload` 연결.
- v1.2.2: Watch worker + one-shot CLI. 신규 `process_s3_incoming`(filesystem
  `process_incoming` 구조 미러링, discovery만 S3). configurable interval/limit,
  graceful shutdown, structured logging, 성공/실패/skip 통계, worker health
  (last_poll/last_success/last_error/currently_processing).
- v1.2.3: MinIO 로컬 개발환경 + producer. `docker-compose.minio.yml`(API 9000/
  console 9001, 영속 볼륨, bucket 자동 생성 init), producer 업로드 예제 CLI
  (`scripts/upload_post_batch.py`, asset→manifest→_READY 순서 보장, overwrite/
  dry-run), integration 검증 절차 문서. (여기서부터 MinIO 필요.)
- v1.2.4: Asset URL 제공 + frontend 회귀. S3 객체용 backend asset proxy
  endpoint + serializer가 절대 URL 생성, DB엔 canonical object identity 저장
  (presigned는 대안). private bucket·MinIO·회사 S3 모두 지원, frontend 변경
  최소화 회귀 확인. 아키텍처/운영 문서(Mermaid sequence·state diagram) 보강.
- v1.2.5: `UX_BACKLOG.md` 반영(테마 마지막 MINOR). 신규 기능 없이 운영 가시성/
  문서/검증 절차 정리. 이로써 v1.2.x 테마 완료.

### v1.2.x 제약

```text
S3/MinIO 객체는 어떤 상태에서도 변경하지 않는다 (immutable object source)
배치 처리 상태는 PostgreSQL tracking record로만 관리한다
기존 filesystem ingestion(v0.3.x)을 제거하거나 동작을 바꾸지 않는다
feed_posts.json(external package format)은 동결 유지, _READY.json은 신규 아티팩트
import 검증/DB 생성은 import_payload를 재사용한다 (복제 금지)
신규 의존성은 boto3만 추가한다 (moto 등 테스트 의존성은 도입하지 않음)
API mode 전용. mock mode/frontend upload UI는 범위 밖
```

### v1.2.x non-goals

```text
S3 객체 rename/move/lifecycle/삭제, copy 후 delete
외부 URL fetch (manifest가 선언한 batch-relative asset만 허용)
frontend에서의 업로드 flow/UI
IAM/버킷 정책 자동화 (권장 최소권한은 문서로만)
전체 스택 docker compose (MinIO 전용 compose만 추가)
feed_posts.json 포맷 변경, mock mode 확장
```

## 그 이후 후보 (시기 미정)

```text
semantic search / vector search
외부 알림 채널 (메일, 메신저)
RBAC / SSO
saved filter 공유
```
