import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
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
import type { Account, FeedItem, Post } from '../types/feed';
import type { PostFilters } from '../types/filters';
import { getFeedItems } from '../utils/feed';
import { filtersFromSearchParams, filtersToSearchParams } from '../utils/filterUrl';
import type { ApiPostWithAssets } from '../api/types';

const isApiDataSource = getDataSourceMode() === 'api';
const mockPosts = postsData as unknown as Post[];
const PAGE_LIMIT = 20;

function getBrowseErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and reload posts.`;
  }

  if (error instanceof ApiClientError) {
    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not load posts. Check the backend server and try again.';
}

function mapPostsToItems(
  posts: ApiPostWithAssets[],
  accountsById: Map<string, Account>,
): FeedItem[] {
  return posts
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
}

export default function PostsBrowsePage() {
  const mockAccounts = useEffectiveAccounts();
  const { activeApiUserId } = useActiveApiUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<PostFilters>(() => ({
    ...emptyPostFilters,
    ...filtersFromSearchParams(searchParams),
  }));
  const [appliedFilters, setAppliedFilters] = useState<PostFilters>(() => ({
    ...emptyPostFilters,
    ...filtersFromSearchParams(searchParams),
  }));
  const [filterError, setFilterError] = useState('');
  const [apiItems, setApiItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const accountsByIdRef = useRef<Map<string, Account>>(new Map());

  useEffect(() => {
    if (!isApiDataSource) {
      return;
    }

    let isMounted = true;

    const loadFirstPage = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [accountsResponse, postsResponse] = await Promise.all([
          getAccounts(),
          getPosts(appliedFilters, { limit: PAGE_LIMIT, activeUserId: activeApiUserId }),
        ]);

        if (!isMounted) {
          return;
        }

        const accountsById = new Map(
          accountsResponse.map(mapApiAccountToAccount).map((account) => [account.id, account]),
        );
        accountsByIdRef.current = accountsById;

        setApiItems(mapPostsToItems(postsResponse.items, accountsById));
        setNextCursor(postsResponse.next_cursor);
        setHasMore(postsResponse.has_more);
      } catch (loadError) {
        if (isMounted) {
          setApiItems([]);
          setNextCursor(null);
          setHasMore(false);
          setError(getBrowseErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFirstPage();

    return () => {
      isMounted = false;
    };
  }, [appliedFilters, activeApiUserId]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const postsResponse = await getPosts(appliedFilters, {
        cursor: nextCursor,
        limit: PAGE_LIMIT,
        activeUserId: activeApiUserId,
      });

      setApiItems((current) => [
        ...current,
        ...mapPostsToItems(postsResponse.items, accountsByIdRef.current),
      ]);
      setNextCursor(postsResponse.next_cursor);
      setHasMore(postsResponse.has_more);
    } catch (loadMoreError) {
      setError(getBrowseErrorMessage(loadMoreError));
    } finally {
      setIsLoadingMore(false);
    }
  };

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
              setSearchParams(filtersToSearchParams(draftFilters), { replace: true });
            }}
            onReset={() => {
              setDraftFilters(emptyPostFilters);
              setAppliedFilters(emptyPostFilters);
              setFilterError('');
              setSearchParams(new URLSearchParams(), { replace: true });
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

          {isApiDataSource && hasMore ? (
            <button
              type="button"
              className="h-10 w-full rounded-md border border-neutral-200 bg-white text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
