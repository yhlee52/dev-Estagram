import { useState } from 'react';
import type { PostAsset } from '../types/feed';
import { getAssetUrl, getSortedVisualAssets, type VisualAsset } from '../utils/assetUtils';
import AssetLightbox from './AssetLightbox';

type AssetGalleryProps = {
  assets?: PostAsset[];
  variant?: 'compact' | 'full';
};

function VisualAssetThumbnail({
  asset,
  index,
  total,
  variant,
  onOpen,
}: {
  asset: VisualAsset;
  index: number;
  total: number;
  variant: 'compact' | 'full';
  onOpen: () => void;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const assetUrl = getAssetUrl(asset);
  const title = asset.title ?? `${asset.type} asset`;
  const alt = asset.alt ?? asset.title ?? asset.description ?? title;

  return (
    <button
      type="button"
      aria-label={`Open visual asset ${index + 1} of ${total}`}
      className={[
        'group relative block w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 text-left transition hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950',
        variant === 'compact' ? 'aspect-[4/3]' : 'aspect-[4/3]',
      ].join(' ')}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {assetUrl && !hasImageError ? (
        <img
          src={assetUrl}
          alt={alt}
          className="size-full object-cover transition group-hover:scale-[1.01]"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center border border-dashed border-neutral-300 px-4 text-center text-sm font-semibold text-neutral-400">
          Preview unavailable
        </div>
      )}
      <span className="absolute left-3 top-3 rounded-full bg-neutral-950/80 px-2.5 py-1 text-xs font-bold uppercase text-white">
        {asset.type}
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-neutral-700">
        {index + 1} / {total}
      </span>
      {variant === 'full' ? (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950/75 to-transparent px-3 pb-3 pt-10">
          <span className="block truncate text-sm font-bold text-white">{title}</span>
          {asset.description ? (
            <span className="mt-1 block line-clamp-1 text-xs font-medium text-white/80">
              {asset.description}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

export default function AssetGallery({
  assets,
  variant = 'compact',
}: AssetGalleryProps) {
  const visualAssets = getSortedVisualAssets(assets);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (visualAssets.length === 0) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <>
        <div className="space-y-2">
          <VisualAssetThumbnail
            asset={visualAssets[0]}
            index={0}
            total={visualAssets.length}
            variant="compact"
            onOpen={() => setLightboxIndex(0)}
          />
          {visualAssets.length > 1 ? (
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-500">
              {visualAssets.length} visual assets
            </p>
          ) : null}
        </div>
        {lightboxIndex !== null ? (
          <AssetLightbox
            assets={visualAssets}
            currentIndex={lightboxIndex}
            onChangeIndex={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">Visual assets</h2>
          <span className="text-xs font-medium text-neutral-400">
            {visualAssets.length} item{visualAssets.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visualAssets.map((asset, index) => (
            <VisualAssetThumbnail
              key={asset.id ?? `${asset.type}-${index}`}
              asset={asset}
              index={index}
              total={visualAssets.length}
              variant="full"
              onOpen={() => setLightboxIndex(index)}
            />
          ))}
        </div>
      </section>
      {lightboxIndex !== null ? (
        <AssetLightbox
          assets={visualAssets}
          currentIndex={lightboxIndex}
          onChangeIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}
