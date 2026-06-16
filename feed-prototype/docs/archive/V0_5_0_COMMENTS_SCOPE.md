# V0_5_0_COMMENTS_SCOPE.md

`feed-prototype` v0.5.0 — **Comments** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.5.x(협업 — Annotation & Collaboration) 테마의 기반(x.y.0)
버전이며, "개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를
작성한 뒤 작업한다" 규칙에 따라 작성되었습니다. 진입 판단과 후보 정리는
`V0_5_X_COLLABORATION_PLAN.md`를 참고합니다.

## 배경

읽기(v0.1)·UI(v0.2)·ingestion(v0.3)·metadata 트리아지(v0.4)로 "봇/외부
프로그램이 만든 데이터를 잘 읽는" 축이 갖춰졌습니다. v0.5.0은 그 위에 **사람의
판단·맥락을 댓글로 기록**하는 첫 협업 기능입니다. `Follow` join 테이블과
`follows` 쓰기 라우트가 그대로 따라갈 prior art입니다.

## 확정된 결정 (2026-06-16)

- **평면(flat) 댓글만.** 대댓글 threading/리치 텍스트는 non-goal.
- **작성자 = prototype active user selection.** 댓글은 `author_user_id`(User FK)로
  소유하며, 수정/삭제는 작성자 본인만(active user = 작성자 체크). 실제 인증/권한은
  v0.6.x이며 이는 MVP8 personal post ownership 체크와 같은 수준입니다.
- **작성자 신원은 `AccountRead`로 표시.** 1:1 User:Account이므로 작성자 user의
  account(`display_name`/avatar/handle)를 댓글에 함께 실어 줍니다.
- **본문 `@mention` + `#hashtag` 렌더(렌더만, 저장 없음).** v0.1.3 mention
  렌더를 일반화한 공용 파서(`parseRichTextSegments`)로 `@handle`은 계정 프로필
  링크, `#tag`는 `/posts?tag=` 필터 링크(`TagList` 규칙과 동일)로 렌더합니다.
  `MentionText`가 댓글 본문·post caption 양쪽에서 쓰이므로 이 향상은 **앱 전역**에
  적용됩니다(저장/format 무변경, hashtag는 글자로 시작하는 토큰만 인식해 `#42`
  같은 노이즈는 제외).
- **카드 댓글 수 = 데이터 파생 count(`GROUP BY post_id`).** post 목록 경로의
  필터/정렬/페이지네이션 로직은 불변이며, 각 카드에 derived `comment_count`만
  덧붙입니다(N+1 회피 위해 페이지 단위 배치 집계).
- **API mode 전용.** mock 모드는 데모 전용 동결 — 댓글 UI 미노출.

## Goals

### 1. `comments` 테이블 (migration `0007`)

- 컬럼: `id` PK, `post_id`(FK `posts.id`, index), `author_user_id`(FK
  `users.id`, index), `text`, `created_at`, `updated_at`. `Follow` 패턴 +
  `updated_at`(수정 지원).
- add-only migration. 기존 테이블/format 무변경.

### 2. 댓글 API (`app/api/routes/comments.py`)

- `GET /api/posts/{post_id}/comments?sort=oldest|newest`
  - `oldest`(기본, 읽기 순서) / `newest`. tie-breaker `id`.
  - 응답 `CommentListResponse{ items: [CommentWithAuthor{comment, author}] }`.
  - post 없으면 404, 잘못된 sort는 400.
- `POST /api/posts/{post_id}/comments` (body `CommentCreate{user_id, text}`)
  - 201 + `CommentWithAuthor`. `text` trim 후 비면 422, user/account 없으면 404.
- `PATCH /api/comments/{comment_id}` (body `CommentUpdate{user_id, text}`)
  - 작성자 본인만(아니면 403), `updated_at` 갱신. 없으면 404.
- `DELETE /api/comments/{comment_id}?user_id=...`
  - 작성자 본인만(아니면 403), 204. 없으면 404. (post 삭제 시 댓글도 함께
    삭제 — `delete_post`에서 post의 댓글 제거.)

### 3. 작성자 신원 (`CommentWithAuthor.author: AccountRead`)

- 작성자 user의 account를 `Account.user_id` 기준으로 batch 해석
  (`get_comment_authors`). account가 없는 고아 댓글은 목록에서 제외(follows의
  account 결손 처리와 동일).

### 4. 카드 댓글 수 (`PostRead.comment_count`)

- `PostRead`에 `comment_count: int = 0`(additive) 추가.
- 목록 빌더(`feed`/`posts`/`accounts`)가 페이지의 post id로 `get_comment_counts`
  (단일 `GROUP BY` 쿼리)를 호출해 카드에 덧붙임. 단건 조회/생성/수정 응답은 기본
  0(상세 화면은 칩이 아니라 댓글 섹션을 직접 보여줌).

### 5. Frontend (API mode 전용)

- `src/api/commentsApi.ts`: `getComments(postId, sort?)`, `createComment`,
  `updateComment`, `deleteComment`. `client.ts`의 `apiGet/apiPost/apiPatch/
  apiDelete` 재사용.
- `src/utils/mentions.ts`: `parseMentionSegments` → `parseRichTextSegments`로
  일반화(mention + hashtag 세그먼트). `src/components/MentionText.tsx`: hashtag
  세그먼트를 `/posts?tag=` 링크로 렌더(공용 — caption·댓글 동시 적용).
- `src/components/CommentsSection.tsx`: PostDetail 하단 댓글 섹션 — 목록(작성자
  아바타/이름 + 본문 `MentionText` + 시각) + 정렬 토글 + 작성 폼 + 본인 댓글
  인라인 수정/`ConfirmDialog` 삭제 + 로딩/0건/실패 상태.
- `src/components/FeedCard.tsx`: `post.commentCount > 0`일 때 `💬 N` 칩 표시.
- 매핑: `ApiPost.comment_count` → `Post.commentCount`(`mapApiPostToPost`).
- `src/config/appVersion.ts`: `v0.4.2` → `v0.5.0`.

### 6. 회귀 체크 스크립트

- `backend/scripts/check_comments.py`: `check_*` 패턴(TestClient + 실제 DB +
  생성물 정리)으로 작성→목록(정렬)→수정→삭제, 작성자 외 수정/삭제 403, 카드
  `comment_count` 반영을 확인.

## 구현 메모

- 라우트는 `follows.py`의 user-selection 기반 쓰기 + ownership 체크 패턴을 따름
  (새 권한 추상화 없음 — v0.6.x 인증에서 일괄 강화).
- 작성자 account 해석은 `post_filters.get_user_account_id`(검증/404 포함)를
  재사용하고, batch 해석은 `Account.user_id IN (...)`.
- `comment_count` 배치 집계는 `get_assets_by_post_id`/facet 집계와 같은 서비스
  계층 패턴(`app/services/comments.py`).
- post 삭제 시 댓글 정리: `delete_post`가 post의 자식 댓글을 함께 삭제(FK 고아
  방지). asset 삭제와 동일한 자리.

## 정책 / 주의

- **인증은 범위 밖(v0.6.x).** 작성자 식별은 active user selection이며 real auth가
  아닙니다.
- **generic 협업 개념.** `Comment`는 설비 전용 용어가 아니므로 새 모델로 허용.
  도메인 값은 계속 `metadata`로.
- **external package format 무변경.** 댓글은 앱 내부 사용자 행동.
- **회귀 안전.** post 목록/필터/정렬/cursor 경로 불변. `comment_count`는 기본 0
  additive 필드라 기존 직렬화/mock 동작에 영향 없음.
- **API mode 전용.** mock 모드 PostDetail은 댓글 섹션 미노출.

## Non-goals

```text
대댓글(threading) / 리치 텍스트 / 멘션·태그 자동완성
like / reaction (테마 후속, 북마크 사용 양상 본 뒤 결정)
북마크 / 알림 / mention 수신 (v0.5.1 / v0.5.2)
타인 댓글 수정·삭제 / 모더레이션 (인증 v0.6.x 이후)
mock mode 댓글 UI
external package format 변경
```

## 검증 요약

1. `npm run build`(tsc+vite) 통과, `npm run lint` 신규 에러 0건.
2. `POST /api/posts/{id}/comments` → 201 + 작성자 account 포함. 빈 text 422.
3. `GET .../comments?sort=oldest|newest` → 작성순/역순 정렬, 작성자 신원 포함.
4. `PATCH /api/comments/{id}` 작성자 본인 → 수정 + `updated_at` 갱신, 타인 403.
5. `DELETE /api/comments/{id}?user_id=` 작성자 본인 → 204, 타인 403, 없으면 404.
6. 목록/피드 카드에 `comment_count` 반영(`💬 N`), 댓글 0건이면 칩 미표시.
7. post 삭제 시 그 post의 댓글도 사라짐(고아 없음).
8. PostDetail에서 작성→수정→삭제 + 정렬 토글 + 빈/로딩/실패 상태 동작.
   댓글·caption 본문의 `@handle`은 계정 링크, `#tag`는 `/posts?tag=` 링크로 렌더.
9. mock 모드에서는 댓글 섹션이 노출되지 않고 기존 동작 유지.
10. `scripts/check_comments.py` 통과. golden sample dry-run 회귀 통과.
```
