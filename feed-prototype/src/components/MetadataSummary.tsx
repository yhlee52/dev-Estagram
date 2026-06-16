import type { PostMetadata } from '../types/feed';
import { formatMetadataValue } from '../utils/format';

type MetadataSummaryProps = {
  metadata?: PostMetadata;
  limit?: number;
  /** Keys already surfaced elsewhere (e.g. pinned chips) to avoid duplication. */
  excludeKeys?: string[];
};

export default function MetadataSummary({
  metadata,
  limit = 3,
  excludeKeys = [],
}: MetadataSummaryProps) {
  const entries = Object.entries(metadata ?? {})
    .filter(([key]) => !excludeKeys.includes(key))
    .slice(0, limit);

  if (entries.length === 0) {
    return null;
  }

  return (
    <dl className="grid gap-1 rounded-md bg-neutral-50 px-3 py-2">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[80px_1fr] gap-2">
          <dt className="truncate text-xs font-bold uppercase text-neutral-400">
            {key}
          </dt>
          <dd className="min-w-0 truncate text-xs font-semibold text-neutral-600">
            {formatMetadataValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
