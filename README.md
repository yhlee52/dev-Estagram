# feed-prototype

로컬 PC에서 테스트 계정과 데이터를 사용해 소셜 피드 기능을 확인하는 Vite + React +
TypeScript / FastAPI + PostgreSQL 프로젝트입니다. 온라인 서비스나 별도 객체 스토리지
서버를 전제로 하지 않습니다.

## 빠른 시작

Windows PowerShell 기준 전체 순서는 [로컬 실행 가이드](feed-prototype/docs/QUICK_RUN_GUIDE_LOCAL.md)에
있습니다. 핵심은 다음 네 가지입니다.

1. 로컬 PostgreSQL에 데이터베이스를 만들고 `backend/.env`의 `DATABASE_URL`을 설정합니다.
2. `EXTERNAL_POSTS_DIR`에 원하는 데이터 폴더를 지정합니다. 기본값은
   `feed-prototype/data/external_posts`입니다.
3. backend에서 `python -m alembic upgrade head`, `python -m app.services.seed`,
   `python -m uvicorn app.main:app --reload`를 실행합니다.
4. frontend의 `VITE_DATA_SOURCE=api`를 설정하고 `npm.cmd run dev`를 실행합니다.

외부 프로그램의 게시글 패키지는 데이터 폴더의 `incoming/`에 넣고 backend에서
`python -m app.services.process_incoming --watch`를 실행합니다. 성공한 패키지는
`archive/`, 실패한 패키지는 `failed/`로 이동합니다. 상대 경로 자산은 같은 데이터
폴더의 `assets/`에 복사되어 FastAPI가 제공합니다.

## 현재 기능

- 비밀번호 로그인과 세션, 1:1 User/Account, 프로필 및 팔로우
- 게시글·자산·댓글·북마크·알림, 좋아요와 1:1 텍스트 메시지
- 검색·필터·페이지네이션과 로컬 폴더/HTTP/CLI 게시글 import
- 정적 mock 모드(UI 데모)와 PostgreSQL API 모드

현재 화면의 릴리즈 라벨은 [appVersion.ts](feed-prototype/src/config/appVersion.ts)의
`APP_RELEASE_LABEL`을 따릅니다. 로컬 실행과 기능별 자세한 설명은
[앱 README](feed-prototype/README.md), 문서 목록은
[문서 색인](feed-prototype/docs/README.md)에 있습니다.
