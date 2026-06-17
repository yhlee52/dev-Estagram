# feed-prototype 문서

현재 릴리즈: `v0.5.3` (협업 — Annotation & Collaboration 테마 **완료**). v0.5.0은
post별 평면 댓글(작성/조회/수정/삭제, 작성자 신원, 본문 `@mention`·`#hashtag` 렌더,
카드 댓글 수 칩), v0.5.1은 북마크(post 토글 + 비공개 메모 + Me 탭 북마크/Following
목록 + 메인 Browse `bookmarked_only` 필터), v0.5.2는 in-app 알림/mention 수신
(파생 알림 + user별 읽음 워터마크 + `/notifications` + Home/Me 진입점), v0.5.3은
협업 표면 UX polish와 문서/검증 절차 wrap-up입니다. 협업 기능은 **API mode 전용**,
external package format 무변경. 상세는 `archive/V0_5_0_COMMENTS_SCOPE.md`·
`archive/V0_5_1_BOOKMARKS_SCOPE.md`·`archive/V0_5_2_NOTIFICATIONS_SCOPE.md`·
`archive/V0_5_3_UX_BACKLOG_SCOPE.md`, 테마 진입 판단·후보 계획은
`archive/V0_5_X_COLLABORATION_PLAN.md`를 참고하세요.

직전 테마 v0.4.x(메타데이터 일급화 & 트리아지)는 v0.4.0 facet 기반 필터(데이터
파생 key/value 선택 `GET /api/metadata/keys`·`/values`, facet 선택 정확일치
`metadata_match=exact`) → v0.4.1 카드 metadata 칩(pinned keys, localStorage) + 값
정렬(텍스트 사전순, key 보유 post 한정, cursor 안정) → v0.4.2 UX 정리(카드
metadata 중복 제거 + 정렬 기대치 안내 + 문서 일괄 갱신)로 **완료**. v0.4.x 진입
판단·후보(`archive/V0_4_X_METADATA_PLAN.md`)와 각 MINOR scope 문서
(`archive/V0_4_0_FACET_FILTER_SCOPE.md` ~ `archive/V0_4_2_UX_BACKLOG_SCOPE.md`)는
`archive/`로 이동했습니다(아래 Archive 섹션). 그 직전 v0.3.x(Ingestion 신뢰성)는
v0.3.4로 완료(v0.3.5 운영 안정화 patch), v0.1.x·v0.2.x와 함께 `archive/`에 보관.

## 현행 문서 (먼저 볼 것)

- `../README.md`: mock mode, API mode, external import mode 실행 guide
- `ROADMAP.md`: v0.0.0 이후 업데이트 로드맵 (버전 트리, 테마별 scope)
- `V0_6_0_AUTH_SCOPE.md`: v0.6.0 password login + server-side session 구현 전 확정 scope
- `V0_6_1_ACCOUNT_IDENTITY_SCOPE.md`: v0.6.1 User:Account 1:1 identity 운영 정책 scope
- `EXTERNAL_POST_PACKAGE_GUIDE.md`: external post package 작성 guide (format 중심)
- `GOLDEN_SAMPLE_REGRESSION.md`: external package golden sample dry-run 회귀 안내
- `UX_BACKLOG.md`: 사용 중 발견한 UX 불편/아이디어 기록 backlog
- `../data/external_posts/README.md`: external post package 작업 guide

## 릴리즈 운영 문서 (current release 기준, v1.0.0 안정화 단계까지 유지)

파일명은 v0.0.0 시점 이름을 유지하지만, 내용은 항상 현재 릴리즈(`v0.5.3`) 기준으로
갱신됩니다. v0.0.0 시점 historical 사본은 `archive/`에 보관합니다.

- `RELEASE_0_0_RUNBOOK.md`: 현재 릴리즈 기준 local 실행 재현 runbook
  (mock / API / 외부 데이터 — 단일 파일 CLI·HTTP·디렉터리 일괄 처리·Watch·managed storage)
- `RELEASE_0_0_CHECKLIST.md`: 현재 릴리즈 기준 릴리즈 직전 체크리스트

## Archive (완료 테마 / historical 참고)

완료된 테마의 scope 문서와 MVP-era 참고 문서, v0.0.0 historical 문서는 `archive/`
아래에 회귀 확인·기록 용도로 보관합니다. primary entry point가 아니며, 특정 회귀를
확인하는 경우가 아니라면 위의 현행 문서를 먼저 사용합니다.

완료 테마 scope 문서:

- `archive/V0_1_0_READ_AT_SCALE_SCOPE.md` ~ `archive/V0_1_3_MENTION_SCOPE.md`:
  v0.1.x(탐색과 발견) — pagination/날짜 필터/정렬/URL 동기화, 해시태그, 검색,
  @mention scope
- `archive/V0_2_0_DESKTOP_LAYOUT_SCOPE.md` ~ `archive/V0_2_3_TAB_ACTIVATION_2_SCOPE.md`:
  v0.2.x(레이아웃 & UI 개편) — 3컬럼 레이아웃, 헤더/검색 정리, Explore/Accounts/Me
  탭 활성화 scope
- `archive/V0_3_X_INGESTION_PLAN.md` + `archive/V0_3_0_HTTP_IMPORT_SCOPE.md` ~
  `archive/V0_3_4_UX_BACKLOG_SCOPE.md`: v0.3.x(Ingestion 신뢰성) — 진입 판단/후보
  계획과 HTTP import, Import Batch 이력, 자동 이동/일괄 처리/Watch, asset managed
  storage 복사(opt-in), UX backlog 반영 scope
- `archive/V0_4_X_METADATA_PLAN.md` + `archive/V0_4_0_FACET_FILTER_SCOPE.md` ~
  `archive/V0_4_2_UX_BACKLOG_SCOPE.md`: v0.4.x(메타데이터 일급화 & 트리아지) —
  진입 판단/후보 계획과 facet 기반 필터, 카드 metadata 칩 & 값 정렬, UX backlog
  반영 scope
- `archive/V0_5_X_COLLABORATION_PLAN.md` + `archive/V0_5_0_COMMENTS_SCOPE.md` ~
  `archive/V0_5_3_UX_BACKLOG_SCOPE.md`: v0.5.x(협업 — Annotation & Collaboration) —
  댓글, 북마크/비공개 메모, in-app 알림/mention 수신, UX backlog/theme wrap-up scope

MVP-era 참고 문서:

- `archive/MVP10_EXTERNAL_POST_FORMAT.md`: MVP10 external post format history와 상세 참고
- `archive/MVP12_ASSET_VIEWER_SCOPE.md`: MVP12 asset viewer scope 상세 참고

historical MVP validation / v0.0.0 문서:

- `archive/MVP9_TEST_PROCEDURE.md`
- `archive/MVP10_TEST_PROCEDURE.md`
- `archive/MVP11_TEST_PROCEDURE.md`
- `archive/MVP12_TEST_PROCEDURE.md`
- `archive/RELEASE_CHECKLIST_v0.0.0.md`
- `archive/SMOKE_TEST_v0.0.0.md`
