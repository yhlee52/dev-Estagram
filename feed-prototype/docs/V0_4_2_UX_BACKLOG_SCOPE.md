# V0_4_2_UX_BACKLOG_SCOPE.md

`feed-prototype` v0.4.2 — **UX backlog 반영 (v0.4.x 테마 마지막 MINOR)** 상세
scope 문서입니다.

`ROADMAP.md` 규칙대로 각 MIDDLE 테마의 마지막 MINOR는 `UX_BACKLOG.md` 반영용
예약 슬롯입니다. 이 MINOR로 v0.4.x(메타데이터 일급화 & 트리아지) 테마를
완료합니다.

## 배경

`UX_BACKLOG.md`의 Open 항목은 1건(Me 탭 "내가 팔로우한 계정" 목록)뿐이며,
메모대로 북마크/언급됨과 함께 **v0.5.x(협업)**에서 다루는 게 자연스러워 의도적
이연 상태입니다(metadata 읽기와 무관). 따라서 이 MINOR의 실제 작업은 이번
테마(v0.4.0/v0.4.1)에서 새로 생긴 UX 거친 부분 다듬기 + 테마 완료 문서 일괄
정리입니다. 코드+문서 변경 폭이 있어 `x.y.0` 관례 외 별도 MINOR(v0.4.2)로
승격했습니다.

## Goals

### 1. 카드 metadata 중복 제거

- v0.4.1에서 `FeedCard`가 pinned 칩(`PinnedMetadataChips`)과 generic
  `MetadataSummary`(상위 3개)를 함께 렌더 → pin한 key가 카드에 두 번 표시됨.
- `MetadataSummary`에 `excludeKeys` prop 추가, `FeedCard`가 pinned key를
  넘겨 summary에서 제외. `PinnedMetadataChips`는 `pinnedKeys`를 prop으로 받아
  (hook 직접 호출 제거) 카드가 같은 목록을 재사용하도록 정리.

### 2. metadata 정렬 기대치 안내

- metadata 값 정렬은 그 key 가진 post만 보여주므로 결과 수가 조용히 줄어듦.
  필터 패널에 "Sorting by “<key>” — only posts that have this metadata key are
  shown." 한 줄 안내 추가(정렬 활성 + key 선택 시).

### 3. 테마 완료 문서 일괄 갱신

- `V0_4_1_CARD_METADATA_SORT_SCOPE.md`(이 MINOR와 함께 작성), 본 문서 추가.
- `V0_4_X_METADATA_PLAN.md` 진행 현황, `ROADMAP.md` v0.4.x MINOR 목록(v0.4.2
  포함), `docs/README.md` 릴리즈 라벨·색인 갱신.
- `UX_BACKLOG.md`: 이번 테마 UX 항목 Resolved 기록, Me Following은 v0.5.x
  이연 유지.

## 구현 메모

- `src/components/MetadataSummary.tsx`: `excludeKeys?: string[]` (기본 []).
- `src/components/PinnedMetadataChips.tsx`: `pinnedKeys: string[]` prop화.
- `src/components/FeedCard.tsx`: `usePinnedMetadataKeys` 1회 호출 후 칩/summary에
  전달.
- `src/components/PostFilterPanel.tsx`: 정렬 안내 문구.
- `src/config/appVersion.ts`: `v0.4.1` → `v0.4.2`.

## 정책 / 주의

- 기능 추가가 아닌 폴리시 + 문서 정리 중심. 신규 도메인 결합 없음.
- `MetadataSummary` `excludeKeys` 기본값은 빈 배열이라 다른 사용처 동작 불변.

## Non-goals

```text
Me 탭 Following 목록 (v0.5.x 협업으로 이연 — backlog Open 유지)
숫자 정렬, pinned keys URL/계정 동기화 (테마 후속 후보)
신규 metadata 기능
```

## 검증 요약

1. `npm run build`(tsc+vite) 통과, `npm run lint` 신규 에러 0건.
2. key를 pin한 뒤 카드에서 해당 key가 칩으로만 1회 표시되고
   `MetadataSummary`에는 중복 표시되지 않음.
3. metadata 정렬 활성 + key 선택 시 안내 문구 표시.
4. 문서 색인/진행 현황이 v0.4.2(테마 완료) 기준으로 일관.
