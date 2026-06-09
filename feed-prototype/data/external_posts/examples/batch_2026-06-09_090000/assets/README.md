# Example Batch Assets

This folder shows where an external generator can place files for one post package.

MVP10 does not copy files from this folder into the web app. Files referenced in `feed_posts.json` must already be available through a browser-accessible URL/path.

Example generated files for this package:

```text
temp_trend_001.png
summary_table_001.csv
temp_distribution_002.png
source_payload_002.json
```

Example URL values in `feed_posts.json`:

```text
/assets/generated/temp_trend_001.png
/assets/generated/summary_table_001.csv
/assets/generated/temp_distribution_002.png
/assets/generated/source_payload_002.json
https://example.com/internal/generated/post-temp-2026-06-09-002
```

Do not use Windows absolute paths such as `C:\data\temp_trend_001.png` as asset URLs. The UI runs in a browser, so the value must be a URL or a path served by the frontend/backend static file setup.
