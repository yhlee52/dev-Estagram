# PROJECT_GOALS.md

## MVP5: Backend & DB Skeleton

MVP5 prepares the project for a future API and database-backed version without replacing the completed MVP1-MVP4 local/static frontend behavior.

The goal is to introduce and document a backend/database skeleton direction:

```text
Backend: FastAPI
Database: PostgreSQL
ORM / DB layer: SQLModel
Migration: Alembic
File storage: backend/uploads/ local folder only
Backend location: backend/
```

MVP5 should keep the core domain generic: `User`, `Account`, `Post`, `Feed`, `Follow`, `Asset`, and `Metadata`. Company-internal equipment reports remain one possible data scenario only. Do not rename core types, shared components, routes, or data flow around equipment/report-specific terms such as Equipment, Chamber, Sensor, Recipe, Severity, or Report.

Planned backend tables:

```text
users
accounts
posts
post_assets
follows
```

For MVP5, `User` and `Account` remain 1:1. A `User` is the viewer/person concept, and an `Account` is the publishing entity for Posts.

Planned read-only API endpoints:

```text
GET /health
GET /api/users
GET /api/accounts
GET /api/posts
GET /api/follows
GET /api/feed?user_id=...
```

MVP5 mock and seed data policy:

```text
frontend mock JSON stays in place
MVP4 localStorage user/follow flows stay in place
frontend is not converted to API data yet
backend seed data is separate and used for PostgreSQL verification
real PostgreSQL database files are not committed
database state must be reproducible from Alembic migrations plus seed scripts
```

MVP5 should not implement:

```text
backend feature code beyond the planned skeleton stage
real login
authentication
authorization
password handling
tokens
POST/PUT/PATCH/DELETE APIs
admin UI
file upload API
S3 integration
frontend API migration
removal of frontend mock JSON
comments
likes
bookmarks
search
tag pages
equipment-report-specific core naming
```

The next implementation step after this documentation pass is MVP5-1: create the backend skeleton.

## MVP4: Local User Entry & Registration Flow

MVP4 adds a local user entry and local registration flow on top of the existing local/static feed prototype.

The goal is to let a user naturally enter the app by id or handle without introducing a backend, database, authentication, passwords, tokens, secure sessions, authorization, or account security.

Current MVP4 implementation:

```text
1. If there is no active user, show a User Entry screen.
2. Let the user enter an id or handle.
3. If the entered id/handle matches an existing effective User, set that User as active.
4. If the entered id/handle does not match, guide the user to local registration.
5. Local registration creates one new User and one corresponding Account.
6. During the MVP stage, User and Account should remain 1:1.
7. Store new local user/account records in localStorage.
8. Initialize the new user's follow state in localStorage.
9. Keep active user state in localStorage under local-feed-active-user-id.
10. Provide logout and switch user flows.
11. Preserve MVP3 user-specific follow, feed, and /me behavior.
```

The entry flow works like this:

```text
1. The user enters a local user id or handle.
2. If the value matches an existing effective User, the app sets that User as active.
3. If the value does not match, the app offers local registration.
4. Local registration creates one User and one Account for that User.
5. The new User, Account, and initial empty follow state are saved in localStorage.
6. The app sets the new User as active and enters the feed experience.
```

MVP4 should not implement:

```text
real login
passwords
authentication tokens
secure sessions
authorization
backend API
database
runtime writes to src/data/*.json
post create/update/delete
comments
likes
bookmarks
search
tag aggregation
tag pages
```

Runtime data should be treated as effective data composed from static JSON plus localStorage overlays:

```text
effective users = src/data/users.json + localStorage local user records
effective accounts = src/data/accounts.json + localStorage local account records
effective follow state = src/data/follows.json + localStorage follow records
```

Current localStorage keys:

```text
active user id = local-feed-active-user-id
local users = local-feed-local-users
local accounts = local-feed-local-accounts
user follow state = local-feed-following-by-user
```

The static JSON files remain seed data. Runtime local registration does not write to `src/data/*.json`. If browser localStorage is cleared, locally registered users, accounts, and follow changes can disappear.

Use generic core concepts: `User`, `Account`, `Post`, `Feed`, `Follow`, `Asset`, and `Metadata`. Company-internal equipment reports remain one possible data scenario only. Equipment-report-specific values should stay in `metadata` or asset metadata, not in core type names, routes, or primary component names.

Prefer local user entry and local registration language. Avoid code and documentation names that imply real auth/security is implemented. `Logout`, `Switch user`, and similar user-facing actions may be used, but in MVP4 they only clear the active local user id from localStorage. They do not end a secure session.

# Instagram-like Local Feed Prototype 프로젝트 목표

## 1. 프로젝트 목표

이 프로젝트의 목표는 **범용 Instagram-like local feed 애플리케이션**을 만드는 것이다.

이 앱은 일반적인 SNS 서비스처럼 운영되는 대규모 온라인 서비스를 목표로 하지 않는다.
대신, 여러 계정이 게시물을 올리고, 사용자가 관심 있는 계정을 follow하여 해당 계정들의 게시물을 피드에서 보는 **가벼운 로컬 피드 껍데기**를 만드는 것이 목표다.

핵심 구조는 다음과 같다.

```text
Account
→ Post를 발행
→ User가 Account를 follow
→ Home Feed에서 follow한 Account들의 Post를 확인
→ 각 Account는 자신의 Profile page를 가짐
```

첫 번째 버전은 서버나 데이터베이스 없이, JSON 파일과 로컬 이미지/에셋을 사용하는 정적 데이터 기반 프로토타입으로 구현한다.

MVP3의 목표는 **Multi-user Local Feed Base**다. 여러 로컬 User 중 현재 active user를 선택하고, active user별로 follow 상태와 Home Feed를 분리하는 기반을 만든다. 이 User는 실제 로그인 계정이 아니라 정적 JSON과 `localStorage`로 동작하는 로컬 프로필이다.

MVP3는 실제 인증/보안 기능이 아니다. active user selector는 로컬 프로토타입에서 앱을 어떤 User 관점으로 볼지 바꾸는 장치이며, 비밀번호, 토큰, 권한, 서버 세션을 만들지 않는다.

MVP3에서 구현할 것:

```text
User 타입
src/data/users.json
active user 선택 기능
active user localStorage 저장 (`local-feed-active-user-id`)
user별 follow 상태 분리
user별 follow localStorage 저장 (`local-feed-following-by-user`)
/me 페이지
```

MVP3에서 구현하지 않을 것:

```text
실제 로그인
비밀번호
인증 토큰
권한 관리
backend API
DB
게시물 작성/수정/삭제
댓글
좋아요
북마크
검색
태그 모아보기
tag pages
mock data 대규모 다양화
```

---

## 2. 장기 목표

이 프로젝트의 장기 목표는 **회사 내부 설비 리포트 피드**로 확장하는 것이다.

회사 내부 사용 시나리오는 다음과 같다.

```text
설비 = Account
Daily analysis report = Post
플롯 / 차트 / 테이블 / 텍스트 요약 = Post asset
엔지니어 = User
관심 설비 = Follow한 Account
```

각 설비는 하나의 bot account처럼 동작할 수 있다.
분석 알고리즘이 매일 특정 설비의 분석 리포트를 생성하면, 해당 리포트가 설비 계정의 게시물처럼 등록된다.

엔지니어는 자신이 관심 있는 설비를 follow하고, 해당 설비들의 daily report를 familiar한 feed UI에서 확인할 수 있다.

하지만 이 앱을 처음부터 설비 모니터링 시스템으로 고정해서 만들지는 않는다.
회사 밖에서도 동일한 코드베이스를 개인용 또는 사적 관리용 feed 앱으로 사용할 수 있어야 한다.

즉, 이 프로젝트는 **회사 내부 설비 리포트 feed**와 **회사 밖 개인/일반 feed**를 모두 지원할 수 있는 범용 구조를 목표로 한다.

---

## 3. 회사 밖 일반 사용 시나리오

회사 밖에서는 같은 앱을 일반적인 계정/게시물 기반 피드로 사용할 수 있다.

예시 Account:

```text
- 개인 일기 계정
- 사진 기록 계정
- 여행 bot
- 카페 bot
- 운동 기록 bot
- AI 요약 bot
- 프로젝트 상태 bot
```

예시 Post:

```text
- 개인 메모
- 사진
- 자동 생성 요약
- 차트
- 작은 리포트
- 테이블
- 로그
```

따라서 앱은 특정 회사나 설비 도메인에 종속되지 않아야 한다.
계정 데이터와 게시물 데이터만 바꾸면 다른 목적의 local feed로 사용할 수 있어야 한다.

---

## 4. 핵심 도메인 모델

이 프로젝트의 핵심 도메인은 범용적이어야 한다.

코어 모델에서는 다음 개념을 사용한다.

```text
Account
User
Post
Feed
Follow
Asset
Metadata
Profile
```

반대로, 아래와 같은 회사/설비 특화 개념을 코어 타입으로 직접 사용하지 않는다.

```text
Equipment
Chamber
Sensor
Recipe
Severity
Report
```

이러한 개념들은 필요할 경우 `metadata` 또는 asset의 부가 정보로 표현한다.
즉, 설비 리포트는 이 앱의 한 사용 사례일 뿐이며, 앱의 기본 구조를 결정하는 도메인이 되어서는 안 된다.

---

## 5. Account 개념

Account는 게시물을 발행하는 주체다.

User와 Account는 구분한다. User는 현재 앱을 어떤 로컬 사용자 관점으로 보고 있는지를 나타내는 viewer이고, Account는 Post를 발행하는 feed 주체다. User는 `account_id`를 통해 자신과 연결된 Account를 가질 수 있지만, User 자체가 인증 계정이나 서버 계정이 되는 것은 아니다.

Account는 다음과 같은 형태가 될 수 있다.

```text
- 일반 개인 계정
- 가상 계정
- bot 계정
- 프로젝트 계정
- 리포트 생성 계정
- 향후 회사 내부 설비 계정
```

회사 내부 사용 시에는 하나의 설비 또는 하나의 설비-챔버 조합이 하나의 Account가 될 수 있다.

회사 밖 일반 사용 시에는 일기, 사진, 여행, 운동, 개인 관리 항목 등 원하는 단위를 Account로 만들 수 있다.

---

## 6. Post 개념

Post는 Account가 발행하는 feed item이다.

Post는 다음 정보를 가질 수 있다.

```text
- 제목
- 본문 또는 caption
- 생성 일시
- 태그
- Asset 목록
- Metadata
```

Post는 단순 사진 게시물에만 한정되지 않아야 한다.

향후 다음과 같은 다양한 내용을 담을 수 있어야 한다.

```text
- 이미지
- 플롯
- 차트
- 테이블
- JSON 기반 결과
- HTML 리포트 링크
- Markdown/text block
```

첫 번째 버전에서는 정적 JSON과 이미지 asset만 사용하더라도, 구조 자체는 이후 리포트형 게시물로 확장 가능해야 한다.

---

## 7. Asset 개념

Asset은 Post에 첨부되는 콘텐츠 단위다.

예시 asset type:

```text
image
plot
chart
table
html
json
text
```

개인용 feed에서는 image asset이 사진일 수 있다.

설비 리포트 feed에서는 image asset이 trend plot, chart, 분석 시각화 결과일 수 있다.

table asset은 향후 ranking 결과, summary statistics, daily analysis output 등을 표현할 수 있다.

초기 구현에서는 asset을 단순히 이미지 중심으로 표시하더라도, 타입 구조는 다양한 asset을 허용할 수 있게 설계한다.

---

## 8. Metadata 개념

Metadata는 Account나 Post에 붙는 선택적 확장 정보다.

Metadata는 특정 사용 시나리오에만 필요한 정보를 담는 용도로 사용한다.
이를 통해 코어 도메인 모델을 바꾸지 않고도 설비 리포트, 개인 기록, 프로젝트 로그 등 다양한 용도로 확장할 수 있다.

예를 들어 설비 리포트 Post는 다음과 같은 metadata를 가질 수 있다.

```json
{
  "status": "Watch",
  "severity_score": 0.83,
  "top_channel": "TEMP_01",
  "top_step": 3
}
```

개인 기록 Post는 다음과 같은 metadata를 가질 수 있다.

```json
{
  "mood": "calm",
  "location": "Seoul",
  "weather": "sunny"
}
```

UI는 metadata를 특정 도메인에 종속된 방식으로 해석하기보다, 기본적으로 key-value 형태로 표시할 수 있어야 한다.

---

## 9. Follow와 Feed 개념

사용자는 관심 있는 Account를 follow할 수 있다.

Home Feed는 사용자가 follow한 Account들의 Post만 보여준다.

MVP3부터 follow 상태는 active user별로 분리한다. active user를 바꾸면 Home Feed, Accounts, Account Profile에서 보이는 follow 상태도 해당 User의 상태로 바뀌어야 한다.

기본적인 feed 생성 과정은 다음과 같다.

```text
1. Account 목록을 불러온다.
2. Post 목록을 불러온다.
3. 사용자가 follow한 Account ID 목록을 불러온다.
4. Post를 follow한 Account 기준으로 필터링한다.
5. created_at 기준 최신순으로 정렬한다.
6. Feed card 형태로 렌더링한다.
```

로컬 프로토타입에서는 active user와 follow 상태를 `localStorage`에 저장한다.

현재 저장 key는 다음과 같다.

```text
active user id = local-feed-active-user-id
user별 follow 상태 = local-feed-following-by-user
```

---

## 10. 필수 화면

첫 번째 사용 가능한 프로토타입에는 다음 화면들이 필요하다.

## 10.1 Home Feed

사용자가 follow한 Account들의 Post를 보여주는 화면이다.

필수 동작:

```text
- follow한 Account의 Post만 표시
- 최신순 정렬
- 각 Post card에 Account 정보 표시
- title, text/caption, asset, tag, created_at 표시
- Post detail로 이동 가능
- Account profile로 이동 가능
```

## 10.2 Accounts / Explore

전체 Account 목록을 보여주는 화면이다.

필수 동작:

```text
- 전체 Account 목록 표시
- avatar, display name, handle, bio 표시
- follow / unfollow 가능
```

## 10.3 Account Profile

특정 Account의 profile과 게시물 목록을 보여주는 화면이다.

필수 동작:

```text
- Account 정보 표시
- 해당 Account가 발행한 Post 목록 표시
- follow / unfollow 가능
- Post detail로 이동 가능
```

## 10.4 Post Detail

특정 Post의 전체 내용을 보여주는 화면이다.

필수 동작:

```text
- Account 정보 표시
- title 표시
- text/caption 표시
- 모든 asset 표시
- tag 표시
- created_at 표시
- metadata가 있으면 표시
```

## 10.5 Me

현재 active user의 개인 영역을 보여주는 화면이다.

필수 동작:

```text
- active user 정보 표시
- active user의 `account_id`와 연결된 Account 표시
- 내가 follow한 Account 수 표시
- 연결된 Account가 발행한 Post 목록 표시
- Account profile과 Post detail로 이동 가능
```

---

## 11. 초기 구현 범위

첫 번째 구현은 로컬 기반의 단순한 프론트엔드 프로토타입으로 한다.

사용 기술:

```text
Vite
React
TypeScript
Tailwind CSS
React Router
Static JSON files
Static local assets
localStorage
```

첫 번째 버전에서 구현하지 않는 것:

```text
Backend API
Database
Authentication
Real login or user account system
Password
Auth token
Authorization
Likes
Comments
Bookmarks
Notifications
Image upload
File write logic
Post create/update/delete
Search
Tag aggregation
Tag pages
Server deployment
Real-time update
```

첫 번째 목표는 안정적인 데이터 구조와 깔끔한 프론트엔드 껍데기를 만드는 것이다.

---

## 12. 데이터 기반 설계

이 앱은 데이터 파일 기반으로 동작해야 한다.

초기 데이터 파일은 다음과 같이 구성할 수 있다.

```text
src/data/accounts.json
src/data/users.json
src/data/posts.json
src/data/follows.json
```

MVP3 기준 데이터 구조:

```text
users.json: id, display_name, handle, avatar?, bio?, account_id?, metadata?
follows.json: user_id, following_account_ids
```

정적 asset은 다음 경로 아래에 둘 수 있다.

```text
public/assets/
```

앱은 데이터와 asset을 교체하는 것만으로 다른 목적으로 사용할 수 있어야 한다.

즉, 같은 코드베이스가 다음 두 가지 시나리오를 모두 지원해야 한다.

```text
1. 회사 밖 개인/일반 local feed
2. 회사 내부 설비 분석 리포트 feed
```

---

## 13. UI 방향

UI는 Instagram-like feed 느낌을 참고하되, Instagram을 그대로 복제하는 것을 목표로 하지 않는다.

디자인 방향:

```text
- 모바일 우선 레이아웃
- Feed card
- Account avatar
- Account profile page
- Bottom navigation
- 깔끔한 typography
- 단순한 tag pill
- Asset preview
- 자연스러운 empty state
```

개인용 게시물과 기술 리포트 게시물이 모두 어색하지 않게 보이는 단순하고 읽기 쉬운 디자인을 목표로 한다.

---

## 14. 핵심 설계 원칙

이 프로젝트에서 가장 중요한 원칙은 다음과 같다.

```text
먼저 범용 Account / Post / Feed 시스템을 만든다.
설비 리포트는 이후 적용 가능한 데이터 시나리오 중 하나로 취급한다.
```

따라서 처음부터 회사 특화 dashboard를 만들지 않는다.

먼저 범용 feed shell을 만들고, 이후 그 위에 설비 분석 리포트 데이터를 얹는다.

---

## 15. 첫 번째 마일스톤

첫 번째 마일스톤은 다음 조건을 만족하면 완료로 본다.

```text
1. 앱이 accounts, posts, follows 데이터를 JSON에서 읽을 수 있다.
2. Home Feed에서 follow한 Account의 Post만 볼 수 있다.
3. Accounts page에서 follow / unfollow를 할 수 있다.
4. 각 Account는 profile page를 가진다.
5. 각 Post는 detail page를 가진다.
6. Post는 text, image-like asset, tag, metadata를 표시할 수 있다.
7. 앱의 핵심 구조가 설비 특화 용어에 종속되지 않는다.
8. TypeScript build가 정상적으로 통과한다.
```

이 단계에서는 실제 설비, 실제 리포트, 실제 backend와 연결될 필요가 없다.
