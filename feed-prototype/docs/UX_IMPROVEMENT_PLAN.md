# v2.1.x 프로필·한국어·탐색 UX

로컬 SNS를 한국어로 사용하면서 사람과 게시글을 찾고, 프로필에서 관계와 대표 글을
확인할 수 있도록 한 변경입니다. 기능 검증 기준은 API 모드입니다. Mock 모드는
기존 정적 UI 데모로 유지합니다.

## 화면 사용법

| 화면 | 동작 |
| --- | --- |
| `/` | 팔로잉 피드. 전체 검색은 탐색으로 이동 |
| `/posts` | 게시글·계정 탭. 검색어를 입력한 뒤 검색하거나 Enter로 적용. 게시글 상세 조건은 접어서 사용 |
| `/accounts` | `/posts`의 계정 탭과 같은 검색 결과 컴포넌트 |
| `/me` | 소개·관계 수치·고정 글과 게시글/자료/관계/저장한 글/언급 탭 |
| `/accounts/:id` | 공개 프로필. 팔로우·메시지, 게시글과 관계. 비활성 계정은 기존 글만 열람 |
| `/settings` | 비밀번호 변경, 계정 비활성화, 카드 표시 설정과 실행 정보 |

검색 URL이 적용 조건의 기준입니다. 브라우저 뒤로·앞으로 가기와
`/posts?tag=...` 링크가 조건을 복원합니다. 조건 칩에서 하나씩 지우거나 전체
초기화할 수 있습니다. 계정 탭에는 게시글 전용 상세 조건이 적용되지 않습니다.
결과 수는 전체 건수 대신 현재 불러온 건수입니다.

프로필 편집은 내 프로필에서 버튼을 눌렀을 때 열립니다. 선택형 커버는
`/assets/...` 또는 `http(s)` URL이고, 링크는 이름과 `http(s)` URL을 가진 항목
최대 3개입니다. 게시글도 최대 3개까지 고정하고 순서를 바꿀 수 있습니다. 고정
글은 프로필의 일반 게시글 목록에서 중복 표시하지 않습니다. 사진·첨부 자료 탭은
고정 여부와 관계없이 자료가 있는 글을 보여줍니다. 저장한 글과 언급은 로그인한
본인에게만 표시됩니다.

한국어 UI는 `src/i18n/ko.ts`의 공통 문구를 사용합니다. 사용자 본문, 계정
식별자, URL, metadata 값과 API 필드명은 그대로 둡니다. 표시 시각은
`Asia/Seoul`입니다. 날짜 입력과 공유 URL은 `YYYY-MM-DD`이고, 프런트엔드는
검색 요청 시 시작 `00:00:00+09:00`, 끝 `23:59:59.999999+09:00`으로 보냅니다.
API에 날짜만 직접 보냈을 때의 기존 UTC 해석과 naive datetime import 규칙은
그대로입니다. 한글 IME 조합 중 Enter는 검색·메시지 전송을 실행하지 않습니다.

## 변경 묶음

| 버전 | 범위 |
| --- | --- |
| v2.1.0 | 한국어 메뉴·상태·시간, 날짜 검색, IME 처리 |
| v2.1.1 | 게시글·계정 탐색, 상세 조건, URL 기록, 서버 계정 검색 |
| v2.1.2 | 공통 프로필, 서버 집계와 페이지 조회, 관계·자료·언급 탭, 설정 분리 |
| v2.1.3 | 선택형 커버와 프로필 링크 |
| v2.1.4 | 최대 3개 게시글 고정·정렬·해제 |
| v2.1.5 | 탐색 복귀, 다시 시도·상태 공지, 댓글 앵커, 라이트박스 포커스 |

## API 계약

- `GET /api/accounts/search?keyword=&sort=&cursor=&limit=`: 활성 계정의 이름·
  핸들 검색. `sort=handle|recent|post_count`, 계정 ID 동률 기준. 응답은
  `{items:[{account,post_count,last_post_at}],next_cursor,has_more}`.
- `GET /api/accounts/{id}/summary`: 실제 게시글·팔로워·팔로잉 수와 최근 게시글
  시각. 비활성 계정의 보존된 글과 관계도 포함합니다.
- `GET /api/accounts/{id}/followers|following`: 별도 페이지 조회.
- `GET /api/posts?account_id=...&has_assets=true`: 자료가 있는 글만 조회.
  `exclude_pinned=true`는 `account_id`와 함께 사용해 일반 프로필 목록에서
  고정 글을 제외합니다.
- `GET /api/users/{id}/notifications?reason=mention`: 전체 언급을 페이지
  단위로 조회하며 기존 자기 전용 세션 권한을 유지합니다.
- 계정 응답·소유자 `PATCH /api/accounts/{id}`: 선택형 `cover_url`,
  `profile_links`. 사용자 편집은 `profile_source=user`로 기록되어 재import에
  덮이지 않습니다.
- `GET /api/accounts/{id}/pinned-posts`, 소유자 전용
  `PUT /api/accounts/{id}/pinned-posts`의 `{post_ids:[...]}`: 전체 고정 순서를
  원자적으로 교체합니다. 중복 ID·타인 글·4개 이상을 거절합니다. 삭제·소유
  계정 변경 시 고정을 정리하고, 같은 계정의 동일 ID 재import에는 유지합니다.

기존 `GET /api/accounts`와 `GET /api/accounts/{id}/posts` 배열 응답, 외부 게시글
패키지 형식은 바꾸지 않았습니다. DB를 업그레이드할 때는 backend에서
`python -m alembic upgrade head`를 실행합니다.

## 검증

frontend `npm.cmd run build`, backend `python -m scripts.check_profile_ux`와
`python -m scripts.run_profile_regressions_isolated`를 실행합니다. 새 프로필
검사는 검색·권한·고정·KST 날짜 경계·재import와 golden sample dry-run을 포함합니다.
격리 검사는 임시 PostgreSQL DB에 전체 마이그레이션을 적용한 뒤 기존 계정·알림·
북마크·댓글·소셜 회귀까지 실행하고 DB를 삭제합니다. 브라우저에서의 반응형 화면
수동 검증은 별도로 수행해야 합니다.

다음 후보는 새 글 알림 배너, 알림 배지 폴링, 글쓰기 임시 저장, 개별 읽음,
초성·오타 검색입니다. 스토리·릴스·추천 엔진·업로드·실시간 기능은 이 테마에
포함하지 않습니다.

## 참고한 화면 구성

- [X 프로필 꾸미기](https://help.x.com/en/managing-your-account/how-to-customize-your-profile):
  커버·소개·대표 게시글의 순서
- [Instagram 게시글 고정](https://about.fb.com/ja/news/2022/06/grid_pinning_on_profile/amp/):
  프로필의 최대 3개 고정
- [Threads 프로필 기능](https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/):
  프로필 링크와 관심 주제 후보
- [X 고급 검색](https://help.x.com/en/using-x/x-advanced-search):
  기본 검색창과 상세 조건의 분리
