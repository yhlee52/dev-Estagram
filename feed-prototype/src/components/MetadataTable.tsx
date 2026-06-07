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
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-950">Metadata</h2>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Additional fields attached to this post.
        </p>
      </div>
      <dl className="divide-y divide-neutral-100">
        {entries.map(([key, value]) => (
          <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[120px_1fr] sm:gap-4">
            <dt className="break-words text-xs font-bold uppercase leading-5 text-neutral-400">
              {key}
            </dt>
            <dd className="min-w-0 break-words text-sm leading-6 text-neutral-700">
              {formatMetadataValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
