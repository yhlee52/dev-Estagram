# V0_5_3_UX_BACKLOG_SCOPE.md

`feed-prototype` v0.5.3 — **UX Backlog & Collaboration Theme Wrap-up** 상세 scope
문서입니다.

> 구현 상태(2026-06-16): **완료**. 앱 라벨은 `v0.5.3`.

`ROADMAP.md`의 규칙에 따라 각 MIDDLE 테마의 마지막 MINOR는 `UX_BACKLOG.md`에 쌓인
UX feedback을 모아 반영합니다. v0.5.x(협업 — Annotation & Collaboration) 테마에서는
v0.5.0 댓글, v0.5.1 북마크, v0.5.2 알림/mention 수신이 완료되었고, v0.5.3은 이
협업 표면을 한 번 정리한 뒤 테마 완료 상태로 넘기는 마지막 슬롯입니다.

## 배경

현재 `UX_BACKLOG.md`의 Open 항목은 없습니다(2026-06-16 확인). 따라서 v0.5.3은
대형 신규 기능을 추가하지 않고, 다음 세 가지를 중심으로 진행합니다.

- v0.5.x에서 새로 생긴 협업 표면(댓글/북마크/알림/Me 탭)의 작은 UX 마찰 audit
- 현재 릴리즈 문서와 검증 절차를 v0.5.3 기준으로 정리
- v0.5.x 테마 완료 준비(완료 후 archive 이동 대상과 v0.6.x 진입 판단이 선명하도록)

완료 시 반영한 작은 UX polish:

- `/notifications` Unread 탭 empty state를 전체 알림 0건과 분리했습니다.
- `/notifications` Mark all read 버튼을 알림 로딩 중에도 비활성화했습니다.
- `/me` Bookmarks empty state 문구를 데스크톱/포인터 환경에도 자연스럽게 정리했습니다.

## 확정된 결정 (2026-06-16)

- **신규 core feature 없음.** v0.5.3은 테마 마지막 UX/documentation MINOR입니다.
- **Open backlog가 비어 있으면 audit 중심으로 진행.** UX_BACKLOG에 없는 큰 기능을
  임의로 끼워 넣지 않습니다.
- **협업 기능은 계속 API mode 전용.** mock mode는 데모 전용 동결 상태를 유지합니다.
- **external package format 무변경.** v0.5.x 협업 데이터는 앱 내부 사용자 행동입니다.
- **인증/권한은 여전히 범위 밖.** v0.6.x 전까지 active user selection 정책을 유지합니다.

## Goals

### 1. UX backlog audit

- `UX_BACKLOG.md` Open 항목을 확인합니다.
- v0.5.0~v0.5.2 구현 표면을 빠르게 훑어 즉시 반영할 만한 작은 UX 마찰만 처리합니다.
- 반영한 항목은 `UX_BACKLOG.md` Resolved에 `v0.5.3`으로 기록합니다.
- 새로 발견했지만 v0.5.3 범위를 넘는 항목은 Open에 남깁니다.

점검 대상:

- PostDetail 댓글 섹션: 작성/수정/삭제, empty/loading/error, mention/hashtag 렌더.
- 카드/상세/Me 북마크: 토글 상태, private note 저장, Me 목록의 빈/오류 상태.
- `/notifications`: unread/all 토글, mark-all-read, empty/loading/error, post detail 진입.
- Home Feed unread 진입과 SideNav unread badge.
- Me 탭 Following/Bookmarks/Mentions 섹션의 순서와 정보 밀도.

### 2. 문서 정리

- `README.md`, `feed-prototype/README.md`, `docs/README.md`의 현재 릴리즈 설명을
  v0.5.x 기준으로 맞춥니다.
- `ROADMAP.md`와 `V0_5_X_COLLABORATION_PLAN.md`가 v0.5.0~v0.5.3 완료 상태를 정확히
  나타내도록 정리합니다.
- `RELEASE_0_0_RUNBOOK.md`와 `RELEASE_0_0_CHECKLIST.md`의 오래된 v0.3.5 기준 문구를
  현재 릴리즈 기준으로 갱신합니다.
- v0.5.x 회귀 스크립트(`check_comments.py`, `check_bookmarks.py`,
  `check_notifications.py`)와 `TestClient` 의존성 주의사항을 검증 문서에 반영합니다.

### 3. 검증 절차 정리

- `npm run build`는 계속 handoff 전 필수 검증입니다.
- Python syntax/import 수준 검증과 Alembic migration 적용 절차를 문서화합니다.
- `check_notifications.py` 실행에는 현재 환경에서 `starlette.testclient`가 요구하는
  `httpx2` package가 필요할 수 있음을 명시합니다.

### 4. 테마 완료 준비

- v0.5.3 완료 시 `appVersion.ts`를 `v0.5.3`으로 올립니다.
- v0.5.x 테마 완료 문구를 `ROADMAP.md`, `docs/README.md`, `AGENTS.md`에 반영합니다.
- v0.5.x scope/plan 문서는 완료 테마 archive 이동 후보가 됩니다. 실제 archive 이동은
  v0.5.3 완료 시점에 수행합니다.

## Non-goals

```text
새 협업 feature 추가 (reaction/like, bookmark folder, notification channel 등)
실시간 push / websocket / browser notification
인증/로그인/권한 시스템 (v0.6.x)
mock mode 협업 UI 추가
external package format 변경
대규모 UI redesign / layout 재편
```

## 검증 요약

1. `UX_BACKLOG.md` Open/Resolved 상태가 v0.5.3 반영 결과와 일치합니다.
2. 현재 릴리즈 문서가 v0.5.3 완료 상태를 혼동 없이 설명합니다.
3. `npm run build` 통과.
4. 가능한 환경에서는 `check_comments.py`, `check_bookmarks.py`, `check_notifications.py`
   회귀 스크립트 실행. 실행 불가 시 missing dependency나 DB 조건을 handoff에 명시.
5. v0.5.3 완료 후 `APP_RELEASE_LABEL`이 `v0.5.3`으로 갱신됩니다.
