# 로컬 실행 가이드 (Windows PowerShell)

한 PC에서 PostgreSQL, FastAPI, Vite와 폴더 감시 프로세스를 실행합니다.

## 1. 데이터 폴더와 환경설정

원하는 경로를 정하고 `incoming` 폴더를 만듭니다. 아래는 `C:/feed-data` 예시입니다.

```powershell
New-Item -ItemType Directory -Force C:/feed-data/incoming
Copy-Item feed-prototype/backend/.env.example feed-prototype/backend/.env
Copy-Item feed-prototype/.env.example feed-prototype/.env
```

`feed-prototype/backend/.env`의 값을 실제 로컬 DB에 맞춥니다.

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/feed_dev
EXTERNAL_POSTS_DIR=C:/feed-data
```

`feed-prototype/.env`에는 다음을 넣습니다.

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:8000
```

## 2. DB와 테스트 계정

로컬 PostgreSQL에 `feed_dev` 데이터베이스를 만든 뒤 backend에서 실행합니다.

```powershell
cd feed-prototype/backend
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m app.services.seed
```

기존 DB에 이미 있던 게시글의 본문 멘션도 인물 검색에 넣으려면 migration 후
다음 명령을 한 번 실행합니다. 원문과 명시적 인물 태그는 바꾸지 않으며 재실행할
수 있습니다.

```powershell
python -m scripts.rebuild_post_account_refs --dry-run
python -m scripts.rebuild_post_account_refs --apply
```

Seed 계정은 `ari`, `mika`, `nova`이며 초기 password는 각각 handle과 같습니다.
새 DB에는 한국어 소개·게시글 9개, 고정 글, 댓글·좋아요·북마크 메모·메시지 예시가
들어갑니다. 아바타·커버·사진·그래프·CSV·JSON은 저장소의
`feed-prototype/public/assets/demo/`에서 제공하므로 별도 다운로드가 필요 없습니다.
기존 계정과 게시글은 기본 seed가 덮어쓰지 않으며, 누락된 데모 계정·게시글·자산만
추가합니다. 기존 DB의 팔로우·고정 글·댓글 등 사용자 활동은 그대로 둡니다.

이전에 seed를 실행한 DB에서 기존 데모 내용까지 바꾸려면 마이그레이션을 먼저 적용한 뒤
다음 명령을 실행합니다.

```powershell
python -m app.services.seed --refresh-demo
```

이 옵션은 `demo-*` ID의 아리·미카·노바 소개, 게시글과 첨부 설명을 새 예시로 바꾸고
세 계정의 고정 글 순서를 예시대로 다시 설정합니다. 데모 계정의 개인 수정 사항은
덮어쓰므로 필요한 내용은 먼저 보관하세요. 비밀번호·계정 ID·핸들·비활성 상태,
다른 계정과 게시글은 변경하지 않습니다. 기존 게시글의 작성 시각도 유지합니다.
기존 데모 게시글의 자산은 갱신되며, 새 예시 게시글과 상호작용은 없을 때 추가됩니다.
데모 계정 간의 예시 팔로우가 지워져 있다면 다시 추가됩니다.

## 3. 서버 실행

첫 번째 터미널, backend 디렉터리:

```powershell
python -m uvicorn app.main:app --reload
```

두 번째 터미널, `feed-prototype` 디렉터리:

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite가 표시한 `http://localhost:5173` 주소를 열고 seed 계정으로 로그인합니다.
브라우저에서 `127.0.0.1`로 열어도 로컬 API 주소는 같은 호스트 이름으로 맞춰집니다.
seed 계정 `ari`의 초기 비밀번호는 `ari`입니다.

## 4. 로컬 패키지 가져오기

예제 폴더를 데이터 폴더의 `incoming/`으로 복사합니다.

```powershell
Copy-Item -Recurse ../data/external_posts/examples/managed_copy_sample C:/feed-data/incoming/
```

세 번째 터미널, backend 디렉터리에서 먼저 dry-run을 확인합니다.

```powershell
python -m app.services.process_incoming --dry-run
python -m app.services.process_incoming
```

지속 감시가 필요하면 한 번 처리 명령 대신 아래를 실행합니다.

```powershell
python -m app.services.process_incoming --watch --interval 10
```

성공한 패키지는 `archive/`, 실패한 패키지는 `failed/`로 이동합니다. 상대 경로
자산의 복사본은 `assets/`에 쌓입니다. 데이터 폴더를 바꾸려면 `.env`의
`EXTERNAL_POSTS_DIR`을 바꾸고 감시 프로세스를 다시 시작합니다.

## 5. 확인

앱의 Home/Explore에 새 post가 보이는지, Imports에 batch 이력이 있는지,
상세 화면의 자산이 열리는지 확인합니다. 좋아요와 메시지는 계정 두 개로 로그인해
주고받아 볼 수 있습니다. package JSON 작성법은
[외부 게시글 패키지 가이드](EXTERNAL_POST_PACKAGE_GUIDE.md)를 따릅니다.
