# broken_asset_sample assets

이 폴더는 `broken_asset_sample/feed_posts.json`이 참조하는 intentionally missing asset을 설명합니다.

- Import script는 실제 asset file을 복사하지 않습니다.
- `asset.url`은 브라우저에서 접근 가능한 URL/path여야 합니다.
- 이 sample의 asset URL은 viewer fallback/error UI 확인을 위해 실제 파일이 없을 수 있습니다.
- Windows 절대경로를 `asset.url`에 넣지 않습니다.
- Missing image/plot은 thumbnail 또는 lightbox fallback을 확인하는 데 사용합니다.
- Missing CSV는 table preview fallback과 Open original action을 확인하는 데 사용합니다.
- Missing file은 file card의 Open original 동작을 확인하는 데 사용합니다.

의도적으로 missing인 URL:

```text
/assets/generated/missing_broken_sample_image.png
/assets/generated/missing_broken_sample_table.csv
/assets/generated/missing_broken_sample_plot.svg
/assets/generated/missing_broken_sample_report.pdf
```
