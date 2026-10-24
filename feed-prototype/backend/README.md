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
python -m scripts.check_local_asset_serving
python -m scripts.check_managed_asset_copy
```

상세 실행 순서는 [로컬 실행 가이드](../docs/QUICK_RUN_GUIDE_LOCAL.md)에 있습니다.
