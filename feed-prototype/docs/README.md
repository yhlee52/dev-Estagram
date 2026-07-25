# feed-prototype 문서

현재 릴리즈: `v1.0.0`(배포 가능한 제품 기준선). v1.0.0 전제(v0.1 읽기확장 + v0.3
ingestion + v0.6 인증)가 갖춰진 뒤 보안 하드닝 Must-do(session 기반 write 인가,
cookie `secure`/CORS 환경설정, 로그인 화면 user 목록 제거, import-user password
정책)와 Stabilization(회귀 스크립트 12개 실행 확인, `APP_VERSION` bump)을 모두
**완료**했습니다. 상세는 `V1_0_0_RELEASE_SCOPE.md`를 참고하세요.

v0.6.x 요약: v0.6.0 password 로그인 + server-side session(httpOnly cookie, active
user를 세션 user 조회로 대체), v0.6.1 User:Account 1:1 identity 운영 정책 고정, v0.6.2
내 account profile self-service(`display_name`/`bio`/`avatar_url` 수정, 식별자 고정,
`profile_source=user` 보존), v0.6.3 auth hardening & cleanup(운영자 password reset CLI,
세션 만료 시 401→로그인 복귀, 로그인 화면 dead code 정리), v0.6.4 계정 라이프사이클
(soft deactivation + post 보존 — 세션 폐기/로그인 차단/discovery 제외, 신규 follow 차단,
운영자 재활성화 CLI). 인증 기능은 **API mode 전용**, external package format 무변경.
계정 명령어 모음은 `ACCOUNT_MANAGEMENT.md`를 참고하세요.

직전 테마 v0.5.x(협업 — Annotation & Collaboration)는 v0.5.0 댓글, v0.5.1 북마크/비공개
메모, v0.5.2 in-app 알림/mention, v0.5.3 UX wrap-up으로 완료되었습니다. 그 이전
v0.1.x(탐색)·v0.2.x(레이아웃)·v0.3.x(Ingestion)·v0.4.x(메타데이터 트리아지)도 모두
완료되었습니다. 완료된 v0.x 테마와 MVP-era의 상세 scope/test 문서는 저장소 정리로
제거되었으며, 필요 시 git history에서 확인합니다.

## 현행 문서 (먼저 볼 것)

- `../README.md`: mock mode, API mode, external import mode 실행 guide
- `ROADMAP.md`: v0.0.0 이후 업데이트 로드맵 (버전 트리, 테마별 scope)
- `ACCOUNT_MANAGEMENT.md`: 계정 관리 명령어 — operator CLI(seed/reset_password/
  reactivate_user) + self-service HTTP API(가입/로그인/profile/비활성화) 모음
- `V1_0_0_RELEASE_SCOPE.md`: v1.0.0(배포 가능한 제품 기준선) must-do/안정화/태그 조건
- `EXTERNAL_POST_PACKAGE_GUIDE.md`: external post package 작성 guide (format 중심)
- `GOLDEN_SAMPLE_REGRESSION.md`: external package golden sample dry-run 회귀 안내
- `S3_INGESTION_ARCHITECTURE.md`: S3/MinIO ingestion 전체 아키텍처(Mermaid
  sequence·state diagram, object layout, immutability, asset URL 정책, 보안) — v1.2.x
- `MINIO_LOCAL_DEV.md`: 집 개발환경용 로컬 MinIO 설정 + producer→worker→feed
  end-to-end runbook — v1.2.x
- `S3_VERIFICATION_RUNBOOK.md`: **DB 초기화부터 내 파일을 S3(MinIO)로 검증**까지
  전체 통합 runbook (권장 시작점) — v1.2.x
- `UX_BACKLOG.md`: 사용 중 발견한 UX 불편/아이디어 기록 backlog
- `../data/external_posts/README.md`: external post package 작업 guide

v1.2.x(외부/객체 스토리지 Ingestion) 각 MINOR의 상세 scope는
`V1_2_0_S3_STORAGE_SCOPE.md` ~ `V1_2_5_THEME_WRAPUP_SCOPE.md` 를 참고합니다.

> 정리 메모: v0.x 테마·MVP-era의 버전별 scope/test/release 문서(구 `archive/`)와
> v0.0.0 릴리즈 문서(`RELEASE_0_0_*`)는 저장소 정리로 제거했습니다. 과거 내용이
> 필요하면 git history에서 확인합니다.
