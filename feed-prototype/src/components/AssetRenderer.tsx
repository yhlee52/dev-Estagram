import { useState, type ReactNode } from 'react';
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

function getAssetUrl(asset: RenderableAsset): string | undefined {
  return asset.url ?? asset.src;
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
  const canShowImage = imageLikeTypes.has(type) && assetUrl && !hasImageError;

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

  if (type === 'table') {
    const rows = getTableRows(asset.content);
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

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
            <p className="text-sm leading-6 text-neutral-500">
              Table data is not available in this asset.
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
