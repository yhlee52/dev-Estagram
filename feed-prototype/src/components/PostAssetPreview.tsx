import { useState } from 'react';
import type { PostAsset } from '../types/feed';

type PostAssetPreviewProps = {
  asset?: PostAsset;
};

function AssetPlaceholder({ label = 'Asset preview' }: { label?: string }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-neutral-100 px-4 text-center text-sm font-medium text-neutral-400">
      {label}
    </div>
  );
}

export default function PostAssetPreview({ asset }: PostAssetPreviewProps) {
  const [hasImageError, setHasImageError] = useState(false);

  if (!asset) {
    return <AssetPlaceholder />;
  }

  if ((asset.type === 'image' || asset.type === 'plot') && asset.url && !hasImageError) {
    return (
      <img
        src={asset.url}
        alt={asset.alt ?? asset.title ?? 'Post asset'}
        className="aspect-[4/3] w-full rounded-md bg-neutral-100 object-cover"
        loading="lazy"
        onError={() => setHasImageError(true)}
      />
    );
  }

  if (asset.type === 'chart' || asset.type === 'table' || asset.type === 'json') {
    return (
      <div className="rounded-md bg-neutral-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {asset.type}
        </p>
        <p className="mt-2 text-sm font-medium text-neutral-800">
          {asset.title ?? 'Structured asset'}
        </p>
      </div>
    );
  }

  if (asset.type === 'text') {
    return (
      <div className="rounded-md bg-neutral-100 p-4">
        <p className="line-clamp-3 text-sm leading-6 text-neutral-700">
          {typeof asset.content === 'string' ? asset.content : asset.title ?? 'Text asset'}
        </p>
      </div>
    );
  }

  return <AssetPlaceholder label={asset.title ?? 'Asset preview unavailable'} />;
}
