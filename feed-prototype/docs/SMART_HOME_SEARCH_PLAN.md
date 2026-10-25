# 스마트 홈 검색

## 목표와 범위

홈의 팔로잉 피드는 그대로 둡니다. 홈의 검색창에서 검색을 실행하면 `/posts`의 **전체 게시글** 결과로 이동합니다. 결과 화면에서 `내 피드`로 범위를 좁힐 수 있습니다. API 모드가 기능 검증 경로이고 Mock 모드는 기존 UI 데모입니다. 이 문서는 v2.1.5를 기준으로 한 v2.2.x 구현 계약과 로컬 실행 절차입니다.

업로드, 얼굴 인식, 지도·GPS, 외부 검색 서비스, 추천 순위, 댓글 멘션 포함, 프로필 개편은 범위 밖입니다. 기존 `account_id`와 `account_handle`은 작성자 필터로 유지합니다.

## 입력과 결과의 의미

| 입력·선택 | 의미 |
| --- | --- |
| `노을` | 기존 제목·본문·작성자 handle·표시 이름의 부분 일치 검색. |
| `@민아` | 활성 계정 후보에서 한 Account를 **선택**합니다. 기본 `관련 전체`는 작성자 OR 게시글 본문 멘션 OR 명시적 인물 태그입니다. `작성한 글`, `태그·멘션된 글`로 바꿀 수 있습니다. 동명이인은 후보의 이름과 `@handle`로 구별합니다. |
| `#여행` | 등록된 `Post.tags`의 대소문자 무시 정확 일치입니다. 본문의 해시태그만으로는 검색되지 않습니다. 부분 일치는 자동완성에만 사용합니다. |
| `장소:"서울 숲"` | `metadata_json.location`의 문자열 정확 일치입니다. 공백이 없는 장소는 따옴표 없이 입력할 수 있습니다. |
| `@민아 #여행 장소:"서울 숲" 노을` | 인물·태그·장소·기존 키워드를 모두 만족합니다. 인물·태그를 여러 개 선택하면 각각 AND이며 최대 5개씩입니다. 장소는 하나이고 다음 선택으로 교체합니다. |

평문 이름, 사진 속 얼굴, 댓글에서만 등장한 멘션은 인물 검색에 포함하지 않습니다. `@ann`은 `@anna`와 다르고 이메일의 `@`도 멘션이 아닙니다. `@mika.project` 같은 점·하이픈 handle을 인식하며, 뒤따르는 한글 조사는 멘션에 포함하지 않습니다. 최종 결과는 실제 일치 이유를 `작성`, `멘션`, `태그`로 보여줍니다.

## 화면 흐름

홈과 `/posts` 게시글 탭이 같은 검색 입력 컴포넌트를 씁니다. 입력창·검색 버튼·`상세 조건`만 기본으로 보이고, 인물·태그·장소 선택 항목과 조건 chip을 인접하게 둡니다. `@`, `#`, `장소:` 입력 또는 선택 항목으로 후보를 엽니다. 인물 후보 선택은 **조건 추가**이며 프로필은 별도 링크로 엽니다. 인물은 후보 선택 전까지 미완성 조건입니다. 빈 `@`·`#`·`장소:`와 닫히지 않은 장소 따옴표는 오류를 보여주고 제출하지 않습니다. 태그와 장소의 완성된 값은 인기 후보에 없어도 정확 조건으로 제출할 수 있습니다.

URL은 적용된 조건의 기준입니다. 입력 중인 텍스트와 chip은 초안이고 검색 버튼 또는 유효한 Enter로 적용합니다. chip 제거·초기화·범위 변경은 브라우저 기록에 남깁니다. 잘못된 인물 URL 조건도 제거 가능한 chip과 오류로 표시합니다. 한국어 IME 조합 중 Enter는 후보 선택과 검색을 실행하지 않습니다. 후보는 250ms 지연 조회하며 늦은 응답을 버립니다. 키보드 방향키·Escape·Tab과 후보 0건·실패·재시도를 제공합니다.

검색 결과는 `/posts`의 기존 페이지네이션과 상세 복귀를 씁니다. 홈에서 검색 후 뒤로 가면 사용자별 저장된 홈 페이지 수와 스크롤 위치를 복원합니다. URL·계정이 달라지면 결과 복원 키와 cursor도 달라집니다. 현재 불러온 건수만 표시하며 이를 전체 건수로 부르지 않습니다. 기존 `/?keyword=...`는 내 피드 필터로, `/posts?tag=...`는 기존 태그 검색으로 유지합니다.

## 데이터와 API

Migration `0018_post_account_refs`는 `post_account_refs(post_id, account_id, kind)`를 추가합니다. `kind`는 `mention` 또는 `tag`입니다. 작성자 관계는 `posts.account_id`에서 계산합니다. 한 글에 이유가 여러 개 있어도 `EXISTS` 조건을 페이지네이션 전에 적용해 결과 글은 한 번만 나옵니다. 원문·기존 metadata·tags는 바꾸지 않습니다.

```text
GET /api/accounts/search?keyword=민아&limit=8        # 활성 계정 후보, 기존 세션 경계
GET /api/tags?prefix=여&limit=8                  # 등록 태그 후보
GET /api/places?prefix=서울&limit=8              # 문자열 location 후보
GET /api/posts?scope=all&person=related:ACCOUNT_ID&tag=여행&place=서울숲&keyword=노을&limit=20
GET /api/posts?scope=feed&person=authored:ACCOUNT_ID&limit=20
```

`person=<mode>:<Account ID>`와 `tag`는 반복할 수 있습니다. mode는 `related`, `authored`, `mentioned_tagged`입니다. `scope=all`이 기본이며 `scope=feed`는 현재 세션의 팔로우 계정과 내 계정만 조회하고 비로그인 요청에 401을 반환합니다. 검색 항목에는 작성자 `account`, `tagged_account_ids`, 인물 조건별 `search_matches: [{account_id, account_handle, reasons}]`가 추가됩니다. 북마크 개인 메모는 결과에 넣지 않습니다. 기존 `/api/feed`, `/api/accounts/{id}/posts`, 작성자·metadata·sort·bookmarked 필터의 의미는 유지합니다.
`bookmarked_only`와 `my_posts_only`는 기존처럼 `user_id`가 필요하고 현재 세션의 사용자에게만 적용합니다. 다른 사용자 ID를 넘기면 403을 반환합니다.

게시글 작성·본문 수정·삭제와 import upsert·재import·batch 삭제에서 멘션·명시적 태그 관계를 갱신합니다. 편집기의 인물 태그는 활성 Account 후보를 선택해 최대 5개까지 저장합니다. PATCH에서 `tagged_account_ids` 생략은 기존 값을 유지하고 `[]`는 해제합니다. `metadata_json.location`은 편집기의 전용 장소 입력으로 쓰되 다른 metadata를 보존합니다. 기존 location 값이 문자열이 아니면 경고하고 사용자가 장소를 수정하지 않을 때 원값을 유지합니다.

외부 패키지의 새 선택형 `posts[].tagged_account_external_ids`는 `accounts.external_id` 배열입니다. 내부 Account ID가 아닙니다. 생략은 기존 태그 유지, `[]`는 해제, 값은 교체입니다. 존재하지 않는 외부 ID와 중복 ID는 import 오류입니다. 비활성 계정의 과거 관계는 보존하고 기존 ID URL에서는 검색할 수 있지만 신규 후보에는 표시하지 않습니다. import의 기존 필드, `external_id` upsert, timezone 없는 `created_at`, `profile_source=user` 보호는 유지합니다.

## 로컬 DB 적용

기존 DB를 쓰는 경우 backend에서 migration 후 기존 게시글의 **본문 멘션만** 재계산합니다. 명시적 태그와 원문은 건드리지 않으며 재실행해도 같은 결과입니다.

```powershell
cd feed-prototype/backend
python -m alembic upgrade head
python -m scripts.rebuild_post_account_refs --dry-run
python -m scripts.rebuild_post_account_refs --apply
```

계정 등록·import handle 변경 시에는 관련 옛/새 handle을 포함하는 게시글의 멘션을 다시 계산합니다. 현재 handle에 대한 원문 해석을 사용하므로, 변경 전 handle 표기는 변경 후 계정을 가리키지 않습니다.

## 구현 묶음과 완료 기준

| MINOR | 변경 묶음 | 완료 기준 |
| --- | --- | --- |
| v2.2.0 | 관계표·검색 API·재계산과 backfill·편집기·선택형 import 필드 | 작성/수정/삭제/import 경로가 검색 결과까지 연결되고 기존 패키지 dry-run 통과 |
| v2.2.1 | 홈·`/posts` 공유 입력, 후보·chip·범위·URL·복귀·일치 이유 | 홈 기본 피드 유지, 복합 검색의 공유·새로고침·뒤로 가기 동작 |
| v2.2.2 | 직접 관련된 빈 상태·키보드·접근성·문서 피드백 | 좁은 창, 실제 한글 IME, 늦은 응답과 오류 상태 확인 |

검증은 `npm.cmd run build`, `npm.cmd run lint`, `python -m scripts.run_profile_regressions_isolated`를 사용합니다. 마지막 명령은 migration과 새 스마트 검색 검사를 포함해 **격리 PostgreSQL DB**에서 실행합니다. 외부 패키지 회귀는 `python -m scripts.check_golden_samples`로 dry-run만 합니다. 브라우저에서는 1440·1280·1024px와 좁은 창, IME, 키보드, 복귀·스크롤을 확인합니다. 자동 검사만으로 실제 브라우저 조합 입력과 화면 크기 동작을 보장하지는 않습니다.
