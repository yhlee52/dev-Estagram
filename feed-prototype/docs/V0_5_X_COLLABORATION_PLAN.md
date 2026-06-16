# V0_5_X_COLLABORATION_PLAN.md

`feed-prototype` v0.5.x — **협업 (Annotation & Collaboration)** 테마 진입 판단과
v0.5.0~v0.5.3 후보 계획 문서입니다.

이 문서는 v0.4.x post-dev 점검(2026-06-16)에서 작성되었습니다. `ROADMAP.md`의
v0.5.x 항목을 코드 현황에 맞춰 구체화하고, 진입 전 확인할 사항을 정리합니다.
각 MINOR의 확정 scope는 착수 시 `V0_5_0_*_SCOPE.md` 등으로 분리해 작성합니다.

> **테마 진행 현황 (2026-06-16 갱신)**
> - v0.5.0 — Comments: **완료**. post별 평면 댓글(작성/조회/수정/삭제, 작성자
>   신원, 본문 `@mention` 렌더, 카드 댓글 수). 상세는 `V0_5_0_COMMENTS_SCOPE.md`.
> - v0.5.1 — Bookmarks(+ 비공개 메모 · Me 탭 목록): **완료**. post 북마크 토글 +
>   비공개 메모(annotation) + Me 탭 북마크/Following 목록 + 메인 Browse
>   `bookmarked_only` 필터. 상세는 `V0_5_1_BOOKMARKS_SCOPE.md`.
> - v0.5.2 — In-app 알림 & mention 수신: **완료**. 파생 알림 + user별 읽음
>   워터마크 + `/notifications` + Home/Me 진입점. 상세는
>   `V0_5_2_NOTIFICATIONS_SCOPE.md`.
> - v0.5.3 — UX backlog 반영(테마 마지막 MINOR): 예약 슬롯.
> - 버전 라벨(`appVersion.ts`의 `APP_RELEASE_LABEL`)은 `v0.5.2`. 직전 테마
>   v0.4.x(메타데이터 일급화 & 트리아지)는 **완료**(v0.4.2). 상세는
>   `archive/V0_4_X_METADATA_PLAN.md` 및 `archive/V0_4_*_SCOPE.md`.

## 1. v0.4.x 완료 / 진입 판단

v0.4.x(메타데이터 일급화 & 트리아지) 테마는 완료되었습니다.

- v0.4.0 facet 기반 필터(`GET /api/metadata/keys`·`/values` + `metadata_match`
  정확일치), v0.4.1 카드 metadata 칩 & 값 정렬(`sort=metadata_asc|metadata_desc`
  + pinned keys), v0.4.2 UX backlog 반영(카드 중복 제거 + 정렬 안내 + 문서 정리)
  — 3개 MINOR 모두 구현.
- 테마 마지막 MINOR(UX backlog 반영) 슬롯 사용 완료.
- 차단(blocking) 버그 없음. `UX_BACKLOG.md`의 Open 1건(Me 탭 "내가 팔로우한
  계정" 목록)은 메모대로 v0.5.x로 의도적 이연 — 회귀 아님. 이번 테마에서
  처리한다(아래 v0.5.1).

**판단: v0.5.x 진입 가능.**

> 순서 근거(ROADMAP 재확인): 읽기 확장성(v0.1)·UI(v0.2)·ingestion 신뢰성(v0.3)·
> metadata 트리아지(v0.4)로 "봇/외부 프로그램이 만든 데이터를 잘 읽는" 축이
> 갖춰졌습니다. 다음은 그 위에 **사람의 판단과 반응을 기록**하는 협업입니다.
> 댓글/북마크는 prototype user selection 상태로도 가치 검증이 가능하므로 인증
> (v0.6.x)보다 먼저 진행합니다. 사내 실배포 일정이 앞당겨지면 협업(v0.5)과
> 인증(v0.6)의 순서를 바꿀 수 있습니다(ROADMAP 단서 유지).

### 진입과 함께 유지되는 정책

- mock mode는 v0.3.0부터 **"UI 데모 전용 동결"** 상태입니다. v0.5.x 협업 기능은
  API mode에만 추가하며, mock mode를 제거하지는 않습니다.
- **인증은 여전히 범위 밖(v0.6.x).** 댓글 작성자/북마크 소유자/알림 수신자는
  현재의 prototype active user selection(`local-feed-active-user-id` +
  `user_id` 파라미터)으로 식별합니다. MVP8의 1:1 account ownership 체크와 같은
  패턴이며, real login/authorization이 아닙니다. v0.6.0에서 이 선택이 실제
  인증으로 교체되면 작성자/소유자 식별이 자연히 강화됩니다.
- external post package JSON format **동결 유지**. 댓글/북마크/알림은 **앱 내부
  사용자 행동**이라 import package와 무관합니다(새 필드 없음). 외부 package가
  댓글을 실어 보내는 것은 format 변경이 필요하므로 범위 밖입니다.

## 2. 코드 현황 (재사용 기반)

v0.5.x도 대부분 기존 자산 위에 얇게 얹는 작업입니다.

- **join/소유 테이블 선례 존재**: `app/models/follow.py`의 `Follow`가 (string PK
  + 두 FK + `created_at` + `UniqueConstraint`)의 깔끔한 join 테이블 패턴입니다.
  `Comment`(post_id FK + author user_id FK + text + created_at)와
  `Bookmark`(user_id FK + post_id FK + created_at + UniqueConstraint(user, post))가
  그대로 따라갈 형태입니다.
- **쓰기 라우트 선례 존재**: `app/api/routes/follows.py`의 follow/unfollow
  create·delete가 prototype user selection 기반 쓰기의 prior art입니다. 댓글
  작성/수정/삭제, 북마크 추가/삭제 라우트가 같은 구조를 재사용합니다.
- **필터 플래그 선례 존재**: 라우트/`PostFilters`의 `my_posts_only` bool 플래그가
  `bookmarked_only`(메인 피드 북마크 필터)의 prior art입니다. 북마크 목록 자체도
  `paginate_posts`에 bookmark scope만 더하면 v0.4.x facet 필터·metadata 정렬을
  그대로 얹습니다(북마크 목록 = "저장한 post의 부분집합").
- **작성자 표시 스키마 존재**: `AccountRead`(`app/schemas/feed.py`)가 이미 post
  표면에서 계정 `display_name`/avatar를 실어 줍니다. 댓글 작성자 신원 렌더에
  그대로 재사용합니다.
- **마이그레이션 시퀀스**: `alembic/versions/`는 `0001`~`0006`까지 순차
  번호입니다. 새 테이블(`comments`, `bookmarks`, 필요 시 알림 관련)은 `0007`
  이후로 추가합니다. JSONB/GIN 같은 무거운 전환 없이 단순 테이블 생성입니다.
- **소유권 체크 패턴 존재**: MVP8 personal post create/delete가 1:1 account
  ownership 체크만으로 동작합니다. 댓글 삭제(작성자 본인), 북마크(소유자 본인)도
  같은 최소 체크를 사용합니다(authorization 시스템 아님).
- **Me 탭 표면 존재**: v0.2.3/v0.3.4에서 Me 탭이 내 계정/내 post를 로드하고
  "Load more"로 점진 렌더합니다. v0.2.3 메모대로 **"북마크/언급됨 목록 자리는
  v0.5.x에서 채움"** — Me 탭에 북마크 목록·언급됨 목록·Following 목록을 붙입니다.
- **mention 렌더 존재**: v0.1.3에서 post 본문의 `@handle`을 Account Profile
  링크로 렌더합니다. v0.5.2의 mention **수신**(나를 언급한 post 목록/알림)은 이
  렌더 규칙과 같은 패턴 매칭을 쿼리 측에서 재사용합니다(아래 설계 메모).
- **빈도/목록 집계 패턴 존재**: `get_top_tags`·facet 집계(`GROUP BY` + count)와
  cursor pagination(`paginate_posts`)이 알림/북마크 목록 조회에 그대로 쓰입니다.
- **localStorage 동기화 패턴 존재**: v0.4.1 `usePinnedMetadataKeys`(storage/custom
  event 동기화)가 "since-last-visit" 마지막 방문 시각 같은 클라이언트 상태에
  재사용 가능합니다(서버 테이블 없이 시작할 수 있음).

## 3. v0.5.x 후보 (MINOR 분해)

`ROADMAP.md` v0.5.x 항목을 코드 현황에 맞춰 구체화한 것입니다. 각 MINOR는 하나의
집중된 변경 묶음입니다. 확정 결정은 각 `V0_5_*_SCOPE.md`에서 합니다.

> ROADMAP 원안은 v0.5.0(comments)/v0.5.1(bookmark)/v0.5.2(알림+mention)의 3개
> MINOR였습니다. "각 MIDDLE 테마의 마지막 MINOR는 UX_BACKLOG 반영용 예약" 규칙에
> 맞춰, 협업 기능 MINOR 뒤에 UX backlog 슬롯 v0.5.3을 명시적으로 둡니다
> (2026-06-16 결정). v0.4.x가 v0.4.2를 UX 슬롯으로 둔 것과 같은 정리입니다.

### v0.5.0 — Comments (테마 기반 작업, x.y.0)

목표: 봇/사람이 올린 post에 사람이 댓글로 판단·맥락을 남긴다.

- 신규 `comments` 테이블(`0007`): `id` PK, `post_id` FK, `author_user_id` FK,
  `text`, `created_at`, `updated_at`. `Follow` join 테이블 패턴을 따름.
- API: `GET /api/posts/{post_id}/comments`(목록, 정렬 토글 — 오래된순 기본 /
  최신순), `POST /api/posts/{post_id}/comments`(작성),
  `PATCH /api/comments/{id}`(작성자 본인 수정), `DELETE /api/comments/{id}`(작성자
  본인 삭제). 작성자는 active user selection(`user_id`).
- **작성자 신원 표시**: 각 댓글에 작성자 account의 `display_name`/avatar를
  `AccountRead`로 렌더(누가 썼는지 보이게).
- **본문 렌더**: 댓글 텍스트의 `@mention`(계정 링크)과 `#hashtag`(`/posts?tag=`
  필터 링크)를 공용 파서로 표시(렌더만, 저장 없음 → format·도메인 안전).
  `MentionText`가 caption·댓글 양쪽에서 쓰여 앱 전역 적용. v0.5.2 mention 수신과 연결.
- **카드 댓글 수 칩**: `FeedCard`에 댓글 수(`💬 N`)를 표시해 "논의가 붙은 post"를
  트리아지 신호로 노출. 집계는 `GROUP BY post_id` count(`get_top_tags` 패턴).
- frontend: PostDetail 댓글 섹션(목록 + 작성 폼 + 본인 댓글 수정/삭제 +
  로딩/0건/실패 상태). **API mode 전용**.
- 회귀 안전: post 조회/필터/정렬 경로 불변. 댓글은 별도 테이블·라우트.

확정(구현 완료):
- 평면(flat) 댓글만. 대댓글 threading은 non-goal.
- 댓글·caption 본문에 `@mention`(계정 링크) + `#hashtag`(`/posts?tag=` 링크)
  렌더(저장 없음, 공용 `MentionText`로 앱 전역 적용).
- 작성자 수정 허용(`updated_at` + `PATCH`). 타인 댓글 수정/삭제는 불가
  (active user = 작성자 체크, authorization 시스템 아님 — v0.6.x).

### v0.5.1 — Bookmarks (+ Me 탭 목록)

목표: 나중에 볼 post를 개인적으로 표시·메모하고, Me 탭에서 모아 본다.

- 신규 `bookmarks` 테이블(`0008`): `id` PK, `user_id` FK, `post_id` FK,
  `note`(optional 텍스트, 개인 메모), `created_at`,
  `UniqueConstraint(user_id, post_id)`. follow/unfollow 동형 + annotation용
  `note` 1컬럼.
- API: `POST`/`DELETE /api/bookmarks`(추가/제거, 토글), `PATCH`로 `note` 편집,
  `GET /api/bookmarks?user_id=...`(내 북마크 목록, cursor pagination 재사용).
- **목록 필터/정렬 재사용**: 북마크 목록은 "저장한 post의 부분집합"이므로 v0.4.x
  facet 필터·metadata 정렬(`paginate_posts`)을 그대로 얹습니다(bookmark scope를
  base select에 더하는 형태). v0.4.x 투자를 그대로 재활용.
- **`bookmarked_only` 피드 필터**: `PostFilters`에 `my_posts_only`와 동형 플래그를
  추가해 메인 피드에서 "북마크만" 보기.
- **비공개 메모(annotation)**: 북마크에 개인 메모를 달아 테마의 "Annotation"
  축을 채웁니다. 메모는 소유자에게만 보이는 generic 텍스트(도메인 의미 없음).
- frontend: PostCard/PostDetail 북마크 토글 + 메모 입력, Me 탭 "북마크" 목록
  섹션(필터/정렬 적용).
- **이연된 UX backlog 항목 동시 처리**: Me 탭 "내가 팔로우한 계정" 목록
  (`UX_BACKLOG.md` Open 1건, v0.2.3에서 v0.5.x로 이연). 북마크 목록과 같은 Me 탭
  작업이라 함께 붙입니다. 우측 레일 FollowShortcuts와 중복되지 않게 진입 형태를
  scope에서 정리.
- **API mode 전용**.

### v0.5.2 — In-app 알림 & mention 수신

목표: 내가 봐야 할 변화(새 post·새 댓글·나를 언급)를 앱 안에서 모아 본다.
확정 scope는 `V0_5_2_NOTIFICATIONS_SCOPE.md`를 기준으로 한다.

- **mention 수신**: "나를 언급한 목록". post 본문뿐 아니라 **댓글 본문의**
  `@myhandle`도 스캔합니다(v0.5.0 댓글 mention 렌더와 일관). 패턴 쿼리로 파생
  가능(저장 테이블 없이 — format 동결 안전). v0.1.3 렌더 규칙과 같은 패턴을
  backend 쿼리에 재사용. Me 탭/알림에 노출.
- **in-app 알림**: (1) 팔로우 계정의 새 post, (2) 내 post의 새 댓글, (3) 나를
  언급한 새 post/댓글.
- **읽음 처리 / 모두 읽음**: 알림 항목에 읽음 상태와 "모두 읽음" 액션을 둡니다.
  읽음 상태를 서버에 영속하려면 순수 파생보다 약한 저장형이 유리(아래 결정 참고).
- **Home Feed unread / since-last-visit 표시**: 마지막 방문 시각 이후 새 항목
  배지/구분선.
- **API mode 전용**.

확정(구현 완료):
- 알림 item 자체는 저장하지 않고 post/comment/follow/text에서 파생한다. 읽음 상태는
  신규 `notification_state` 테이블의 user별 `last_read_at` 워터마크로 저장한다.
- 같은 source(`post:{id}` / `comment:{id}`)가 여러 이유에 걸리면 하나의 item에
  `reasons`를 병합한다.
- `/notifications` route, SideNav unread badge, Home unread 진입, Me 탭 Mentions
  요약을 제공한다. push/websocket/외부 채널은 non-goal 유지.

확정 결정:
- 알림 저장 방식: **파생 item + user별 `last_read_at` 워터마크**로 확정했습니다.
- 실시간 push/websocket은 범위 밖(조회/폴링 기반).

### v0.5.3 — UX backlog 반영 (테마 마지막 MINOR, 예약 슬롯)

`ROADMAP.md` 규칙대로 테마 마지막 MINOR는 `UX_BACKLOG.md` 반영용으로 예약.
이 테마(댓글/북마크/알림) 작업 중 새로 쌓이는 UX 항목을 모아 반영하고, 테마 완료
문서를 일괄 정리합니다. (Me 탭 Following 목록은 v0.5.1에서 처리하므로, 그때까지
backlog Open 유지 후 Resolved로 이동.)

## 4. v0.5.x 협업 정책 (재확인)

```text
인증/JWT/session/OAuth는 범위 밖 (v0.6.x). 작성자/소유자/수신자는 prototype
  active user selection으로 식별 (MVP8 1:1 ownership 체크 패턴, real auth 아님)
Comment·Bookmark·Notification은 generic 협업 개념이라 새 core type으로 허용한다
  (설비 전용 용어 Chamber/Recipe/Severity와 다름 — 도메인 값은 계속 metadata로)
협업 데이터는 앱 내부 사용자 행동이며 external package format을 바꾸지 않는다
mock mode는 데모 전용 동결 (제거하지 않음). 협업 기능은 API mode 전용
새 추상화 전에 기존 패턴을 따른다 (Follow join 테이블 / follows 라우트 /
  paginate_posts cursor / 1:1 ownership 체크)
```

## 5. v0.5.x non-goals

```text
인증/로그인/권한 시스템 (v0.6.x)
like / reaction — 북마크 사용 양상을 본 뒤 별도 결정 (ROADMAP)
북마크 폴더/컬렉션 — 사용 양상 본 뒤 post-theme 후보로 이연
외부 알림 채널 (메일, 메신저) — "그 이후 후보"
실시간 push / websocket (in-app 조회/폴링 기반까지)
댓글 대댓글(threading) / 리치 텍스트 / 멘션 자동완성 (평면 댓글 + 렌더만)
external package에 댓글/북마크 싣기 (format 변경 필요 → 범위 밖)
mock mode 협업 UI
```

## 6. 진입 전 권장 정리 (선택)

진행에 필수는 아니지만 v0.5.x 작업 품질을 높이는 정리:

- 새 테이블/쓰기 라우트가 늘어나므로, follow/unfollow 라우트의 ownership·검증
  패턴을 댓글/북마크 라우트가 그대로 따르도록 합니다(새 권한 추상화를 만들지
  않음 — v0.6.x 인증에서 일괄 처리).
- 새 협업 API에 대해 기존 `check_*` 패턴의 회귀 스크립트(예:
  `check_comments.py`)를 함께 두는 것을 권장합니다.
- `RELEASE_0_0_RUNBOOK.md`/`RELEASE_0_0_CHECKLIST.md`는 현재 릴리즈 기준으로
  유지됩니다. 협업 기능 추가 시 새 API 경로를 checklist에 반영합니다.

## 7. 다음 행동

1. v0.5.3 착수 시 `UX_BACKLOG.md`의 Open 항목과 v0.5.x 구현 중 발견한 UX 항목을
   확인해 `V0_5_3_*_SCOPE.md`를 작성한다.
2. v0.5.3에서는 협업 테마 마지막 MINOR 규칙대로 UX backlog 반영과 테마 완료 문서
   정리를 수행한다.
3. v0.5.3 완료 후 v0.5.x 테마 문서를 archive 이동 대상으로 정리하고, 다음 테마
   v0.6.x(Auth & Multi-user) 진입 판단으로 넘어간다.
