import { useEffect, useState } from 'react';
import type { VisualAsset } from '../utils/assetUtils';
import { getAssetUrl } from '../utils/assetUtils';

type AssetLightboxProps = {
  assets: VisualAsset[];
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
};

function getAssetAlt(asset: VisualAsset): string {
  return asset.alt ?? asset.title ?? asset.description ?? `${asset.type} asset`;
}

export default function AssetLightbox({
  assets,
  currentIndex,
  onChangeIndex,
  onClose,
}: AssetLightboxProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const currentAsset = assets[currentIndex];
  const assetUrl = currentAsset ? getAssetUrl(currentAsset) : undefined;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < assets.length - 1;

  useEffect(() => {
    setHasImageError(false);
  }, [currentIndex, assetUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }

      if (event.key === 'ArrowLeft' && hasPrevious) {
        onChangeIndex(currentIndex - 1);
      }

      if (event.key === 'ArrowRight' && hasNext) {
        onChangeIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, hasNext, hasPrevious, onChangeIndex, onClose]);

  if (!currentAsset) {
    return null;
  }

  return (
    <div
      aria-label="Asset viewer"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-950">
              {currentAsset.title ?? `${currentAsset.type} asset`}
            </p>
            <p className="text-xs font-semibold text-neutral-400">
              {currentIndex + 1} / {assets.length}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close asset viewer"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-neutral-100 p-4">
          {assetUrl && !hasImageError ? (
            <img
              src={assetUrl}
              alt={getAssetAlt(currentAsset)}
              className="max-h-[64vh] max-w-full rounded-md object-contain"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <div className="flex min-h-64 w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-white px-4 text-center text-sm font-semibold text-neutral-500">
              Image preview unavailable.
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-neutral-200 px-4 py-3">
          {currentAsset.description ? (
            <p className="text-sm leading-6 text-neutral-600">
              {currentAsset.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous visual asset"
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
                disabled={!hasPrevious}
                onClick={() => onChangeIndex(currentIndex - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                aria-label="Next visual asset"
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
                disabled={!hasNext}
                onClick={() => onChangeIndex(currentIndex + 1)}
              >
                Next
              </button>
            </div>
            {assetUrl ? (
              <a
                className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white"
                href={assetUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open original
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
