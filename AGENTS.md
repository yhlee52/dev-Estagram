# AGENTS.md

## Project Identity

`feed-prototype`은 로컬 PC에서 실행하는 범용 Instagram-like feed prototype입니다.
Vite + React + TypeScript frontend와 FastAPI + PostgreSQL backend를 사용합니다.
personal/bot/project feed를 모두 다룰 수 있도록 core domain을 generic하게 유지합니다.

## Current Runtime

- API 모드가 실제 기능 검증 경로입니다. 비밀번호 로그인과 서버 세션(httpOnly cookie)을
  사용하며 write 행위자는 request body가 아닌 session에서 도출합니다.
- Mock 모드는 UI 데모용으로 유지하고 새 기능은 API 모드에 추가합니다.
- 외부 게시글은 `EXTERNAL_POSTS_DIR`의 `incoming/`에서 읽습니다. 처리 후 `archive/` 또는
  `failed/`로 이동하고, 상대 경로 자산은 같은 루트의 `assets/`에 복사해 제공합니다.
- frontend는 PostgreSQL에 직접 연결하지 않습니다. 각 User에는 하나의 Account가
  대응합니다.
- 현재 버전 라벨의 기준은 `feed-prototype/src/config/appVersion.ts`입니다.

## Core Domain

공유 type/component/route/data flow에는 User, Account, Post, Feed, Follow, Asset,
Metadata, Comment, Bookmark, Notification, Like, Message 같은 generic 개념을
사용합니다. Equipment, Chamber, Sensor, Recipe, Severity, Report 같은 설비 전용
용어를 core type 또는 주 component 이름에 넣지 않습니다. 시나리오별 값은
`post.metadata`, `metadata_json` 또는 asset metadata에 둡니다.

## External Package Format Freeze

외부 post package JSON은 기존 생산 프로그램과 호환되어야 합니다. 기존 필드의 이름·
의미를 바꾸거나 제거하거나 optional 필드를 required로 만들지 않습니다. 새 필드는
optional로만 추가하고, `external_id` upsert와 timezone 없는 `created_at` 허용을
유지합니다. import 코드를 바꾸면 `data/external_posts/examples/` golden sample의
`--dry-run`을 확인합니다. 형식 변경이 불가피하면 먼저 사용자에게 확인합니다.

## Development & Verification

- 작고 집중된 변경을 선호하고, 릴리즈 버전은 MAJOR.MIDDLE.MINOR 규칙을 따릅니다.
  한 번에 여러 MINOR 범위를 섞지 않습니다.
- frontend file upload 흐름은 명시적 요청 전까지 추가하지 않습니다.
- 코드 변경 후 `feed-prototype`에서 `npm.cmd run build`를 통과시킵니다.
- backend 변경은 관련 `backend/scripts/check_*.py` 회귀 검사와 migration을 확인합니다.

## Current Docs

- [로컬 실행](feed-prototype/docs/QUICK_RUN_GUIDE_LOCAL.md)
- [앱 README](feed-prototype/README.md)
- [문서 색인](feed-prototype/docs/README.md)
- [로드맵](feed-prototype/docs/ROADMAP.md)
- [외부 패키지 형식](feed-prototype/docs/EXTERNAL_POST_PACKAGE_GUIDE.md)
- [계정 관리](feed-prototype/docs/ACCOUNT_MANAGEMENT.md)
