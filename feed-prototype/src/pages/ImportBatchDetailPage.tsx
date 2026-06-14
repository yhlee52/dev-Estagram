import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getImport } from '../api/importsApi';
import type { ApiImportBatchDetailResponse } from '../api/types';
import EmptyState from '../components/EmptyState';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import { formatDateTime, formatRelativeTime } from '../utils/format';
import { StatusBadge } from './ImportsPage';

function getErrorMessage(error: unknown): { message: string; notFound: boolean } {
  if (error instanceof ApiNetworkError) {
    return {
      message: `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`,
      notFound: false,
    };
  }
  if (error instanceof ApiClientError) {
    return { message: error.message, notFound: error.status === 404 };
  }
  return {
    message: 'Could not load this import batch. Check the backend server and try again.',
    notFound: false,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-3">
      <p className="text-xs font-bold uppercase text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-neutral-950">{value}</p>
    </div>
  );
}

function ApiImportBatchDetailPage({ batchExternalId }: { batchExternalId: string }) {
  const [data, setData] = useState<ApiImportBatchDetailResponse | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');
      setNotFound(false);
      try {
        const detail = await getImport(batchExternalId);
        if (isMounted) {
          setData(detail);
        }
      } catch (loadError) {
        if (isMounted) {
          setData(undefined);
          const { message, notFound: is404 } = getErrorMessage(loadError);
          setError(message);
          setNotFound(is404);
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
  }, [batchExternalId]);

  const backLink = (
    <Link
      to="/imports"
      className="text-sm font-semibold text-neutral-500 transition hover:text-neutral-950"
    >
      ← All imports
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          Loading import batch...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        {backLink}
        {notFound ? (
          <EmptyState
            title="Import batch not found"
            description={`No batch with id "${batchExternalId}" exists in the backend.`}
          />
        ) : (
          <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  const { batch, posts } = data;

  return (
    <div className="space-y-4">
      {backLink}

      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
              {batch.external_id}
            </h1>
            <p className="truncate text-sm text-neutral-500">
              {batch.source ? `Source: ${batch.source}` : 'No source'}
            </p>
          </div>
          <StatusBadge status={batch.status} />
        </div>

        {batch.status === 'failed' && batch.error_message ? (
          <p className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
            {batch.error_message}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Posts created" value={String(batch.posts_created)} />
          <Stat label="Posts updated" value={String(batch.posts_updated)} />
          <Stat label="Posts skipped" value={String(batch.posts_skipped)} />
          <Stat label="Posts now" value={String(batch.post_count)} />
          <Stat label="Accounts +/~" value={`${batch.accounts_created}/${batch.accounts_updated}`} />
          <Stat label="Assets created" value={String(batch.assets_created)} />
          <Stat label="Import count" value={String(batch.import_count)} />
          <Stat label="Last import" value={formatRelativeTime(batch.last_imported_at)} />
        </div>

        <p className="text-xs text-neutral-400">
          First imported {formatDateTime(batch.first_imported_at)} · last imported{' '}
          {formatDateTime(batch.last_imported_at)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-bold text-neutral-950">
          Posts in this batch ({posts.length})
        </h2>

        {posts.length > 0 ? (
          <div className="space-y-2.5">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="block rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300 hover:shadow"
              >
                <h3 className="truncate text-sm font-bold text-neutral-950">
                  {post.title}
                </h3>
                <p className="truncate text-xs text-neutral-500">
                  {post.account_display_name ?? post.account_handle ?? post.account_id}
                  {' · '}
                  {formatDateTime(post.created_at)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No posts attributed"
            description="No posts currently belong to this batch. They may have been re-attributed by a later import."
          />
        )}
      </section>
    </div>
  );
}

export default function ImportBatchDetailPage() {
  const { batchExternalId } = useParams<{ batchExternalId: string }>();

  if (!isApiMode()) {
    return (
      <EmptyState
        title="API mode only"
        description="Import batch history is available in API mode. Set VITE_DATA_SOURCE=api and run the backend to view it."
      />
    );
  }

  if (!batchExternalId) {
    return (
      <EmptyState
        title="Import batch not found"
        description="No batch id was provided."
      />
    );
  }

  return <ApiImportBatchDetailPage batchExternalId={batchExternalId} />;
}
