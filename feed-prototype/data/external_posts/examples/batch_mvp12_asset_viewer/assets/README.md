# MVP12 Asset Viewer Sample Assets

This folder documents the asset files referenced by
`batch_mvp12_asset_viewer/feed_posts.json`.

The import service does not copy files. It stores only each `asset.url`, so files
must be placed somewhere the browser can request them.

For local Vite testing, copy small sample files to:

```text
feed-prototype/public/assets/generated/
```

This package includes:

```text
sample_summary.csv
```

Suggested browser URL:

```text
/assets/generated/sample_summary.csv
```

The sample JSON also references image, plot, and HTML/PDF-like paths that are not
committed here:

```text
/assets/generated/mvp12_plot_02.png
/assets/generated/mvp12_image_01.png
/assets/generated/mvp12_plot_01.png
/assets/generated/mvp12_image_02.png
/assets/generated/mvp12_sample_report.html
```

Those files are intentionally placeholders. Large binary image, PDF, and report
files should not be committed as sample data. Add small local files under
`public/assets/generated/` when you want to test successful previews.

Broken URL fallback tests intentionally point to missing files:

```text
/assets/generated/missing_mvp12_image.png
/assets/generated/missing_mvp12_table.csv
```

Expected behavior:

- missing image: thumbnail/lightbox fallback appears
- missing CSV: table preview fallback appears
- Open original remains available when the URL is present
