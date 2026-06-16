import type { PostMetadata } from '../types/feed';
import { formatMetadataValue } from '../utils/format';

type PinnedMetadataChipsProps = {
  metadata?: PostMetadata;
  pinnedKeys: string[];
};

/**
 * Render the user's pinned metadata keys (v0.4.1) as key:value chips on a card,
 * for keys this post actually has. Generic: chips show the value as-is, with no
 * domain meaning. Renders nothing when nothing is pinned or present.
 *
 * `pinnedKeys` is passed in (not read from the hook) so the parent card can
 * reuse the same list to exclude these keys from the generic MetadataSummary,
 * avoiding showing one key twice.
 */
export default function PinnedMetadataChips({
  metadata,
  pinnedKeys,
}: PinnedMetadataChipsProps) {
  if (!metadata || pinnedKeys.length === 0) {
    return null;
  }

  const chips = pinnedKeys
    .filter((key) => metadata[key] !== undefined && metadata[key] !== null)
    .map((key) => ({ key, value: formatMetadataValue(metadata[key]) }));

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700"
        >
          <span className="uppercase text-neutral-400">{chip.key}</span>
          <span className="truncate">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}
