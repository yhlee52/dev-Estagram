import type { PostMetadata } from '../types/feed';
import { formatMetadataValue } from '../utils/format';

type MetadataTableProps = {
  metadata: PostMetadata;
};

export default function MetadataTable({ metadata }: MetadataTableProps) {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-neutral-200">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-950">
        Metadata
      </h2>
      <dl className="divide-y divide-neutral-200">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-3">
            <dt className="break-words text-xs font-semibold text-neutral-500">{key}</dt>
            <dd className="break-words text-sm text-neutral-700">
              {formatMetadataValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
