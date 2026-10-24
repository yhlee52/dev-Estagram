# Golden sample 회귀 확인

외부 게시글 패키지 형식은 기존 파일과 호환되어야 합니다. `data/external_posts/examples/`
아래의 JSON 파일을 golden sample로 취급하고 import 코드를 바꿀 때 검증합니다.

## 실행

`backend/.env`의 `DATABASE_URL`이 로컬 개발 DB를 가리키는지 확인한 뒤
`feed-prototype/backend`에서 실행합니다.

```powershell
python -m scripts.check_golden_samples
python -m scripts.check_http_import
```

두 검사는 각 예제를 dry-run으로 읽고 DB 변경을 롤백합니다. HTTP 검사는 body 검증과
오류 응답도 확인합니다. 검증 대상에는 일반 소셜 게시글, 분석형 게시글, 자산 순서,
깨진 자산 URL, 관리 복사본 예제가 포함됩니다.

파일 이동과 관리 자산 복사까지 바꿨다면 다음 검사를 추가로 실행합니다.

```powershell
python -m scripts.check_process_incoming
python -m scripts.check_managed_asset_copy
python -m scripts.check_local_asset_serving
```

`check_process_incoming`과 `check_managed_asset_copy`는 임시 파일과 로컬 개발 DB에
테스트 행을 만들고 실행 후 정리합니다. 실제 운영 DB에서는 실행하지 마세요.

패키지 구조와 `external_id` 재import 규칙은
[외부 게시글 패키지 가이드](EXTERNAL_POST_PACKAGE_GUIDE.md)를 참고합니다.
