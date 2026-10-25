# Backend

FastAPI가 로컬 PostgreSQL의 User/Account/Post 데이터와 파일 자산을 제공합니다.
`backend/.env.example`을 `.env`로 복사하고 DB 주소와 데이터 폴더를 설정합니다.

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/feed_dev
EXTERNAL_POSTS_DIR=C:/feed-data
```

`EXTERNAL_POSTS_DIR`을 생략하면 저장소의 `data/external_posts`를 사용합니다.
`MANAGE_ASSET_STORAGE=true`가 기본값이며, 상대 경로 자산은 이 폴더의
`assets/`로 복사됩니다. API는 복사한 자산을 `/api/assets/{id}`에서 제공합니다.

```powershell
cd feed-prototype/backend
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m app.services.seed
python -m uvicorn app.main:app --reload
```

외부 게시글 처리(별도 터미널):

```powershell
python -m app.services.process_incoming --dry-run
python -m app.services.process_incoming --watch --interval 10
```

단일 JSON은 `python -m app.services.import_external_posts --input PATH --dry-run`으로
먼저 검증한 뒤 같은 명령에서 `--dry-run`을 빼고 import할 수 있습니다. 이 명령은
파일을 이동하지 않습니다. `process_incoming`만 성공/실패에 따라 이동합니다.
HTTP `POST /api/imports`도 지원하지만 로컬 파일 복사는 하지 않습니다.

회귀 검사:

```powershell
python -m scripts.check_social_interactions
python -m scripts.check_profile_ux
python -m scripts.run_profile_regressions_isolated
python -m scripts.check_local_asset_serving
python -m scripts.check_managed_asset_copy
```

상세 실행 순서는 [로컬 실행 가이드](../docs/QUICK_RUN_GUIDE_LOCAL.md)에 있습니다.

프로필 검색·요약·관계·고정 게시글과 계정 편집 필드는
[UX 개선 계획](../docs/UX_IMPROVEMENT_PLAN.md)에 정리했습니다. 기존
`GET /api/accounts`와 `GET /api/accounts/{id}/posts` 배열 응답은 유지합니다.
`run_profile_regressions_isolated`는 설정된 PostgreSQL 서버에 임시 DB를
만들어 마이그레이션과 기존 회귀를 실행한 후 삭제합니다. 설정된 앱 DB는 변경하지
않으며 PostgreSQL 사용자에게 DB 생성 권한이 필요합니다.
