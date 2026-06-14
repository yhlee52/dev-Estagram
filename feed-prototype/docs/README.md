# feed-prototype 문서

현재 릴리즈: `v0.2.3` (탭 활성화 2 + UX backlog 반영). v0.2.x(레이아웃 & UI 개편)
테마 완료. 다음 테마는 v0.3.x(Ingestion 신뢰성) — 진입 판단과 후보는
`V0_3_X_INGESTION_PLAN.md` 참고.

먼저 볼 문서:

- `../README.md`: mock mode, API mode, external import mode 실행 guide
- `ROADMAP.md`: v0.0.0 이후 업데이트 로드맵 (버전 트리, 테마별 scope)
- `V0_1_0_READ_AT_SCALE_SCOPE.md`: v0.1.0 Read at Scale 상세 scope (pagination,
  날짜 필터, 정렬, URL 동기화, JSONB+GIN)
- `V0_1_1_HASHTAG_SCOPE.md`: v0.1.1 해시태그 활성화 상세 scope (태그 칩 클릭
  링크 `/posts?tag=<tag>`)
- `V0_1_2_HASHTAG_SEARCH_SCOPE.md`: v0.1.2 해시태그 검색 최적화 상세 scope
  (검색창 `#` → tag 라우팅, `GET /api/tags`, tag 자동완성)
- `V0_1_3_MENTION_SCOPE.md`: v0.1.3 @mention 렌더링 상세 scope (post 본문
  `@handle` → Account Profile 링크, 존재하지 않는 handle은 plain text fallback)
- `V0_2_0_DESKTOP_LAYOUT_SCOPE.md`: v0.2.0 데스크톱 3컬럼 레이아웃 상세 scope
  (좌측 네비 레일 + 중앙 feed + 우측 컨텍스트 레일, PC 전용 전제)
- `V0_2_1_HEADER_SEARCH_SCOPE.md`: v0.2.1 헤더/검색창 정리 상세 scope (한 줄
  헤더, 아바타 드롭다운 UserMenu, Switch user 단일화)
- `V0_2_2_TAB_ACTIVATION_1_SCOPE.md`: v0.2.2 탭 활성화 1 상세 scope (Posts→Explore
  태그 진입점, Accounts 활동 신호·정렬)
- `V0_2_3_TAB_ACTIVATION_2_SCOPE.md`: v0.2.3 탭 활성화 2 + UX backlog 상세 scope
  (Me 탭 mock/API 내 활동·post 관리, empty state Reset filters)
- `V0_3_X_INGESTION_PLAN.md`: v0.3.x(Ingestion 신뢰성) 진입 판단과 0.3.0~0.3.2
  후보 계획
- `GOLDEN_SAMPLE_REGRESSION.md`: external package golden sample dry-run 회귀 안내
- `RELEASE_0_0_RUNBOOK.md`: v0.0.0 local 실행 재현 runbook
- `EXTERNAL_POST_PACKAGE_GUIDE.md`: v0.0.0 / MVP12 external post package 작성 guide
- `RELEASE_0_0_CHECKLIST.md`: v0.0.0 릴리즈 직전 체크리스트
- `UX_BACKLOG.md`: 사용 중 발견한 UX 불편/아이디어 기록 backlog
- `../data/external_posts/README.md`: external post package 작업 guide
- `MVP10_EXTERNAL_POST_FORMAT.md`: MVP10 format history와 상세 참고
- `MVP12_ASSET_VIEWER_SCOPE.md`: MVP12 asset viewer scope 상세 참고

이 폴더의 historical MVP validation 문서는 `archive/` 아래에 회귀 확인용 참고 문서로 유지합니다.

- `archive/MVP9_TEST_PROCEDURE.md`
- `archive/MVP10_TEST_PROCEDURE.md`
- `archive/MVP11_TEST_PROCEDURE.md`
- `archive/MVP12_TEST_PROCEDURE.md`
- `archive/RELEASE_CHECKLIST_v0.0.0.md`
- `archive/SMOKE_TEST_v0.0.0.md`

archived 문서는 v0.0.0 release의 primary entry point가 아닙니다. 특정 MVP regression을 확인하는 경우가 아니라면 runbook, external package guide, release checklist를 먼저 사용합니다.
