import type { ApiMetadataKeyCount } from '../api/types';
import { usePinnedMetadataKeys } from '../hooks/usePinnedMetadataKeys';

type PinnedMetadataKeysControlProps = {
  keySuggestions: ApiMetadataKeyCount[];
};

/**
 * Toggle which known metadata keys are pinned as chips on feed cards (v0.4.1).
 * Renders nothing without known keys (mock mode / empty data), matching the
 * facet control's API-mode gating.
 */
export default function PinnedMetadataKeysControl({
  keySuggestions,
}: PinnedMetadataKeysControlProps) {
  const { pinnedKeys, togglePinnedKey } = usePinnedMetadataKeys();

  if (keySuggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-neutral-500">Pin metadata to cards</p>
      <div className="flex flex-wrap gap-1.5">
        {keySuggestions.map((item) => {
          const isPinned = pinnedKeys.includes(item.key);
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isPinned}
              onClick={() => togglePinnedKey(item.key)}
              className={
                isPinned
                  ? 'rounded-full border border-neutral-950 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white transition'
                  : 'rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400'
              }
            >
              {item.key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
