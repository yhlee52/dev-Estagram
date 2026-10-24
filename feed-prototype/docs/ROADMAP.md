# 로드맵

버전은 `MAJOR.MIDDLE.MINOR`입니다. MAJOR는 제품 성격이 바뀔 때, MIDDLE은 기능
테마가 바뀔 때, MINOR는 그 테마 안의 집중된 변경에 사용합니다. 표시되는 릴리즈
라벨은 `src/config/appVersion.ts`가 기준입니다.

## 현재 구현

- v1.0.0 배포 기준선과 v1.0.1 UX 수정 이후, 소셜 피드의 기본 기능(게시글·댓글·
  좋아요·북마크·알림·1:1 메시지)이 구현되어 있습니다.
- 데이터는 로컬 PostgreSQL과 `EXTERNAL_POSTS_DIR`의 파일로 관리합니다. `incoming/`
  감시 import와 상대 경로 자산의 로컬 복사가 현재 운영 경로입니다.
- API 모드가 기능 검증용이며 mock 모드는 UI 데모 상태로 유지합니다.

## 다음 후보

- Rich Asset Experience: 이미지 확대/이동, PDF 미리보기, CSV 탐색 개선
- 로컬 데이터 운영 UX: import 실패 사유와 재시도 흐름, 자산 누락 확인
- 소셜 UX: 메시지 페이지네이션·읽음 상태, 좋아요 알림

테마별 마지막 MINOR는 `UX_BACKLOG.md`의 피드백 반영에 사용합니다. 새 작업은 한
MINOR에 한 가지 집중된 변경 묶음으로 계획합니다. 외부 post package 형식은 동결
상태이고 새 필드는 optional로만 추가합니다.
