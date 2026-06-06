import { useState } from 'react';
import type { MetadataValue, PostAsset } from '../types/feed';
import { formatMetadataValue } from '../utils/format';

type RenderableAsset = Omit<PostAsset, 'type'> & {
  type?: string;
};

type AssetRendererProps = {
  asset?: RenderableAsset;
  variant?: 'preview' | 'full';
};

function AssetShell({
  children,
  muted = false,
}: {
  children: React.ReactNode;
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
  const shouldShowFull = variant === 'full';
  const canShowImage =
    (type === 'image' || type === 'plot' || type === 'chart') &&
    asset.url &&
    !hasImageError;

  if (canShowImage) {
    return (
      <div className="relative">
        {type === 'plot' || type === 'chart' ? <AssetBadge label={type} /> : null}
        <img
          src={asset.url}
          alt={asset.alt ?? title}
          className="aspect-[4/3] w-full rounded-md bg-neutral-100 object-cover"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      </div>
    );
  }

  if (type === 'image' || type === 'plot' || type === 'chart') {
    return <MissingAsset label={`${title} preview unavailable`} />;
  }

  if (type === 'table') {
    return (
      <AssetShell>
        <div className="p-4">
          <p className="text-xs font-bold uppercase text-neutral-400">
            table
          </p>
          <p className="mt-2 text-sm font-bold text-neutral-950">{title}</p>
          {shouldShowFull && asset.content !== undefined ? (
            <div className="mt-3">
              <JsonBlock value={asset.content} />
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {asset.url ? 'Open the linked table asset.' : 'Table data preview'}
            </p>
          )}
        </div>
      </AssetShell>
    );
  }

  if (type === 'json') {
    return (
      <AssetShell>
        <div className="p-4">
          <p className="text-xs font-bold uppercase text-neutral-400">
            json
          </p>
          <p className="mt-2 text-sm font-bold text-neutral-950">{title}</p>
          {shouldShowFull && asset.content !== undefined ? (
            <div className="mt-3">
              <JsonBlock value={asset.content} />
            </div>
          ) : (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
              {renderContentSummary(asset.content)}
            </p>
          )}
        </div>
      </AssetShell>
    );
  }

  if (type === 'html') {
    return (
      <AssetShell>
        <div className="p-4">
          <p className="text-xs font-bold uppercase text-neutral-400">
            html
          </p>
          <p className="mt-2 text-sm font-bold text-neutral-950">{title}</p>
          {asset.url ? (
            <a
              className="mt-3 inline-flex rounded-md bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
              href={asset.url}
              rel="noreferrer"
              target="_blank"
            >
              Open link
            </a>
          ) : (
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              No link is available.
            </p>
          )}
        </div>
      </AssetShell>
    );
  }

  if (type === 'text') {
    return (
      <AssetShell muted>
        <div className="p-4">
          {asset.title ? (
            <p className="mb-2 text-sm font-bold text-neutral-950">{asset.title}</p>
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
      <div className="p-4">
        <p className="text-xs font-bold uppercase text-neutral-400">
          {type}
        </p>
        <p className="mt-2 text-sm font-bold text-neutral-950">{title}</p>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          This asset type is not supported yet.
        </p>
      </div>
    </AssetShell>
  );
}
