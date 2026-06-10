# MVP12 Asset Viewer Test Procedure

MVP12 name: **Asset Viewer Enhancement**.

This procedure checks loading, error, fallback, accessibility, and regression
behavior for the MVP12 asset viewer. The scope stays generic: User, Account,
Post, Feed, Follow, Asset, and Metadata.

## Test Data

Use the MVP12 sample external package:

```text
data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
```

Import commands:

```bash
cd feed-prototype/backend
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json --dry-run
python -m app.services.import_external_posts --input ../data/external_posts/examples/batch_mvp12_asset_viewer/feed_posts.json
```

For successful CSV preview, copy the sample CSV to a browser-accessible static
path:

```text
from: data/external_posts/examples/batch_mvp12_asset_viewer/assets/sample_summary.csv
to:   public/assets/generated/sample_summary.csv
url:  /assets/generated/sample_summary.csv
```

Image, plot, PDF, and HTML sample paths are examples only. Large binary files
should not be committed. Add small local files under `public/assets/generated/`
when you want successful image/file-open tests.

## Visual Asset Viewer

Check:

- `image` thumbnail is shown when the URL is valid.
- `plot` thumbnail is shown when the URL is valid.
- `image` and `plot` use the same visual asset path.
- `plot` is treated as a saved image, not an interactive chart.
- Visual assets are ordered by `sort_order` ascending.
- Assets without `sort_order` fall back to created time, id, then original order.
- Thumbnail click opens the lightbox.
- Lightbox shows a large image.
- Lightbox shows title, description, and `1 / N` index.
- Prev and Next move between visual assets.
- Prev is disabled at the first item and Next is disabled at the last item.
- Close button closes the lightbox.
- Backdrop click closes the lightbox.
- Escape closes the lightbox.
- Left and right arrow keys navigate when possible.
- Open original opens the asset URL in a new tab.
- Broken image URL shows thumbnail and lightbox fallback instead of crashing.

Sort order sample:

```text
mvp12_plot_02.png   sort_order 1
mvp12_image_01.png  sort_order 2
mvp12_plot_01.png   sort_order 3
mvp12_image_02.png  sort_order 4
```

Expected result: viewer order follows `sort_order`, not filename order.

## Multi Visual Asset

Check:

- One post can contain multiple `image` and `plot` assets in `assets[]`.
- No `gallery`, `images`, or `plots` field is required.
- PostCard shows a compact visual preview.
- PostCard does not expand every asset into a long list.
- PostDetail shows the full visual gallery.
- Lightbox index shows the current position and total count.
- Prev/Next disabled behavior is clear at gallery edges.

## Table Viewer

Check:

- `table` asset fetches a CSV URL.
- CSV preview uses UTF-8 text.
- First row is treated as header.
- Only the first few rows are shown.
- Wide tables can scroll horizontally.
- CSV fetch failure shows fallback.
- CSV parse failure shows fallback.
- Open original remains available when URL exists.

Sample CSV:

```text
channel,score,rank,method
TEMP_01,0.98,1,Tail
PRESS_02,0.91,2,MAD
FLOW_03,0.87,3,Trend
```

Broken CSV fallback sample:

```text
/assets/generated/missing_mvp12_table.csv
```

## File And Link Viewer

Check:

- `file` asset shows a file card.
- File card shows type badge, title, description, URL/path, and Open file.
- PDF/HTML paths open in a new tab.
- PDF is not rendered inline.
- HTML is not rendered in an iframe.
- `link` asset shows a link card.
- Link card shows title, description, URL, and Open link.
- URL-less file/link assets show fallback text and do not crash.

## PostCard And PostDetail

PostCard:

- Shows compact visual preview when visual assets exist.
- Shows compact non-visual asset cards/counts.
- Does not render an overly long asset section.

PostDetail:

- Shows full visual asset gallery.
- Shows table preview.
- Shows file card.
- Shows link card.
- Shows all non-visual assets in the Other assets section.

## API Mode Regression

Check in API mode:

- Home Feed still loads.
- Filter/search panel still applies filters.
- Browse Posts still loads if available.
- Account Profile still loads.
- Post Detail still loads.
- Post create still accepts assets without `sort_order`.
- Post edit still accepts assets without `sort_order`.
- Post delete still works for own posts.
- External import dry-run still works.
- External import actual run still upserts accounts/posts/assets.
- Imported post assets are returned in stable order.

## Mock Mode Regression

Check in mock mode without backend:

- Home Feed loads.
- Account Profile loads.
- Post Detail loads.
- Follow/unfollow still uses localStorage state.
- Existing mock assets render.
- Mock posts with no assets do not crash.
- Mock assets without `sort_order` use fallback order.

## Accessibility Checks

Check:

- Lightbox has `role="dialog"` and `aria-modal="true"`.
- Lightbox title is connected with `aria-labelledby`.
- Lightbox receives focus when opened.
- Close, Prev, and Next buttons have accessible labels.
- Image alt text uses asset title, description, or fallback text.
- Keyboard users can close with Escape.
- Keyboard users can navigate visual assets with arrow keys.

## Scope Guard

MVP12 must not add:

```text
file upload
S3 upload
asset file copy
folder watch
interactive chart rendering
Plotly/Vega rendering
PDF inline preview
HTML iframe preview
Excel parser
large CSV viewer
image zoom/pan
touch swipe carousel
asset reorder UI
dashboard
large import pipeline rewrite
```

## Automated Checks

Run:

```bash
cd feed-prototype
npm run build
```

Optional static scope scan:

```bash
rg -n "Plotly|Vega|iframe|S3|upload|drag|swipe|zoom|pan" src backend/app
```

Expected result:

- Build passes.
- Static scan should not reveal newly implemented out-of-scope behavior.

## MVP12 Pass Criteria

- Visual asset thumbnails and lightbox work for image/plot.
- Multi image/plot navigation works without looping.
- CSV table preview succeeds for valid small CSV and falls back for broken URL.
- File/link cards open originals without inline preview.
- Broken URLs do not crash the app.
- API mode core flows still work.
- Mock mode works without backend.
- No out-of-scope viewer/upload/dashboard features are introduced.
