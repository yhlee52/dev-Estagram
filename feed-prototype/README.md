# feed-prototype

로컬 PC에서 테스트 계정과 게시글을 넣어 소셜 피드 기능을 확인하는 앱입니다. frontend는
Vite + React + TypeScript, backend는 FastAPI + PostgreSQL입니다. 현재 릴리즈 라벨은
`src/config/appVersion.ts`를 따릅니다.

## 실행 모드

- **API**: 로그인, 게시글·댓글·좋아요·메시지 등 실제 기능을 확인합니다. PostgreSQL과
  FastAPI가 필요합니다.
- **Mock**: `src/data`의 정적 데이터를 보는 UI 데모입니다. 로그인·인가나 새 기능의
  동작 검증에는 사용하지 않습니다.

설치와 순서는 [로컬 실행 가이드](docs/QUICK_RUN_GUIDE_LOCAL.md)를 따르세요.

## 로컬 데이터 위치

`backend/.env`에서 `EXTERNAL_POSTS_DIR`을 원하는 절대 경로로 지정합니다. 지정하지
않으면 `data/external_posts`를 사용합니다.

```text
EXTERNAL_POSTS_DIR=C:/feed-data
```

폴더 구조는 다음과 같습니다.

```text
C:/feed-data/
  incoming/     # 새 JSON 파일 또는 feed_posts.json이 있는 배치 폴더
  archive/      # import 성공 후 이동
  failed/       # import 실패 후 이동
  assets/       # 상대 경로 자산의 관리 복사본
```

`incoming/`에 넣는 패키지는 [동결된 JSON 형식](docs/EXTERNAL_POST_PACKAGE_GUIDE.md)을
따릅니다. 파일을 쓴 뒤 완성된 패키지를 이동해 두면 감시 프로세스가 미완성 파일을
읽을 위험이 줄어듭니다. 기존 `external_id`를 유지하면 재import는 같은 항목을
갱신합니다.

```powershell
cd feed-prototype/backend
python -m app.services.process_incoming --base-dir C:/feed-data --dry-run
python -m app.services.process_incoming --base-dir C:/feed-data
python -m app.services.process_incoming --base-dir C:/feed-data --watch --interval 10
```

상대 경로 자산(예: `assets/photo.png`)은 패키지 폴더 안에서 찾아
`EXTERNAL_POSTS_DIR/assets/`로 복사하며 FastAPI가 제공합니다. `/assets/...`나
`https://...` URL은 변경하지 않습니다. 디스크 파일이 없는 HTTP import는 자산을
복사할 수 없습니다. 로컬 자산 복사는 기본으로 켜져 있으며
`MANAGE_ASSET_STORAGE=false`로 끌 수 있습니다.

## 주요 기능

계정별 피드·팔로우, 게시글 작성/수정/삭제, 댓글, 북마크, 좋아요, 앱 내 알림,
1:1 텍스트 메시지, 태그·metadata 검색/필터, 자산 미리보기, import 이력이
있습니다. API write 요청은 로그인 세션의 사용자를 기준으로 처리합니다.

## 설정과 검증

- Backend: `backend/.env.example`을 `backend/.env`로 복사하고 `DATABASE_URL`,
  `EXTERNAL_POSTS_DIR`을 설정합니다.
- Frontend: `.env.example`을 `.env`로 복사해 `VITE_DATA_SOURCE=api`,
  `VITE_API_BASE_URL=http://127.0.0.1:8000`을 설정합니다.
- 같은 PC에서 브라우저 주소와 API 주소는 둘 다 `127.0.0.1`을 사용하면 세션 cookie
  설정이 단순합니다.
- frontend 검증: `npm.cmd run build`
- backend 기능 검증: `python -m scripts.check_social_interactions`,
  `python -m scripts.check_local_asset_serving`,
  `python -m scripts.check_managed_asset_copy`

계정 관리 명령은 [ACCOUNT_MANAGEMENT.md](docs/ACCOUNT_MANAGEMENT.md), 전체 문서
목록은 [docs/README.md](docs/README.md)를 보세요.
