# Instagram-like Local Feed Prototype

## MVP4 Goal: Local User Entry & Registration Flow

MVP4 adds a local user entry flow so the app can feel like it starts from "my id" without adding a backend, database, or authentication system.

In MVP4, users should be able to enter an id or handle. If it matches an existing effective `User`, that user becomes the active user. If it does not match, the app should guide the user into local registration.

Local registration creates a new `User` and a 1:1 corresponding `Account`. These local records are stored in `localStorage`; the app must not write to `src/data/*.json` at runtime. The new user's follow state is initialized in `localStorage`, and the active user remains stored under `local-feed-active-user-id` after refresh.

The runtime data model for MVP4 should be effective data:

```text
effective users = static users.json + localStorage user overlay
effective accounts = static accounts.json + localStorage account overlay
effective follow state = static follows.json + localStorage follow overlay
```

MVP4 still does not implement real login, signup, passwords, auth tokens, secure sessions, authorization, backend APIs, databases, JSON file writes, post creation/editing/deletion, comments, likes, bookmarks, search, tag aggregation, or tag pages. UI may expose a `Logout` action, but in this prototype logout only clears the active local user.

Vite, React, TypeScript로 만든 범용 로컬 feed 프로토타입입니다.

이 프로젝트의 핵심은 `User`, `Account`, `Post`, `Feed`, `Follow`, `Asset`, `Metadata`를 기반으로 한 작은 Instagram-like feed 껍데기입니다. 개인 사진/메모 feed처럼 사용할 수도 있고, 같은 구조 위에 회사 내부의 daily report, 작업 로그, 점검 기록, 분석 결과 같은 리포트형 feed를 얹을 수도 있습니다.

현재 단계에서는 서버, 데이터베이스, 인증, 업로드 없이 정적 JSON 데이터와 로컬 정적 asset만 사용합니다.

## 현재 MVP 기능

- Home Feed에서 follow 중인 Account의 Post를 최신순으로 볼 수 있습니다.
- Accounts / Explore 화면에서 전체 Account 목록을 볼 수 있습니다.
- Account를 follow / unfollow할 수 있습니다.
- Header에서 active user를 선택할 수 있고, 선택된 user는 `localStorage`에 저장됩니다.
- Follow 상태는 active user별로 분리되어 Home Feed, Accounts, Account Profile에 반영됩니다.
- `/me` 화면에서 현재 active user의 정보, 연결된 Account, follow 수, 연결 Account의 Post를 볼 수 있습니다.
- 각 Account는 Profile 페이지를 가집니다.
- 각 Post는 Detail 페이지를 가집니다.
- Post card와 detail에서 title, caption, tags, createdAt, asset, metadata를 표시합니다.
- 이미지형 asset과 텍스트/차트/테이블/JSON 등 확장 가능한 asset 구조를 사용합니다.
- core domain은 특정 회사 내부 리포트 용어가 아니라 범용 feed 모델을 기준으로 유지합니다.

## MVP3 목표: Multi-user Local Feed Base

MVP3의 목표는 실제 로그인 시스템이 아니라, 여러 로컬 User 중 active user를 선택하고 그 User별로 feed 상태를 분리하는 기반을 만드는 것입니다.

MVP3에서 구현된 범위:

- `User` 타입과 `users.json`을 추가합니다.
- 현재 active user를 선택할 수 있게 합니다.
- active user ID를 `localStorage`에 저장합니다.
- follow 상태를 user별로 분리해 `localStorage`에 저장합니다.
- active user 변경 시 Home Feed, Accounts, Account Profile의 follow 상태가 함께 바뀌게 합니다.
- `/me` 페이지에서 현재 User의 개인 영역, 연결된 Account, 해당 Account의 Post를 확인할 수 있게 합니다.

저장에 사용하는 `localStorage` key:

- active user ID: `local-feed-active-user-id`
- user별 follow 상태: `local-feed-following-by-user`

MVP3에서 구현하지 않는 것:

- 실제 로그인, 비밀번호, 인증 토큰, 권한 관리
- backend API, DB
- 게시물 작성/수정/삭제
- 댓글, 좋아요, 북마크
- 검색, 태그 모아보기, tag pages
- mock data 대규모 다양화

## 기술스택

- Vite
- React
- TypeScript
- Tailwind CSS
- React Router
- Static JSON files
- Static local assets

## 설치 및 실행 방법

Vite 앱 디렉터리로 이동합니다.

```bash
cd feed-prototype
```

의존성을 설치합니다.

```bash
npm install
```

개발 서버를 실행합니다.

```bash
npm run dev
```

프로덕션 빌드를 확인합니다.

```bash
npm run build
```

## 데이터 구조

초기 데이터는 `feed-prototype/src/data` 아래의 정적 JSON 파일에서 읽습니다.

MVP3부터는 다음 데이터 파일을 사용합니다.

- `users.json`: 로컬 User 목록과 User가 연결한 Account ID
- `accounts.json`: 게시물을 발행하는 Account 목록
- `posts.json`: Account가 발행한 Post 목록
- `follows.json`: User별 초기 follow 상태

### accounts.json

`accounts.json`은 게시물을 발행하는 주체인 Account 목록입니다.

Account는 일반 사용자, bot, 조직, 내부 분석 계정 등 다양한 주체를 표현할 수 있습니다. 주요 필드는 다음과 같습니다.

User와 Account는 다릅니다. `User`는 이 로컬 앱을 현재 누구 관점으로 보고 있는지 나타내는 선택 가능한 viewer이고, `Account`는 Post를 발행하는 feed 주체입니다. MVP3의 User는 실제 로그인 계정이나 권한 주체가 아닙니다.

- `id`: Account를 식별하는 고유 ID
- `handle`: feed에서 사용하는 짧은 계정명
- `displayName`: 화면에 표시되는 이름
- `avatarUrl`: avatar 이미지 경로
- `bio`: Account 소개
- `kind`: 계정 종류
- `metadata`: 시나리오별 확장 정보

### posts.json

`posts.json`은 Account가 발행한 Post 목록입니다.

Post는 사진, 메모, 차트, 테이블, 분석 결과 등 다양한 feed item을 표현합니다. 주요 필드는 다음과 같습니다.

- `id`: Post를 식별하는 고유 ID
- `accountId`: Post를 발행한 Account ID
- `title`: Post 제목
- `caption`: 본문 또는 짧은 설명
- `createdAt`: 생성 일시
- `tags`: tag 목록
- `assets`: Post에 첨부된 asset 목록
- `metadata`: status, mood, location, score 등 시나리오별 확장 정보

### users.json

`users.json`은 MVP3에서 추가되는 로컬 User 목록입니다. User는 인증 계정이 아니라 active user 선택과 user별 localStorage 상태 분리를 위한 로컬 프로필입니다.

주요 필드는 다음과 같습니다.

- `id`: User를 식별하는 고유 ID
- `display_name`: 화면에 표시할 이름
- `handle`: 화면에 표시할 짧은 user handle
- `avatar`: 선택적 avatar 이미지 경로
- `bio`: 선택적 소개 문구
- `account_id`: User와 연결된 Account ID
- `metadata`: 시나리오별 확장 정보

### follows.json

`follows.json`은 로컬 User별 초기 follow 상태입니다. 런타임 follow 상태는 active user별로 분리되어 `localStorage`에 저장됩니다.

주요 필드는 다음과 같습니다.

- `user_id`: follow 상태를 소유한 User ID
- `following_account_ids`: 해당 User가 follow한 Account ID 목록

## public/assets 사용 방식

정적 asset은 `feed-prototype/public/assets` 아래에 두고, JSON 데이터에서는 `/assets/...` 형태의 public path로 참조합니다.

예를 들어 Post asset의 `url`이 `/assets/posts/example.jpg`라면 실제 파일은 다음 위치에 둡니다.

```text
feed-prototype/public/assets/posts/example.jpg
```

Account avatar도 같은 방식으로 `/assets/avatars/...` 경로를 사용할 수 있습니다.

현재 데이터와 asset 파일만 교체하면 같은 앱 구조를 일반 개인 feed 또는 회사 내부 리포트형 feed로 재사용할 수 있습니다.

## Git에 올리지 않는 파일

`node_modules`와 `dist`는 생성물이며 Git에 올리지 않습니다.

- `node_modules`: `npm install`로 설치되는 의존성 디렉터리
- `dist`: `npm run build`로 생성되는 빌드 결과물

두 항목은 `feed-prototype/.gitignore`에 포함되어 있습니다.

## 향후 확장 방향

### 일반 개인 feed

- 개인 사진, 짧은 메모, 여행 기록, 카페 기록, 자동 요약 bot 게시물 등을 같은 `Account`와 `Post` 모델로 표현합니다.
- image, text, chart, table, json 등 여러 asset type을 조합해 다양한 게시물을 자연스럽게 표시합니다.

### 설비 리포트 feed

- 회사 내부에서는 Account를 설비, 엔지니어, 분석 bot 등으로 사용할 수 있습니다.
- Post는 daily report, 작업 로그, 점검 기록, 분석 결과를 담을 수 있습니다.
- 설비나 리포트에 특화된 값은 core type 이름으로 만들지 않고 `metadata` 또는 asset metadata에 저장합니다.
- 따라서 회사 내부 리포트 feed는 별도 전용 앱이 아니라 범용 local feed 모델 위에 얹히는 데이터 시나리오로 유지됩니다.
