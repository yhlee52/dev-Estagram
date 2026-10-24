# 외부 게시글 데이터 폴더

실제 위치는 `backend/.env`의 `EXTERNAL_POSTS_DIR`로 지정합니다. 기본 위치는 이
폴더이며, 다른 드라이브의 절대 경로도 사용할 수 있습니다.

```text
external_posts/
  incoming/  새 패키지 대기
  archive/   성공 후 이동
  failed/    실패 후 이동
  assets/    상대 경로 자산의 관리 복사본
  examples/  자동 처리되지 않는 샘플
```

`incoming/`에는 단일 `.json` 파일이나 `feed_posts.json`이 있는 디렉터리를
넣습니다. `process_incoming`은 각 패키지를 독립 처리하고 이름 충돌 시 덮어쓰지
않습니다. `--dry-run`에서는 DB와 파일을 바꾸지 않습니다.

```powershell
cd feed-prototype/backend
python -m app.services.process_incoming --dry-run
python -m app.services.process_incoming --watch --interval 10
```

이미지·CSV 등의 자산을 함께 넣을 때 JSON의 `url`에는 패키지 기준 상대 경로
(예: `assets/chart.png`)를 씁니다. import가 파일을 이 데이터 폴더의 `assets/`로
복사하고 브라우저용 URL로 연결합니다. 절대 Windows 파일 경로는 브라우저 URL로
쓸 수 없습니다. 외부 URL과 기존 `/assets/...` URL은 그대로 유지합니다.

JSON 형식은 [EXTERNAL_POST_PACKAGE_GUIDE.md](../../docs/EXTERNAL_POST_PACKAGE_GUIDE.md),
전체 실행 순서는 [QUICK_RUN_GUIDE_LOCAL.md](../../docs/QUICK_RUN_GUIDE_LOCAL.md)를
참고하세요. package 형식은 동결되어 있으며 같은 `external_id` 재import는
기존 항목을 갱신합니다.
