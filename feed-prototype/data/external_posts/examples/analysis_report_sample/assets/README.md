# analysis_report_sample assets

이 폴더는 `analysis_report_sample/feed_posts.json`이 참조하는 asset 파일 위치를 설명합니다.

- Import script는 실제 asset file을 복사하지 않습니다.
- `asset.url`은 브라우저에서 접근 가능한 URL/path여야 합니다.
- 큰 image/PDF/HTML binary는 repo에 넣지 않습니다.
- 작은 CSV sample은 이 폴더에 포함합니다.
- CSV preview 성공을 확인하려면 `sample_summary.csv`를 `feed-prototype/public/assets/generated/analysis_sample_summary.csv`로 복사하고 JSON의 `/assets/generated/analysis_sample_summary.csv` path와 맞춥니다.
- 일부 image/file URL은 실제 파일이 없을 수 있으며, 이 경우 viewer fallback 확인용으로 사용할 수 있습니다.

참조 URL:

```text
/assets/generated/analysis_sample_avatar.png
/assets/generated/analysis_sample_plot_001.png
/assets/generated/analysis_sample_plot_002.png
/assets/generated/analysis_sample_summary.csv
/assets/generated/analysis_sample_source_payload.json
/assets/generated/analysis_sample_report.html
```
