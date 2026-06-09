# 예제 Batch Asset 폴더

이 폴더는 외부 generator가 하나의 post package에 필요한 asset 파일을 둘 수 있는 위치를 보여주는 예시입니다.

MVP10은 이 폴더의 파일을 web app으로 자동 복사하지 않습니다. `feed_posts.json`에서 참조하는 파일은 이미 브라우저에서 접근 가능한 URL/path로 제공되고 있어야 합니다.

이 package에서 생성될 수 있는 예시 파일:

```text
temp_trend_001.png
summary_table_001.csv
temp_distribution_002.png
source_payload_002.json
```

`feed_posts.json`에 들어갈 수 있는 URL 예:

```text
/assets/generated/temp_trend_001.png
/assets/generated/summary_table_001.csv
/assets/generated/temp_distribution_002.png
/assets/generated/source_payload_002.json
https://example.com/internal/generated/post-temp-2026-06-09-002
```

주의:

- `C:\data\temp_trend_001.png` 같은 Windows 절대경로를 asset URL로 넣지 않습니다.
- backend 내부 local path를 그대로 넣지 않습니다.
- UI는 브라우저에서 실행되므로, `url` 값은 frontend/backend static file 설정으로 제공되는 path이거나 실제 URL이어야 합니다.
- MVP10 import script는 asset 파일을 복사하지 않고 JSON의 `url` 값만 DB에 저장합니다.
