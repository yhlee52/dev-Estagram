# V0_1_3_MENTION_SCOPE.md

`feed-prototype` v0.1.3 — **@mention 렌더링** 상세 scope 문서입니다.

`ROADMAP.md`의 v0.1.x(탐색과 발견) 테마 중 네 번째 버전이며, ROADMAP의
"개별 버전 구현 시 해당 버전의 상세 scope 문서(goals/non-goals)를 작성한 뒤
작업한다" 규칙에 따라 작성되었습니다.

## 배경

v0.1.1/v0.1.2에서 해시태그를 클릭 가능한 탐색 진입점으로 만들었습니다. post
본문에는 `@handle` 형태로 다른 계정을 언급하는 텍스트가 들어올 수 있지만, 지금은
단순 plain text라 언급된 계정으로 이동할 방법이 없습니다.

v0.1.3은 post 본문의 `@handle`을 해당 Account Profile 링크로 렌더링합니다.
해시태그와 마찬가지로 **frontend 렌더링만** 추가하며 backend/package format은
건드리지 않습니다. mention 저장, 알림, "나를 언급한 post" 목록은 v0.4.x로
미룹니다.

## Goals

- post 본문(caption)의 `@handle` 패턴을 Account Profile 링크(`/accounts/:id`)로
  렌더링합니다. PostCard(FeedCard)와 PostDetail 두 화면 모두 적용됩니다.
- **존재하지 않는 handle은 plain text로 fallback**합니다. 어떤 handle이 실제
  계정인지 판단하기 위해 계정 디렉터리(handle → account)를 참조합니다.
- handle 매칭은 대소문자 무시(case-insensitive)이며, 저장된 handle 형태
  (`mina.notes`, `cafe.route.bot`처럼 단어 사이 `.`/`-` 구분자)를 따릅니다.
  문장 끝 마침표(`@mina.notes.`)는 handle에 포함하지 않고, 이메일처럼 단어 중간에
  붙은 `@`(`user@host`)는 mention으로 보지 않습니다.
- FeedCard처럼 **카드 전체가 클릭 가능한 컨테이너** 안에 있을 때, mention 링크
  클릭이 카드의 post 이동으로 전파(bubble)되지 않습니다 (`stopPropagation`,
  해시태그 칩과 동일한 처리).
- 키보드 접근성: mention은 `<a>`(react-router `Link`)이므로 Tab 포커스 + Enter로
  이동 가능하고 focus ring을 가집니다.

## 구현 메모

- `src/utils/mentions.ts`: 순수 파서. `parseMentionSegments(text)`가 본문을
  text/mention 세그먼트 배열로 분리합니다. `@` 앞 문자가 단어 문자면(이메일 등)
  건너뜁니다. `normalizeMentionHandle`은 lookup용 정규화(앞 `@` 제거 + 소문자).
- `src/components/AccountDirectoryProvider.tsx`: 앱 전역 컨텍스트. handle →
  account 맵을 **한 번만** 구성합니다. mock mode는 `useEffectiveAccounts()`,
  API mode는 `GET /api/accounts`를 1회 fetch. 카드마다 재조회하지 않습니다.
  로드 실패는 비차단(non-fatal)이며 그 경우 모든 mention이 plain text가 됩니다.
  `App.tsx`에서 라우터 전체를 감쌉니다.
- `src/components/MentionText.tsx`: 세그먼트를 렌더링. 알려진 handle은
  `/accounts/:id` `Link`, 모르는 handle은 raw 텍스트. caption `<p>`를 대체하며
  기존 className(타이포/`whitespace-pre-wrap`)을 그대로 전달받습니다.
- 적용 지점: `FeedCard.tsx`, `PostDetail.tsx`의 caption 렌더 두 곳.

## 정책 / 주의

- **backend 변경 없음.** 기존 `GET /api/accounts`를 디렉터리 구성에 재사용합니다.
- mention 링크는 본문(caption)에만 적용합니다. 제목(title)은 헤딩이므로 범위 밖.
- API mode는 디렉터리를 fetch해 정확히 해석합니다. mock mode는 로컬 계정
  목록으로 해석합니다. 디렉터리에 없는 handle은 plain text입니다.
- external post package JSON format은 변경하지 않습니다. 기존 생성된 post에도
  소급 적용됩니다(렌더 시점 해석).

## Non-goals

```text
mention 저장 / 인덱싱 (post-mention 관계 영속화)
mention 알림, "나를 언급한 post" 목록 (v0.4.x)
mention 자동완성(작성 시 @ 입력 도움) — 읽기 렌더링만
title/asset/metadata 내 mention 렌더링
external package format 변경
```

## 검증 요약

1. `npm run build` 통과(tsc + vite). `npm run lint` 신규 에러 0건(기존 baseline
   유지).
2. caption에 존재하는 `@handle`이 있으면 Account Profile 링크로 렌더링되고
   클릭 시 `/accounts/:id`로 이동. FeedCard에서는 카드의 post 상세 이동이
   발생하지 않음.
3. 존재하지 않는 `@handle`은 plain text로 표시(이동 없음).
4. 이메일 형태(`user@host.com`)는 mention으로 링크되지 않음.
5. 문장 끝 마침표(`@mina.notes.`)에서 마침표는 링크에 포함되지 않음.
6. mention을 Tab으로 포커스 후 Enter로 이동 가능(focus ring 표시).
