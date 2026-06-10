import { useEffect, useMemo, useState } from 'react';
import { getAccounts } from '../api/accountsApi';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getPosts } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import PostFilterPanel, {
  emptyPostFilters,
  getPostFilterValidationError,
  hasActivePostFilters,
} from '../components/PostFilterPanel';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { mapApiAccountToAccount, mapApiPostToPost } from '../data/apiFeedRepository';
import postsData from '../data/posts.json';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import type { FeedItem, Post } from '../types/feed';
import type { PostFilters } from '../types/filters';
import { getFeedItems } from '../utils/feed';

const isApiDataSource = getDataSourceMode() === 'api';
const mockPosts = postsData as unknown as Post[];

function getBrowseErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and reload posts.`;
  }

  if (error instanceof ApiClientError) {
    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not load posts. Check the backend server and try again.';
}

export default function PostsBrowsePage() {
  const mockAccounts = useEffectiveAccounts();
  const { activeApiUserId } = useActiveApiUser();
  const [draftFilters, setDraftFilters] = useState<PostFilters>(emptyPostFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<PostFilters>(emptyPostFilters);
  const [filterError, setFilterError] = useState('');
  const [apiItems, setApiItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isApiDataSource) {
      return;
    }

    let isMounted = true;

    const loadPosts = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [accountsResponse, postsResponse] = await Promise.all([
          getAccounts(),
          getPosts(appliedFilters),
        ]);

        if (!isMounted) {
          return;
        }

        const accounts = accountsResponse.map(mapApiAccountToAccount);
        const accountsById = new Map(
          accounts.map((account) => [account.id, account]),
        );
        const items = postsResponse
          .map((post) => {
            const account = accountsById.get(post.account_id);
            if (!account) {
              return undefined;
            }

            return {
              account,
              post: mapApiPostToPost(post, post.assets),
            };
          })
          .filter((item): item is FeedItem => item !== undefined);

        setApiItems(items);
      } catch (loadError) {
        if (isMounted) {
          setApiItems([]);
          setError(getBrowseErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPosts();

    return () => {
      isMounted = false;
    };
  }, [appliedFilters]);

  const mockItems = useMemo(
    () => getFeedItems(mockPosts, mockAccounts),
    [mockAccounts],
  );
  const items = isApiDataSource ? apiItems : mockItems;
  const hasAppliedFilters = hasActivePostFilters(appliedFilters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-neutral-950">Browse Posts</h2>
          <p className="text-xs font-semibold text-neutral-500">
            {isApiDataSource ? 'All API posts' : 'All mock posts'}
          </p>
        </div>
        <p className="text-xs font-bold uppercase text-neutral-400">
          {isApiDataSource ? 'API' : 'Mock'}
        </p>
      </div>

      {isApiDataSource ? (
        <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-100 p-3">
          <p className="text-xs font-semibold leading-5 text-neutral-600">
            Browse searches all backend posts, not only followed accounts.
          </p>
          <PostFilterPanel
            filters={draftFilters}
            onChange={(nextFilters) => {
              if (nextFilters.metadataKey?.trim()) {
                setFilterError('');
              }

              setDraftFilters(nextFilters);
            }}
            onApply={() => {
              const validationError = getPostFilterValidationError(draftFilters);
              if (validationError) {
                setFilterError(validationError);
                return;
              }

              setFilterError('');
              setAppliedFilters(draftFilters);
            }}
            onReset={() => {
              setDraftFilters(emptyPostFilters);
              setAppliedFilters(emptyPostFilters);
              setFilterError('');
            }}
            isLoading={isLoading}
            resultCount={!isLoading && !error ? items.length : undefined}
            mode="browse"
            activeUserId={activeApiUserId}
            error={filterError}
            hasAppliedFilters={hasAppliedFilters}
          />
        </section>
      ) : (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-500 shadow-sm">
          Filter/search is available in API mode.
        </p>
      )}

      {isLoading ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          Loading posts...
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : items.length === 0 ? (
        hasAppliedFilters ? (
          <EmptyState
            title="No posts match these filters"
            description="Try resetting filters or changing the search terms."
          />
        ) : (
          <EmptyState
            title="No posts available"
            description="Posts will appear here once they are added."
          />
        )
      ) : (
        <div className="space-y-3.5">
          {items.map((item) => (
            <FeedCard key={item.post.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
