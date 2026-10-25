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
      message: `서버(${getApiBaseUrl()})에 연결할 수 없습니다. 서버를 확인해 주세요.`,
      notFound: false,
    };
  }
  if (error instanceof ApiClientError) {
    return { message: `가져오기 기록을 불러오지 못했습니다. (${error.status})`, notFound: error.status === 404 };
  }
  return {
    message: '가져오기 기록을 불러오지 못했습니다. 다시 시도해 주세요.',
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
      ← 가져오기 기록
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          가져오기 기록을 불러오는 중...
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
            title="가져오기 기록을 찾지 못했습니다"
            description={`"${batchExternalId}" 묶음을 찾지 못했습니다.`}
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
              {batch.source ? `출처: ${batch.source}` : '출처 없음'}
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
          <Stat label="생성한 게시글" value={String(batch.posts_created)} />
          <Stat label="갱신한 게시글" value={String(batch.posts_updated)} />
          <Stat label="건너뛴 게시글" value={String(batch.posts_skipped)} />
          <Stat label="현재 게시글" value={String(batch.post_count)} />
          <Stat label="계정 생성/갱신" value={`${batch.accounts_created}/${batch.accounts_updated}`} />
          <Stat label="생성한 자료" value={String(batch.assets_created)} />
          <Stat label="가져온 횟수" value={String(batch.import_count)} />
          <Stat label="최근 가져옴" value={formatRelativeTime(batch.last_imported_at)} />
        </div>

        <p className="text-xs text-neutral-400">
          처음 가져옴 {formatDateTime(batch.first_imported_at)} · 최근 가져옴{' '}
          {formatDateTime(batch.last_imported_at)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-bold text-neutral-950">
          이 묶음의 게시글 ({posts.length})
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
            title="게시글이 없습니다"
            description="현재 이 묶음에 속한 게시글이 없습니다. 이후 가져오기에서 다른 묶음으로 옮겨졌을 수 있습니다."
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
        title="API 모드에서만 사용할 수 있습니다"
        description="가져오기 기록을 보려면 API 모드에서 백엔드를 실행해 주세요."
      />
    );
  }

  if (!batchExternalId) {
    return (
      <EmptyState
        title="가져오기 기록을 찾지 못했습니다"
        description="묶음 ID가 없습니다."
      />
    );
  }

  return <ApiImportBatchDetailPage batchExternalId={batchExternalId} />;
}
