# feed-prototype 문서

현재 릴리즈: `v0.6.4` (인증 & 멀티유저 — Auth & Multi-user 테마 **완료**). 이로써
v1.0.0 전제(v0.1 읽기확장 + v0.3 ingestion + v0.6 인증)가 갖춰져, "배포 가능한 제품
기준선"인 v1.0.0 마일스톤을 **개시**했습니다(태그 전 하드닝/안정화는
`V1_0_0_RELEASE_SCOPE.md`).

v0.6.x 요약: v0.6.0 password 로그인 + server-side session(httpOnly cookie, active
user를 세션 user 조회로 대체), v0.6.1 User:Account 1:1 identity 운영 정책 고정, v0.6.2
내 account profile self-service(`display_name`/`bio`/`avatar_url` 수정, 식별자 고정,
`profile_source=user` 보존), v0.6.3 auth hardening & cleanup(운영자 password reset CLI,
세션 만료 시 401→로그인 복귀, 로그인 화면 dead code 정리), v0.6.4 계정 라이프사이클
(soft deactivation + post 보존 — 세션 폐기/로그인 차단/discovery 제외, 신규 follow 차단,
운영자 재활성화 CLI). 인증 기능은 **API mode 전용**, external package format 무변경.
상세 scope는 `archive/V0_6_0_AUTH_SCOPE.md` ~ `archive/V0_6_4_ACCOUNT_LIFECYCLE_SCOPE.md`,
계정 명령어 모음은 `ACCOUNT_MANAGEMENT.md`를 참고하세요.

직전 테마 v0.5.x(협업 — Annotation & Collaboration)는 v0.5.0 댓글, v0.5.1 북마크/비공개
메모, v0.5.2 in-app 알림/mention, v0.5.3 UX wrap-up으로 완료되어 `archive/`에 보관되어
있습니다. 그 이전 v0.1.x(탐색)·v0.2.x(레이아웃)·v0.3.x(Ingestion)·v0.4.x(메타데이터
트리아지)도 모두 완료되어 `archive/`에 있습니다(아래 Archive 섹션).

## 현행 문서 (먼저 볼 것)

- `../README.md`: mock mode, API mode, external import mode 실행 guide
- `ROADMAP.md`: v0.0.0 이후 업데이트 로드맵 (버전 트리, 테마별 scope)
- `ACCOUNT_MANAGEMENT.md`: 계정 관리 명령어 — operator CLI(seed/reset_password/
  reactivate_user) + self-service HTTP API(가입/로그인/profile/비활성화) 모음
- `V1_0_0_RELEASE_SCOPE.md`: v1.0.0(배포 가능한 제품 기준선) must-do/안정화/태그 조건
- `EXTERNAL_POST_PACKAGE_GUIDE.md`: external post package 작성 guide (format 중심)
- `GOLDEN_SAMPLE_REGRESSION.md`: external package golden sample dry-run 회귀 안내
- `UX_BACKLOG.md`: 사용 중 발견한 UX 불편/아이디어 기록 backlog
- `../data/external_posts/README.md`: external post package 작업 guide

## 릴리즈 운영 문서 (current release 기준, v1.0.0 안정화 단계까지 유지)

파일명은 v0.0.0 시점 이름을 유지하지만, 내용은 항상 현재 릴리즈(`v0.6.4`) 기준으로
갱신됩니다. v0.0.0 시점 historical 사본은 `archive/`에 보관합니다.

- `RELEASE_0_0_RUNBOOK.md`: 현재 릴리즈 기준 local 실행 재현 runbook
  (mock / API(로그인+세션) / 외부 데이터 — 단일 파일 CLI·HTTP·디렉터리 일괄 처리·Watch·managed storage)
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
- `archive/V0_6_0_AUTH_SCOPE.md` ~ `archive/V0_6_4_ACCOUNT_LIFECYCLE_SCOPE.md`:
  v0.6.x(인증 & 멀티유저) — password 로그인+세션, User:Account 1:1 identity 정책,
  profile self-service, auth hardening/운영 reset, 계정 라이프사이클(비활성화/재활성화)
  scope. 운영 관점 명령어 요약은 현행 `ACCOUNT_MANAGEMENT.md` 참고.

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
