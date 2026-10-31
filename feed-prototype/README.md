# feed-prototype

로컬 PC에서 테스트 계정과 게시글을 넣어 소셜 피드 기능을 확인하는 앱입니다. frontend는
Vite + React + TypeScript, backend는 FastAPI + PostgreSQL입니다. 현재 릴리즈 라벨은
`src/config/appVersion.ts`를 따릅니다.

## 메시지 대화방 (v2.3.2)

API 모드에서 1:1·그룹 대화방을 만들고, 참여자를 초대하거나 방에서 나갈 수 있습니다. 새 대화를 시작하거나 기존 방에 새 사람을 초대할 때는 내가 대상 계정을 팔로우해야 합니다. 한 번 방에 참여하면 이후 팔로우를 취소해도 그 방에서 메시지와 이미지를 보낼 수 있습니다. JPEG, PNG, GIF, WebP 이미지를 5MB까지 전송할 수 있고, 대화창에서는 작게 표시한 뒤 클릭해서 확대합니다. 기존 1:1 메시지는 `0019_message_rooms` migration에서 대화방으로 이전합니다.

읽지 않은 메시지는 대화방별로 구분되고 왼쪽 메시지 탭에도 합계가 표시됩니다. 대화방을 열면 읽음으로 처리합니다. 상대의 프로필 사진을 누르면 프로필 피드로 이동하거나 팔로우를 변경할 수 있습니다. 읽음 상태는 `0020_message_read_state` migration에서 추가합니다.

## 실행 모드

- **API**: 로그인, 게시글·댓글·좋아요·메시지 등 실제 기능을 확인합니다. PostgreSQL과
  FastAPI가 필요합니다.
- **Mock**: `src/data`의 정적 데이터를 보는 UI 데모입니다. 로그인·인가나 새 기능의
  동작 검증에는 사용하지 않습니다.

설치와 순서는 [로컬 실행 가이드](docs/QUICK_RUN_GUIDE_LOCAL.md)를 따르세요.
새 DB의 API 데모 계정 `ari`·`mika`·`nova`에는 한국어 프로필, 고정 글과 실제
로컬 자산이 포함됩니다. 이미 seed한 DB의 데모 내용을 갱신하려면
`python -m app.services.seed --refresh-demo`를 명시적으로 실행합니다.
이 명령은 비밀번호와 다른 계정 데이터는 유지하며 데모 프로필의 수정 사항과
고정 글 순서는 갱신합니다. Mock 모드의 정적 데이터는 별도 UI 데모입니다.

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
1:1·그룹 메시지와 이미지 전송, 태그·metadata 검색/필터, 자산 미리보기, import 이력이
있습니다. API write 요청은 로그인 세션의 사용자를 기준으로 처리합니다.

### 탐색과 프로필

- 홈 검색창 하나에서 키워드, 후보에서 선택한 `@인물`, 등록 `#태그`,
  `장소:"서울 숲"`을 조합해 찾습니다. 검색 결과는 `/posts`의 전체 게시글이며
  필요하면 `내 피드`로 좁힙니다. 인물은 작성·본문 멘션·명시적 태그가 기본이고,
  인물 chip에서 작성만 또는 태그·멘션만 볼 수 있습니다. 본문의 해시태그만으로는
  등록 태그 검색에 포함되지 않습니다. [검색 계약과 DB 적용](docs/SMART_HOME_SEARCH_PLAN.md)
  을 참고하세요.
- `/posts`에서 게시글과 계정을 탭으로 찾습니다. 게시글의 `상세 조건`은 접고 펼 수
  있으며, 적용된 조건은 URL과 조건 칩에 표시됩니다. `/accounts`도 계정 검색 화면으로
  연결됩니다. 검색어는 완성형 한글 부분 일치와 영문 대소문자 무시를 지원합니다.
- `/me`에서 자기 소개, 게시글·팔로워·팔로잉 수와 고정 게시글을 봅니다. 게시글,
  사진·첨부 자료, 관계, 저장한 글과 언급은 필요한 탭을 열 때 페이지 단위로 읽습니다.
  저장한 글과 언급은 본인 프로필에서만 보입니다.
- 프로필 편집에서 커버 이미지 URL과 이름이 붙은 외부 링크 최대 3개를 설정합니다.
  게시글 최대 3개를 고정하고 순서를 바꿀 수 있습니다. 비밀번호 변경과 계정
  비활성화는 `/settings`에 있습니다.
- 화면 시각은 서울 시간으로 표시하고 날짜 검색은 한국 날짜의 시작과 끝으로
  변환합니다. 공유 URL의 날짜 형식은 `YYYY-MM-DD`입니다.

## 설정과 검증

- Backend: `backend/.env.example`을 `backend/.env`로 복사하고 `DATABASE_URL`,
  `EXTERNAL_POSTS_DIR`을 설정합니다.
- Frontend: `.env.example`을 `.env`로 복사해 `VITE_DATA_SOURCE=api`,
  `VITE_API_BASE_URL=http://localhost:8000`을 설정합니다. 로컬 접속에서는 앱이
  브라우저의 `localhost`/`127.0.0.1` 호스트 이름에 API 주소를 맞춥니다.
- frontend 검증: `npm.cmd run build`
- backend 기능 검증: `python -m scripts.check_social_interactions`,
  `python -m scripts.check_profile_ux`,
  `python -m scripts.run_profile_regressions_isolated`,
  `python -m scripts.check_local_asset_serving`,
  `python -m scripts.check_managed_asset_copy`
- 기존 DB를 v2.2.x로 올린 뒤에는 `python -m scripts.rebuild_post_account_refs --dry-run`
  으로 범위를 확인하고 `--apply`로 기존 게시글의 멘션 관계를 재계산합니다.

계정 관리 명령은 [ACCOUNT_MANAGEMENT.md](docs/ACCOUNT_MANAGEMENT.md), 전체 문서
목록은 [docs/README.md](docs/README.md)를 보세요.
