import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getImports } from '../api/importsApi';
import type { ApiImportBatchSummary } from '../api/types';
import EmptyState from '../components/EmptyState';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import { formatRelativeTime } from '../utils/format';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }
  if (error instanceof ApiClientError) {
    return error.message;
  }
  return 'Could not load import batches. Check the backend server and try again.';
}

export function StatusBadge({ status }: { status: string }) {
  const isFailed = status === 'failed';
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase',
        isFailed
          ? 'bg-red-50 text-red-700'
          : 'bg-emerald-50 text-emerald-700',
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-600">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-950">{value}</span>
    </span>
  );
}

function BatchRow({ batch }: { batch: ApiImportBatchSummary }) {
  return (
    <Link
      to={`/imports/${encodeURIComponent(batch.external_id)}`}
      className="block rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-neutral-950">
            {batch.external_id}
          </h3>
          <p className="truncate text-xs text-neutral-500">
            {batch.source ? `Source: ${batch.source}` : 'No source'} ·{' '}
            {formatRelativeTime(batch.last_imported_at)}
            {batch.import_count > 1 ? ` · imported ${batch.import_count}×` : ''}
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <CountPill label="created" value={batch.posts_created} />
        <CountPill label="updated" value={batch.posts_updated} />
        <CountPill label="skipped" value={batch.posts_skipped} />
        <CountPill label="posts now" value={batch.post_count} />
      </div>
    </Link>
  );
}

function ApiImportsPage() {
  const [batches, setBatches] = useState<ApiImportBatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const items = await getImports();
        if (isMounted) {
          setBatches(items);
        }
      } catch (loadError) {
        if (isMounted) {
          setBatches([]);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold leading-7 text-neutral-950">Imports</h1>
        <p className="text-sm text-neutral-500">
          External post batches imported over CLI or HTTP. Newest first.
        </p>
      </header>

      {isLoading ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          Loading import batches...
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : batches.length > 0 ? (
        <div className="space-y-3">
          {batches.map((batch) => (
            <BatchRow key={batch.id} batch={batch} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No imports yet"
          description="Import an external post package (CLI or POST /api/imports) and the batch will appear here."
        />
      )}
    </div>
  );
}

export default function ImportsPage() {
  if (!isApiMode()) {
    return (
      <EmptyState
        title="API mode only"
        description="Import batch history is available in API mode. Set VITE_DATA_SOURCE=api and run the backend to view it."
      />
    );
  }

  return <ApiImportsPage />;
}
