# 외부 게시글 패키지 가이드

외부 프로그램이 만든 JSON 패키지를 로컬 피드에 넣는 형식입니다. 기존 형식은 동결되어
있습니다. 기존 필드의 이름·의미를 바꾸거나 제거하지 않고, 새 필드는 optional로만
추가합니다. 같은 `external_id`로 재import하면 기존 데이터를 갱신합니다. 시간대가
없는 `created_at`도 허용합니다.

## 폴더와 JSON

이미지가 있는 패키지는 `feed_posts.json`과 자산 파일을 같은 폴더에 둡니다.

```text
my-batch/
  feed_posts.json
  assets/
    photo.png
```

`feed_posts.json`의 기본 구조:

```json
{
  "batch": {
    "external_id": "batch-weekend-001",
    "source": "local-generator",
    "created_at": "2026-10-24T09:00:00"
  },
  "accounts": [
    {
      "external_id": "account-gallery",
      "handle": "gallery",
      "display_name": "Gallery"
    }
  ],
  "posts": [
    {
      "external_id": "post-weekend-001",
      "account_external_id": "account-gallery",
      "title": "Weekend photos",
      "text": "A local sample post.",
      "created_at": "2026-10-24T09:00:00",
      "tags": ["weekend", "photo"],
      "metadata_json": {"source": "camera"},
      "assets": [
        {
          "external_id": "asset-weekend-001",
          "type": "image",
          "url": "assets/photo.png",
          "title": "First photo",
          "sort_order": 1
        }
      ]
    }
  ]
}
```

| 위치 | 필수 | 선택 |
| --- | --- | --- |
| 최상위 | `batch` | `accounts`, `posts` |
| `batch` | `external_id` | `source`, `created_at` |
| `accounts[]` | `external_id`, `handle`, `display_name` | `bio`, `avatar_url` |
| `posts[]` | `external_id`, `account_external_id`, `title` | `text`, `created_at`, `tags`, `metadata_json`, `assets`, `tagged_account_external_ids` |
| `assets[]` | `type`, `url` | `external_id`, `title`, `description`, `sort_order` |

`assets[].type`은 `image`, `plot`, `table`, `file`, `link` 중 하나입니다. 이미지와
plot은 갤러리, CSV table은 표 미리보기, file과 link는 열기 카드로 표시됩니다.
여러 자산은 `assets` 배열에 넣고 `sort_order`로 순서를 지정합니다. 제목은 200자,
본문은 5000자 이내입니다. `metadata_json`은 자유로운 JSON object로, 앱의 공통
도메인에 없는 시나리오별 값을 담습니다.

`metadata_json.location`에 문자열 장소를 넣으면 스마트 검색의 장소 조건과 후보에
사용됩니다. 선택형 `tagged_account_external_ids`는 이 패키지나 DB에 등록된
`accounts.external_id`의 배열이며 최대 5개입니다. 생략하면 기존 인물 태그를
유지하고, 빈 배열이면 모두 해제하고, 값을 넣으면 교체합니다. 미등록 ID와 중복
ID는 import 오류입니다. 내부 Account ID나 handle을 넣지 않습니다. 본문의
`@handle` 멘션은 원문에서 따로 해석하며 댓글 멘션은 게시글 인물 검색 대상이
아닙니다.

`account_external_id`는 이 패키지의 account 또는 DB에 이미 있는 account의
`external_id`를 가리킵니다. import가 새 account에 대응하는 User를 만듭니다.
패키지에 비밀번호나 세션 정보를 넣지 않습니다. 사용자가 앱에서 직접 바꾼 account
profile은 동일 패키지 재import로 덮어쓰지 않습니다.

## 자산 경로

디스크에서 패키지를 import할 때 `assets/photo.png`처럼 패키지 폴더 안의 상대 경로를
쓰면 파일을 `EXTERNAL_POSTS_DIR/assets/`에 복사하고 앱에서 접근 가능한 URL로
변환합니다. 이 기능은 기본으로 켜져 있습니다. 파일이 없거나 경로가 패키지 폴더
밖으로 벗어나면 원래 URL을 유지하며 경고를 기록합니다. 원본 파일이 없는 상태에서는
브라우저에서 자산이 열리지 않습니다.

`/assets/...` 같은 기존 브라우저 경로와 `https://...` 같은 외부 URL은 그대로
유지합니다. 이 경우 파일이나 서버가 실제로 접근 가능해야 합니다. Windows 절대
경로(`C:\data\photo.png`)는 `asset.url`에 사용할 수 없습니다. HTTP
`POST /api/imports`는 디스크 패키지 폴더를 받지 않으므로 상대 경로 파일을 복사하지
않습니다.

## 가져오기와 재import

`backend/.env`에서 `DATABASE_URL`과 `EXTERNAL_POSTS_DIR`을 설정한 뒤,
완성된 패키지 폴더를 데이터 루트의 `incoming/`에 복사합니다. `backend` 폴더에서
실행합니다.

```powershell
python -m app.services.process_incoming --dry-run
python -m app.services.process_incoming
python -m app.services.process_incoming --watch --interval 10
```

감시 명령은 새 패키지를 계속 확인합니다. 성공한 패키지는 `archive/`, 실패한 패키지는
`failed/`로 이동합니다. 한 파일만 직접 가져오려면 다음 명령을 사용합니다. 직접
가져오기와 HTTP import는 원본 패키지를 이동하지 않습니다.

```powershell
python -m app.services.import_external_posts --input C:/feed-data/my-batch/feed_posts.json --dry-run
python -m app.services.import_external_posts --input C:/feed-data/my-batch/feed_posts.json
```

같은 post를 갱신하려면 `post.external_id`를 유지합니다. `assets` 필드를 생략하면
기존 자산이 유지되고, 배열을 명시하면 그 post의 기존 자산을 배열 내용으로 교체합니다.
`posts[]`는 해당 `batch.external_id`가 소유한 post의 전체 목록입니다. 재import에서
목록에서 빠진 post는 관련 자산·댓글·북마크·좋아요와 함께 삭제됩니다. 다른 batch의
post는 삭제하지 않습니다. `--dry-run`은 DB와 파일을 변경하지 않습니다.

호환성 검사는 [Golden sample 회귀 확인](GOLDEN_SAMPLE_REGRESSION.md), 전체 실행
절차는 [로컬 실행 가이드](QUICK_RUN_GUIDE_LOCAL.md)를 참고합니다.
