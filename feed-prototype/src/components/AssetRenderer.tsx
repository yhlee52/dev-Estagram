import { useEffect, useState, type ReactNode } from 'react';
import type { MetadataValue, PostAsset } from '../types/feed';
import { formatMetadataValue } from '../utils/format';

type RenderableAsset = Omit<PostAsset, 'type'> & {
  type?: string;
};

type AssetRendererProps = {
  asset?: RenderableAsset;
  variant?: 'preview' | 'full';
};

type TableRow = Record<string, MetadataValue>;

type CsvPreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; headers: string[]; rows: string[][] }
  | { status: 'error'; message: string };

function AssetShell({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        'overflow-hidden rounded-md border border-neutral-200',
        muted ? 'bg-neutral-50' : 'bg-white',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function AssetBadge({ label }: { label: string }) {
  return (
    <span className="absolute left-3 top-3 rounded-full bg-neutral-950/80 px-2.5 py-1 text-xs font-bold uppercase text-white">
      {label}
    </span>
  );
}

function InlineBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold uppercase text-neutral-500">
      {label}
    </span>
  );
}

function MissingAsset({ label = 'Asset preview unavailable' }: { label?: string }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-4 text-center text-sm font-semibold text-neutral-400">
      {label}
    </div>
  );
}

function JsonBlock({ value }: { value: MetadataValue }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs leading-5 text-neutral-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function renderContentSummary(content: MetadataValue | undefined) {
  if (content === undefined) {
    return 'No inline content available.';
  }

  return formatMetadataValue(content);
}

function formatAssetUrl(value: string | undefined): string {
  if (!value) {
    return 'No URL available.';
  }

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? url.pathname
      : `${url.hostname}${url.pathname}`;
  } catch {
    return value;
  }
}

function getAssetUrl(asset: RenderableAsset): string | undefined {
  return asset.url ?? asset.src;
}

function isLikelyImageUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const path = value.split('?')[0]?.toLowerCase() ?? '';
  return /\.(apng|avif|gif|jpe?g|png|svg|webp)$/.test(path);
}

function getTableRows(content: MetadataValue | undefined): TableRow[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter(
    (row): row is TableRow =>
      row !== null && !Array.isArray(row) && typeof row === 'object',
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && isQuoted && nextCharacter === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (character === ',' && !isQuoted) {
      values.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue.trim());
  return values;
}

function parseCsvPreview(
  text: string,
  maxRows: number,
): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, maxRows + 1);

  if (lines.length < 2) {
    throw new Error('CSV preview needs a header row and at least one data row.');
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV preview is empty.');
  }

  return { headers, rows };
}

function getChartData(content: MetadataValue | undefined) {
  if (content === null || Array.isArray(content) || typeof content !== 'object') {
    return undefined;
  }

  const labels = Array.isArray(content.labels) ? content.labels : [];
  const values = Array.isArray(content.values) ? content.values : [];
  const rows = labels
    .map((label, index) => {
      const value = values[index];

      if (typeof value !== 'number') {
        return undefined;
      }

      return {
        label: formatMetadataValue(label),
        value,
      };
    })
    .filter((row): row is { label: string; value: number } => row !== undefined);

  return rows.length > 0 ? rows : undefined;
}

function ChartPreview({
  asset,
  variant,
}: {
  asset: RenderableAsset;
  variant: 'preview' | 'full';
}) {
  const title = asset.title ?? 'chart asset';
  const rows = getChartData(asset.content);
  const visibleRows = variant === 'preview' ? rows?.slice(0, 4) : rows;
  const maxValue = Math.max(...(rows ?? []).map((row) => row.value), 0);

  if (!visibleRows || maxValue <= 0) {
    return (
      <div className="relative">
        <AssetBadge label={asset.type ?? 'chart'} />
        <MissingAsset label={`${title} preview unavailable`} />
      </div>
    );
  }

  return (
    <AssetShell>
      <div className="relative aspect-[4/3] bg-neutral-50 p-4">
        <AssetBadge label={asset.type ?? 'chart'} />
        <div className="flex h-full flex-col justify-end gap-3 pt-10">
          <p className="line-clamp-1 text-sm font-bold text-neutral-950">{title}</p>
          <div className="space-y-2">
            {visibleRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_auto] gap-3">
                <div className="min-w-0">
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-neutral-950"
                      style={{ width: `${Math.max((row.value / maxValue) * 100, 4)}%` }}
                    />
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-neutral-500">
                    {row.label}
                  </p>
                </div>
                <span className="text-xs font-bold text-neutral-700">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AssetShell>
  );
}

function CardHeader({
  type,
  title,
  description,
}: {
  type: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <InlineBadge label={type} />
      <div>
        <p className="text-sm font-bold text-neutral-950">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function AssetActionCard({
  type,
  title,
  description,
  assetUrl,
  actionLabel,
  fallbackText,
}: {
  type: string;
  title: string;
  description?: string;
  assetUrl?: string;
  actionLabel: string;
  fallbackText: string;
}) {
  return (
    <AssetShell>
      <div className="space-y-4 p-4">
        <CardHeader type={type} title={title} description={description} />
        <div className="rounded-md bg-neutral-50 px-3 py-2">
          <p className="break-all text-xs font-semibold text-neutral-500">
            {formatAssetUrl(assetUrl)}
          </p>
        </div>
        {assetUrl ? (
          <a
            className="inline-flex rounded-md bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
            href={assetUrl}
            rel="noreferrer"
            target="_blank"
            onClick={(event) => event.stopPropagation()}
          >
            {actionLabel}
          </a>
        ) : (
          <p className="text-sm leading-6 text-neutral-500">{fallbackText}</p>
        )}
      </div>
    </AssetShell>
  );
}

function CsvPreview({
  assetUrl,
  maxRows,
}: {
  assetUrl?: string;
  maxRows: number;
}) {
  const [previewState, setPreviewState] = useState<CsvPreviewState>(
    assetUrl
      ? { status: 'loading' }
      : { status: 'error', message: 'No table URL is available.' },
  );

  useEffect(() => {
    if (!assetUrl) {
      setPreviewState({ status: 'error', message: 'No table URL is available.' });
      return;
    }

    const abortController = new AbortController();
    setPreviewState({ status: 'loading' });

    fetch(assetUrl, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`CSV request failed with ${response.status}.`);
        }

        return response.text();
      })
      .then((text) => {
        if (!abortController.signal.aborted) {
          setPreviewState({ status: 'ready', ...parseCsvPreview(text, maxRows) });
        }
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        setPreviewState({
          status: 'error',
          message: error instanceof Error ? error.message : 'CSV preview failed.',
        });
      });

    return () => abortController.abort();
  }, [assetUrl, maxRows]);

  if (previewState.status === 'ready') {
    return (
      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full min-w-[360px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              {previewState.headers.map((header, index) => (
                <th key={`${header}-${index}`} className="px-3 py-2 font-bold">
                  {header || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {previewState.rows.map((row, rowIndex) => (
              <tr key={`csv-row-${rowIndex}`}>
                {previewState.headers.map((header, columnIndex) => (
                  <td
                    key={`${header}-${rowIndex}-${columnIndex}`}
                    className="max-w-56 truncate px-3 py-2 text-neutral-700"
                  >
                    {row[columnIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (previewState.status === 'error') {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4">
        <p className="text-sm font-bold text-neutral-700">CSV preview unavailable</p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">
          {previewState.message}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4">
      <p className="text-sm font-bold text-neutral-700">Loading CSV preview...</p>
    </div>
  );
}

export default function AssetRenderer({
  asset,
  variant = 'preview',
}: AssetRendererProps) {
  const [hasImageError, setHasImageError] = useState(false);

  if (!asset) {
    return <MissingAsset label="Missing asset" />;
  }

  const type = asset.type ?? 'unknown';
  const title = asset.title ?? `${type} asset`;
  const assetUrl = getAssetUrl(asset);
  const shouldShowFull = variant === 'full';
  const imageLikeTypes = new Set(['image', 'plot', 'chart']);
  const canShowImage =
    imageLikeTypes.has(type) &&
    assetUrl &&
    !hasImageError &&
    (type === 'image' || isLikelyImageUrl(assetUrl));

  if (canShowImage) {
    return (
      <div className="relative">
        {type === 'plot' || type === 'chart' ? <AssetBadge label={type} /> : null}
        <img
          src={assetUrl}
          alt={asset.alt ?? title}
          className="aspect-[4/3] w-full rounded-md bg-neutral-100 object-cover"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      </div>
    );
  }

  if (type === 'chart' && asset.content !== undefined) {
    return <ChartPreview asset={asset} variant={variant} />;
  }

  if (type === 'image' || type === 'plot' || type === 'chart') {
    return (
      <div className="relative">
        {type === 'plot' || type === 'chart' ? <AssetBadge label={type} /> : null}
        <MissingAsset label={`${title} preview unavailable`} />
      </div>
    );
  }

  if (type === 'file' || type === 'link') {
    return (
      <AssetActionCard
        type={type}
        title={title}
        description={
          asset.description ??
          (type === 'link' ? 'External link asset.' : 'File asset.')
        }
        assetUrl={assetUrl}
        actionLabel={type === 'link' ? 'Open link' : 'Open file'}
        fallbackText={
          type === 'link'
            ? 'No link URL is available.'
            : 'No file URL is available.'
        }
      />
    );
  }

  if (type === 'table') {
    const rows = getTableRows(asset.content);
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const maxCsvRows = shouldShowFull ? 8 : 5;

    return (
      <AssetShell>
        <div className="space-y-4 p-4">
          <CardHeader
            type="table"
            title={title}
            description={asset.description}
          />

          {rows.length > 0 && columns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-400">
                    {columns.map((column) => (
                      <th key={column} className="px-2 py-2 font-bold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(shouldShowFull ? rows : rows.slice(0, 3)).map((row, rowIndex) => (
                    <tr key={`${asset.id}-row-${rowIndex}`}>
                      {columns.map((column) => (
                        <td key={column} className="px-2 py-2 text-neutral-700">
                          {row[column] === undefined ? '' : formatMetadataValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <CsvPreview assetUrl={assetUrl} maxRows={maxCsvRows} />
          )}

          {assetUrl ? (
            <div className="space-y-2">
              <a
                className="inline-flex rounded-md bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
                href={assetUrl}
                rel="noreferrer"
                target="_blank"
                onClick={(event) => event.stopPropagation()}
              >
                Open original
              </a>
              <p className="break-all text-xs font-semibold text-neutral-500">
                {formatAssetUrl(assetUrl)}
              </p>
            </div>
          ) : null}
        </div>
      </AssetShell>
    );
  }

  if (type === 'json') {
    return (
      <AssetShell>
        <div className="space-y-4 p-4">
          <CardHeader
            type="json"
            title={title}
            description={asset.description}
          />
          {shouldShowFull && asset.content !== undefined ? (
            <JsonBlock value={asset.content} />
          ) : (
            <p className="line-clamp-3 text-sm leading-6 text-neutral-500">
              {renderContentSummary(asset.content)}
            </p>
          )}
          {assetUrl ? (
            <p className="break-all text-xs font-medium text-neutral-400">
              Source: {assetUrl}
            </p>
          ) : null}
        </div>
      </AssetShell>
    );
  }

  if (type === 'html') {
    return (
      <AssetShell>
        <div className="space-y-4 p-4">
          <CardHeader
            type="html"
            title={title}
            description={asset.description ?? 'Open the linked report asset.'}
          />
          {assetUrl ? (
            <a
              className="inline-flex rounded-md bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
              href={assetUrl}
              rel="noreferrer"
              target="_blank"
              onClick={(event) => event.stopPropagation()}
            >
              Open report
            </a>
          ) : (
            <p className="text-sm leading-6 text-neutral-500">
              No report link is available.
            </p>
          )}
        </div>
      </AssetShell>
    );
  }

  if (type === 'text') {
    return (
      <AssetShell muted>
        <div className="space-y-2 p-4">
          {asset.title ? (
            <p className="text-sm font-bold text-neutral-950">{asset.title}</p>
          ) : null}
          {asset.description ? (
            <p className="text-xs font-medium text-neutral-400">{asset.description}</p>
          ) : null}
          <p
            className={[
              'whitespace-pre-wrap text-sm leading-6 text-neutral-700',
              variant === 'preview' ? 'line-clamp-3' : '',
            ].join(' ')}
          >
            {typeof asset.content === 'string'
              ? asset.content
              : renderContentSummary(asset.content)}
          </p>
        </div>
      </AssetShell>
    );
  }

  return (
    <AssetShell muted>
      <div className="space-y-3 p-4">
        <CardHeader
          type={type}
          title={title}
          description={asset.description}
        />
        <p className="text-sm leading-6 text-neutral-500">
          This asset type is not supported yet.
        </p>
        {assetUrl ? (
          <p className="break-all text-xs font-medium text-neutral-400">
            Source: {assetUrl}
          </p>
        ) : null}
      </div>
    </AssetShell>
  );
}
