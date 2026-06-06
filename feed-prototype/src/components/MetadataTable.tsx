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
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-950">
        Metadata
      </h2>
      <dl className="divide-y divide-neutral-200">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[104px_1fr] gap-3 px-4 py-3">
            <dt className="break-words text-xs font-bold uppercase text-neutral-400">
              {key}
            </dt>
            <dd className="break-words text-sm leading-6 text-neutral-700">
              {formatMetadataValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
