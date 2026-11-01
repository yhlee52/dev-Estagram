# 과거 활동의 표시 시각

운영자가 관리하는 import 계정으로 과거 대화를 재구성할 때 댓글과 텍스트 메시지에
`display_at`을 지정할 수 있습니다. 기본값은 비활성입니다. 백엔드 실행 환경의
`ENABLE_HISTORICAL_DISPLAY_AT=true`로 명시적으로 활성화하고,
`python -m alembic upgrade head`로 DB를 갱신합니다.

- 입력: `POST /api/posts/{post_id}/comments`, `POST /api/messages/with/{account_id}`,
  `POST /api/messages/rooms/{room_id}/messages`의 JSON 본문에 선택적으로
  `"display_at": "2026-01-01T07:00:00+09:00"`을 추가합니다.
- 세션의 사용자 ID가 `import-user-`로 시작하는 계정에만 허용합니다. 시간대가 있는
  과거 시각만 받으며, 일반 계정이나 비활성 상태의 입력은 거부합니다.
- 응답의 `created_at`은 서버가 기록한 실제 전송 시각입니다. `display_at`은 화면에
  보여줄 시각이며, 값이 없으면 화면은 `created_at`을 사용합니다.
- 메시지 순서·방 가입 이후 조회·읽지 않은 메시지 수·전송 확인은 계속
  `created_at`을 사용합니다. DB의 `created_at`만 과거로 고치면 방 가입 전
  메시지로 처리될 수 있으므로 그렇게 수정하지 않습니다.
- 방 생성·초대·퇴장 시각과 이미지 메시지, 피드 import의 `created_at`은 이
  옵션의 범위가 아닙니다. 과거 피드의 시각은 기존 import 입력을 사용합니다.

이 옵션은 서비스의 표시 계약만 제공합니다. 과거 시점의 인물 정보와 사건 순서
검수는 콘텐츠 생산자가 별도로 수행해야 합니다.
