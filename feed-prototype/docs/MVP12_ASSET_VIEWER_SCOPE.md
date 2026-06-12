# MVP12 Asset Viewer Enhancement

MVP12 name: **Asset Viewer Enhancement**.

MVP12 improves how attached post assets are viewed in the existing generic feed
prototype. It builds on:

- MVP9: post asset + metadata management
- MVP10: external post ingestion pipeline
- MVP11: metadata / tag / asset filter & search

The core product domain remains generic:

```text
User
Account
Post
Feed
Follow
Asset
Metadata
```

Do not introduce equipment-report-specific concepts such as Equipment, Report,
Sensor, Chamber, Recipe, or Severity into core model names, shared component
names, route names, or data flow. Scenario-specific values stay in
`metadata_json` or asset metadata.

## MVP12 Goals

- Treat `image` and `plot` assets as one visual asset category.
- Assume `plot` is a saved image file such as PNG or SVG.
- Do not add interactive chart rendering for plot assets.
- Show visual assets as thumbnails.
- Open visual assets in a modal/lightbox when clicked.
- Support prev/next navigation across visual assets attached to the same post.
- Use `asset.sort_order` for stable asset display order.
- Preview `table` assets as CSV by showing only the first few rows.
- Show fallback cards when table CSV preview fails.
- Provide `Open original` for table assets.
- Show `file` assets as cards with `Open original`.
- Show `link` assets as natural hyperlink/cards.
- Show compact asset previews in PostCard.
- Show a fuller asset viewer in PostDetail.
- Handle broken asset URLs without crashing the app.
- Update the MVP10 external import JSON format and sample JSON to include
  `sort_order`.
- Keep mock mode available.

## Visual Asset Policy

Visual assets are:

```text
type = image
type = plot
```

`plot` does not mean Plotly, Vega, or an interactive chart in MVP12. It means an
external program saved a plot as a browser-accessible image file.

Visual asset display order:

```text
sort_order ascending
fallback to existing array order, created_at, or id when sort_order is missing
fallback to created_at or id when multiple assets share the same sort_order
```

`sort_order` is added so external import packages and post asset lists can keep
a stable, intentional order. This matters when a post has multiple related
images or plots and the viewer offers prev/next navigation.

## Table Policy

Table assets are treated as CSV files.

Expected behavior:

- Fetch the browser-accessible CSV URL.
- Assume UTF-8 CSV.
- Preview only the first few rows.
- Keep the preview small and lightweight.
- Show a fallback card if fetch or parsing fails.
- Always provide an `Open original` action when a URL exists.

MVP12 does not implement a full CSV viewer, large CSV processing, Excel parsing,
or encoding auto-detection.

## File Policy

File assets may point to PDF, HTML, JSON, or other browser-accessible files.

Expected behavior:

- Show a file card.
- Show title, description, and URL when available.
- Provide `Open original`.
- Do not render inline PDF viewers.
- Do not render HTML in iframes.
- Do not parse file contents.

## Link Policy

Link assets are rendered as natural hyperlink/cards.

Expected behavior:

- Show title, description, and URL when available.
- Provide an open action.
- Do not scrape OpenGraph metadata.
- Do not generate remote previews.

## UI Placement

PostCard:

- Shows compact asset previews.
- Visual assets should be clear enough to identify but not dominate the feed.
- Broken asset URLs should show a contained fallback state.

PostDetail:

- Shows the full asset viewer.
- Visual assets can open in a lightbox/modal.
- Multiple visual assets can be navigated with prev/next.
- Table/file/link assets remain accessible without heavy inline viewers.

## External Import Format Update

MVP12 extends asset descriptors with optional `sort_order`:

```json
{
  "external_id": "asset-gallery-001-img-001",
  "type": "image",
  "url": "/assets/generated/gallery_001_01.png",
  "title": "First image",
  "description": "Representative image.",
  "sort_order": 1
}
```

Import format policy:

- `sort_order` is optional for backward compatibility.
- If present, it should be an integer.
- Lower values are displayed first.
- External generators should provide stable `sort_order` values for related
  image/plot galleries.
- Existing assets without `sort_order` remain valid and should still import and
  render.
- Same-JSON reimport should not create duplicate posts.

Multi visual asset authoring:

- Keep the existing post JSON structure.
- Put multiple `image` and `plot` descriptors in the existing `assets` array.
- Do not add `gallery`, `images`, or `plots` fields.
- The viewer groups `image` and `plot` assets as visual assets.
- `table`, `file`, and `link` assets are displayed as separate sections/cards.
- Add `sort_order` when the display order must be stable.

## MVP12 Sample Package

MVP12 includes a focused external import package for manual viewer testing:

```text
data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
data/external_posts/examples/batch_mvp12_asset_viewer/assets/README.md
data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
```

Import commands:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

Included test posts:

- Multi image/plot post: two `image` assets and two `plot` assets.
- Table post: one `table` asset pointing to `sample_summary.csv`.
- File/link post: one `file` path and one external `link`.
- Broken fallback post: missing image and missing CSV URLs.

CSV preview setup:

```text
copy data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
to   public/assets/generated/sample_summary.csv
```

The sample image, plot, and file URLs are browser path examples. Large binary
sample assets should not be committed. Add small local files under
`public/assets/generated/` when you want successful image/file open tests.

Sort order test:

- `mvp12_plot_02.png` has `sort_order: 1`.
- `mvp12_image_01.png` has `sort_order: 2`.
- Viewer order should follow `sort_order`, not filename order.

Fallback test:

- `/assets/generated/missing_mvp12_image.png` should show image fallback.
- `/assets/generated/missing_mvp12_table.csv` should show CSV preview fallback.

Detailed loading, fallback, accessibility, and regression checks are documented
in:

```text
docs/MVP12_TEST_PROCEDURE.md
```

## Non-Goals

MVP12 does not implement:

```text
actual file upload
S3 upload
asset file copy
large backend static serving changes
folder watch
interactive chart rendering
Plotly/Vega rendering
PDF inline preview
HTML iframe preview
Excel parser
large CSV processing
CSV encoding auto-detection
image zoom/pan
touch swipe carousel
fancy animation
asset reorder UI
advanced asset edit workflow
OpenGraph link preview
dashboard
large import pipeline rewrite
mock mode removal
formal authentication
JWT
sessions
OAuth
equipment-report-specific core naming
```
