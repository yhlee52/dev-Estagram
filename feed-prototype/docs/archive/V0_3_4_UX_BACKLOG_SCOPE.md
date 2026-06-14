# V0_3_4_UX_BACKLOG_SCOPE.md

`feed-prototype` v0.3.4 — **v0.3.x 테마 마지막 MINOR: UX backlog 반영**

이 문서는 v0.3.x(Ingestion 신뢰성) 테마의 마지막 MINOR 슬롯 scope입니다.
`ROADMAP.md` 규칙대로 각 MIDDLE 테마의 마지막 MINOR는 `UX_BACKLOG.md`에 쌓인
항목 반영용으로 예약되어 있습니다. 이 릴리즈로 v0.3.x 테마를 마감합니다.

## 1. 목표

`UX_BACKLOG.md` Open 항목 중 합의된 2건을 반영합니다.

1. **Me 탭 내 post "Load more"** — API 모드 Me 탭이 내 post 전량을 한 번에
   렌더하던 것을, 일정 개수씩 점진적으로 렌더하도록 변경.
2. **공용 ConfirmDialog** — post 삭제 확인이 브라우저 `window.confirm`이라 앱
   톤과 이질적이고 스타일/포커스 제어가 불가능했던 것을, 앱 스타일의 모달
   컴포넌트로 교체.

Backlog Open 3번째 항목(Me 탭 Following 목록/바로가기)은 backlog 메모대로
v0.5.x 협업 단계에서 북마크/언급됨과 함께 다루므로 이번 범위에서 제외합니다.

## 2. 결정 사항

### 2.1 Me 탭 페이지네이션 — 클라이언트 사이드 점진 렌더

- backlog 메모는 "Explore/Home처럼 cursor 기반 더 보기"를 제안했으나, Me 탭의
  **활동 요약(v0.2.3)** 은 정확한 총 post 수·최근 N일 수·마지막 활동 시각을
  보여주며 이는 **전체 post 집합을 필요로** 합니다. 즉 활동 요약 때문에 어차피
  전량 fetch가 필요합니다(코드베이스의 `getAllPosts` docstring도 "aggregate
  needs / per-account counts" 용도로 전량 fetch를 허용). 이 상태에서 서버
  cursor 페이지네이션을 추가하면 **중복 fetch**(전량 + 페이지)가 됩니다.
- 따라서 가장 큰 비용인 **렌더(수백 개의 `FeedCard`/lightbox 동시 mount)** 만
  해소하는 클라이언트 사이드 점진 렌더를 택합니다. 단일 fetch 유지 → 활동 요약
  정확성 유지 → 표시 카드만 `MY_POSTS_PAGE_SIZE`(20)개씩 "Load more"로 확장.
- 백엔드 변경 없음. `getAccountPosts` fetch 경로·활동 요약 계산 모두 그대로.
- AccountProfile도 동일한 잠재 이슈가 있으나 backlog 항목은 `/me` 만 명시하므로
  이번 범위에서 제외(후속 후보).

### 2.2 ConfirmDialog — 통제된 모달 컴포넌트

- 신규 `src/components/ConfirmDialog.tsx`. `AssetLightbox`의 오버레이 관례를
  따름: `fixed inset-0 z-50` 오버레이, `role="dialog"`/`aria-modal`, Escape로
  취소, 백드롭 클릭으로 취소, mount 시 confirm 버튼에 포커스.
- 부모가 제어(controlled): 확인이 필요한 동안에만 렌더. props는
  `title`/`description`/`confirmLabel`/`cancelLabel`/`danger`/`isConfirming`/
  `onConfirm`/`onCancel`.
- `isConfirming` 동안 버튼 비활성화 + Escape/백드롭 닫기 차단(중복 실행 방지).
- 교체 대상 2곳: `MyPostCard`(Me 탭 인라인 삭제), `PostDetail`(상세 삭제).
  두 곳 모두 기존 삭제 로직·에러 처리(`getDeletePostErrorMessage`)는 유지하고
  `window.confirm` → 다이얼로그 open/onConfirm 흐름으로만 변경.

## 3. 변경 파일

- `src/components/ConfirmDialog.tsx` — 신규 공용 확인 모달.
- `src/components/MyPostCard.tsx` — `window.confirm` 제거, ConfirmDialog 연결.
- `src/pages/PostDetail.tsx` — `window.confirm` 제거, ConfirmDialog 연결.
- `src/pages/MePage.tsx` — API 모드 내 post 목록에 `visibleCount` 윈도우 +
  "Load more" 버튼(활동 요약은 전체 기준 그대로).
- `src/config/appVersion.ts` — `APP_VERSION` `v0.3.4`.
- 문서: `AGENTS.md`, `docs/README.md`, `docs/UX_BACKLOG.md`,
  `docs/V0_3_X_INGESTION_PLAN.md`.

## 4. 비범위 (non-goals)

```text
서버 사이드 cursor 페이지네이션 / 새 backend 엔드포인트
AccountProfile 등 다른 화면의 페이지네이션 (backlog는 /me만 명시)
mock 모드 Me 탭 변경 (정적 데이터 소량, 데모 동결)
ConfirmDialog의 전역 context/provider화 (현재 2곳, controlled로 충분)
backlog Following 목록/바로가기 (v0.5.x)
external package format / DB 스키마 / 마이그레이션 변경
```

## 5. 검증

- `npm run build`(tsc + vite) 통과.
- lint는 기존 baseline 5건 유지(신규 회귀 0): `AssetLightbox.tsx`
  set-state-in-effect 1, `AssetRenderer.tsx` set-state-in-effect 1,
  `PostFilterPanel.tsx` react-refresh 3. 신규/수정 파일에서 신규 경고 없음.
- 수동 확인(API 모드): Me 탭에서 post가 페이지 크기를 넘으면 "Load more"가
  노출되고 클릭 시 추가 렌더, 활동 요약의 총 post 수는 전체를 반영. 삭제
  버튼은 앱 스타일 다이얼로그를 띄우고 확인 시에만 삭제, 취소/Escape/백드롭은
  삭제하지 않음.
