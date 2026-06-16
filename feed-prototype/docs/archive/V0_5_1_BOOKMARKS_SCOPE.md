# V0_5_1_BOOKMARKS_SCOPE.md

`feed-prototype` v0.5.1 — **Bookmarks (+ 비공개 메모 · Me 탭 목록)** 상세 scope
문서입니다.

`ROADMAP.md`의 v0.5.x(협업 — Annotation & Collaboration) 테마 두 번째 MINOR이며,
진입 판단·재사용 기반은 `V0_5_X_COLLABORATION_PLAN.md`를 참고합니다.

## 배경

v0.5.0이 댓글로 "공개 협업"을 열었다면, v0.5.1은 개인이 나중에 볼 post를
표시(bookmark)하고 **비공개 메모(annotation)**를 다는 "개인 주석" 축을 채웁니다.
`Follow` join 테이블 + `follows` user-scoped 라우트가 그대로 따라갈 prior art이며,
북마크 목록·필터는 v0.4.x facet/정렬(`paginate_posts`)을 재사용합니다.

## 확정된 결정 (2026-06-16)

- **소유자 = prototype active user selection.** 북마크/메모는 `user_id`로 소유하며,
  본인만 조회/수정/삭제합니다(real auth 아님 — v0.6.x).
- **북마크당 비공개 메모 1개**(`note`, optional 텍스트). 소유자에게만 보이는
  generic 텍스트(도메인 의미 없음).
- **필터/정렬 재사용은 메인 Browse + `bookmarked_only`로 제공.** 북마크 목록은
  "저장한 post의 부분집합"이므로, `PostFilters`에 `my_posts_only`와 동형 플래그
  `bookmarked_only`를 추가해 메인 피드/Browse 필터 패널에서 facet·정렬·키워드를
  그대로 적용합니다. Me 탭 북마크 목록은 메모 관리를 겸한 빠른 접근용(최신순).
- **카드 토글 상태는 클라이언트 훅으로 관리.** `useApiFollows`와 같은 패턴으로
  active user의 bookmarked post id 집합을 한 번 로드해 토글 상태를 그립니다(피드
  응답 경로에 `is_bookmarked`를 끼워 넣지 않음 — post 조회 경로 불변).
- **API mode 전용.** mock 모드는 데모 전용 동결.

## Goals

### 1. `bookmarks` 테이블 (migration `0008`)

- 컬럼: `id` PK, `user_id`(FK `users.id`, index), `post_id`(FK `posts.id`,
  index), `note`(nullable 텍스트), `created_at`, `UniqueConstraint(user_id,
  post_id)`. `Follow` 패턴 + annotation용 `note` 1컬럼.

### 2. 북마크 API (`app/api/routes/bookmarks.py`, user-scoped — follows 패턴)

- `POST /api/users/{user_id}/bookmarks/{post_id}` (body `{note?}`): 추가(멱등 —
  이미 있으면 note 제공 시 갱신). `BookmarkRead`.
- `PATCH /api/users/{user_id}/bookmarks/{post_id}` (body `{note?}`): 메모 편집.
  미존재 404. `BookmarkRead`.
- `DELETE /api/users/{user_id}/bookmarks/{post_id}`: 제거(멱등). 204.
- `GET /api/users/{user_id}/bookmarks?<filters/sort/cursor>`: 내 북마크 post
  목록. `paginate_posts`를 bookmarked base_select 위에 그대로 적용(v0.4.x facet/
  정렬/키워드 재사용) + 각 post에 `note`·`bookmarked_at` 부착. `PaginatedBookmarks`.
- `GET /api/users/{user_id}/bookmark-ids`: `{post_ids:[...]}` (카드 토글 상태용,
  follows의 `following_account_ids`와 같은 역할).

### 3. `bookmarked_only` 필터 (메인 Browse/피드)

- `PostFilters.bookmarked_only: bool` 추가. `user_id`가 없으면 400(`my_posts_only`
  와 동형). `apply_filters_to_select`에서 `Post.id IN (내 bookmark post_ids)`로 제한.
- `feed`/`posts` 라우트에 `bookmarked_only` query parameter 통과.

### 4. Frontend (API mode 전용)

- `src/api/bookmarksApi.ts`: `addBookmark`, `updateBookmarkNote`,
  `removeBookmark`, `getUserBookmarks(userId, filters, opts)`,
  `getUserBookmarkIds(userId)`.
- `src/hooks/useBookmarks.ts`: active user의 bookmark id 집합 로드 +
  `isBookmarked`/`toggle`/`refresh` + storage/custom event 동기화(`useApiFollows`
  패턴).
- `src/components/BookmarkButton.tsx`: 카드/상세 공용 토글(채움/외곽선). 카드 클릭
  버블링 차단.
- `FeedCard`/`PostDetail`: 북마크 토글. PostDetail은 메모 입력/편집도 제공.
- `src/types/filters.ts` + `filterUrl.ts` + `postFilterQuery.ts`: `bookmarkedOnly`
  추가(`my_posts_only`와 동형, user_id 동반). `PostFilterPanel`에 "Bookmarked
  only" 토글(API mode + active user).
- `MePage`(ApiMePage): "Bookmarks" 목록 섹션(메모 표시/편집) + 이연된 UX backlog
  "Following" 목록 섹션(팔로우 계정 바로가기).
- `src/config/appVersion.ts`: `v0.5.0` → `v0.5.1`.

### 5. 회귀 체크 스크립트

- `backend/scripts/check_bookmarks.py`: 추가(멱등)→목록→메모 편집→`bookmarked_only`
  필터→삭제, 타 user 접근 차단, bookmark-ids 확인.

## 구현 메모

- 라우트는 `follows.py`의 user-scoped 쓰기 + 검증 패턴을 따름(새 권한 추상화 없음).
- 북마크 목록/필터는 `paginate_posts` + `PostFilters` 위에 bookmark scope만 더함
  (별도 정렬·cursor 구현 없음 — post 정렬 축 재사용).
- 메모/`bookmarked_at` 부착은 `get_bookmarks_by_post_id`(batch) — `get_comment_counts`
  와 같은 서비스 계층 패턴.
- post 삭제 시 북마크 정리: `delete_post`가 post의 북마크도 함께 삭제(댓글과 동일).

## 정책 / 주의

- **인증 범위 밖(v0.6.x).** 소유자 식별은 active user selection.
- **generic 협업 개념.** `Bookmark`/`note`는 도메인 전용 용어 아님 — 새 모델 허용.
- **external package format 무변경.** 북마크/메모는 앱 내부 사용자 행동.
- **회귀 안전.** post 조회/필터/정렬/cursor 경로 불변(`bookmarked_only`는 기존
  `my_posts_only`와 동형 추가 플래그, 기본 off). 카드 토글 상태는 별도 훅으로 로드.
- **API mode 전용.**

## Non-goals

```text
북마크 폴더/컬렉션 — post-theme 후보로 이연
공유 북마크 / 공개 메모 (북마크·메모는 비공개)
북마크 알림 (v0.5.2)
like / reaction (테마 후속)
mock mode 북마크 UI
external package format 변경
```

## 검증 요약

1. `npm run build`(tsc+vite) 통과, `npm run lint` 신규 에러 0건.
2. `POST/DELETE /api/users/{id}/bookmarks/{post}` 추가/제거(멱등),
   `PATCH`로 메모 편집, 미존재 메모 편집 404.
3. `GET /api/users/{id}/bookmarks` 가 내 북마크 post를 facet 필터·정렬과 함께
   반환하고 각 항목에 `note`·`bookmarked_at` 포함.
4. `GET /api/users/{id}/bookmark-ids` 가 토글 상태용 post id 목록 반환.
5. 메인 Browse에서 `bookmarked_only` 토글 시 내 북마크만, 다른 필터/정렬과 결합.
6. 카드/상세 북마크 토글이 즉시 반영되고 새로고침 후 유지. PostDetail 메모 편집.
7. post 삭제 시 그 post의 북마크도 사라짐.
8. Me 탭에 북마크 목록(메모 표시/편집)과 Following 목록 노출.
9. mock 모드에서는 북마크 UI 미노출, 기존 동작 유지.
10. `scripts/check_bookmarks.py` 통과. golden sample dry-run 회귀 통과.
```
