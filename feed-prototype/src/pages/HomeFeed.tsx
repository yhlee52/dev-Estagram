import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import PostFilterPanel, {
  emptyPostFilters,
  getPostFilterValidationError,
  hasActivePostFilters,
} from '../components/PostFilterPanel';
import { getTags } from '../api/tagsApi';
import type { ApiTagCount } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { getHomeFeedItems, type FeedScope } from '../data/feedRepository';
import { API_FOLLOWS_CHANGE_EVENT } from '../hooks/useApiFollows';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { FeedItem } from '../types/feed';
import type { PostFilters } from '../types/filters';
import { filtersFromSearchParams, filtersToSearchParams } from '../utils/filterUrl';
import { routeHashtagSearch } from '../utils/hashtagSearch';

const dataSourceMode = getDataSourceMode();
const isApiDataSource = dataSourceMode === 'api';
const PAGE_LIMIT = 20;
const TAG_SUGGESTION_LIMIT = 50;

function getFeedErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and reload the feed.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return 'The selected API user was not found in the backend database. Switch user and choose a seeded backend user.';
    }

    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not load the API feed. Check the backend server and try again.';
}

function getFeedRefreshErrorMessage(error: unknown): string {
  return `Feed refresh failed after the follow change. ${getFeedErrorMessage(error)}`;
}

const feedScopeOptions: Array<{
  value: FeedScope;
  label: string;
}> = [
  { value: 'following', label: 'Following' },
  { value: 'all', label: 'All' },
];

export default function HomeFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedScope, setFeedScope] = useState<FeedScope>('following');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // The URL is the source of truth for applied filters (v0.1.0) so that
  // right-rail filter chips, hashtag links, and reload/share all take effect
  // without remounting this page.
  const appliedFilters = useMemo<PostFilters>(
    () => ({ ...emptyPostFilters, ...filtersFromSearchParams(searchParams) }),
    [searchParams],
  );
  const [draftFilters, setDraftFilters] = useState<PostFilters>(appliedFilters);
  const [syncedSearch, setSyncedSearch] = useState(() => searchParams.toString());
  const [filterError, setFilterError] = useState('');

  // Re-sync the editable draft when the URL changes from outside the panel
  // (right-rail chips, hashtag links, browser back/forward). Adjusting state
  // during render is React's recommended alternative to a syncing effect here.
  const currentSearch = searchParams.toString();
  if (currentSearch !== syncedSearch) {
    setSyncedSearch(currentSearch);
    setDraftFilters(appliedFilters);
  }
  const [tagSuggestions, setTagSuggestions] = useState<ApiTagCount[]>([]);
  const accounts = useEffectiveAccounts();
  const { activeUserId, followingIds } = useFollowState();
  const { activeApiUserId } = useActiveApiUser();
  const [apiFollowRefreshKey, setApiFollowRefreshKey] = useState(0);

  // Load popular tags once for the search box autocomplete (v0.1.2). Failures
  // are non-fatal: the search box just falls back to plain keyword input.
  useEffect(() => {
    if (!isApiDataSource) {
      return;
    }

    let isMounted = true;

    void getTags(TAG_SUGGESTION_LIMIT)
      .then((tags) => {
        if (isMounted) {
          setTagSuggestions(tags);
        }
      })
      .catch(() => {
        /* autocomplete is an enhancement; ignore load errors */
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isApiDataSource) {
      return;
    }

    const refreshApiFeed = () => {
      setApiFollowRefreshKey((currentKey) => currentKey + 1);
    };

    window.addEventListener(API_FOLLOWS_CHANGE_EVENT, refreshApiFeed);

    return () => {
      window.removeEventListener(API_FOLLOWS_CHANGE_EVENT, refreshApiFeed);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadFirstPage = async () => {
      if (isApiDataSource && !activeApiUserId) {
        setFeedItems([]);
        setNextCursor(null);
        setHasMore(false);
        setIsLoading(false);
        setError('');
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const page = await getHomeFeedItems({
          activeUserId: isApiDataSource ? activeApiUserId : activeUserId,
          scope: feedScope,
          filters: isApiDataSource ? appliedFilters : undefined,
          limit: PAGE_LIMIT,
        });

        if (isMounted) {
          setFeedItems(page.items);
          setNextCursor(page.nextCursor);
          setHasMore(page.hasMore);
        }
      } catch (feedError) {
        if (isMounted) {
          setFeedItems([]);
          setNextCursor(null);
          setHasMore(false);
          setError(
            isApiDataSource
              ? apiFollowRefreshKey > 0
                ? getFeedRefreshErrorMessage(feedError)
                : getFeedErrorMessage(feedError)
              : 'Could not load the feed.',
          );
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
  }, [
    activeApiUserId,
    activeUserId,
    apiFollowRefreshKey,
    appliedFilters,
    feedScope,
    followingIds,
    accounts,
  ]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const page = await getHomeFeedItems({
        activeUserId: isApiDataSource ? activeApiUserId : activeUserId,
        scope: feedScope,
        filters: isApiDataSource ? appliedFilters : undefined,
        cursor: nextCursor,
        limit: PAGE_LIMIT,
      });

      setFeedItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadMoreError) {
      setError(getFeedErrorMessage(loadMoreError));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasAppliedFilters = hasActivePostFilters(appliedFilters);

  // Apply filters from the panel. `#tag` in the search box is routed to the tag
  // filter first; the routed result drives draft, applied, and the URL together.
  const commitFilters = (next: PostFilters) => {
    const routed = routeHashtagSearch(next);
    const validationError = getPostFilterValidationError(routed);
    if (validationError) {
      setFilterError(validationError);
      return;
    }

    setFilterError('');
    setSearchParams(filtersToSearchParams(routed), { replace: true });
  };

  const emptyState =
    isApiDataSource && hasAppliedFilters ? (
      <EmptyState
        title="No posts match these filters"
        description="Try resetting filters or changing the search terms."
      />
    ) : isApiDataSource ? (
      <section className="rounded-md border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-400">
          --
        </div>
        <h2 className="text-base font-semibold text-neutral-950">
          No followed accounts yet
        </h2>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-neutral-500">
          Follow accounts to fill this API feed, or create a post and view it from your account profile.
        </p>
        <Link
          to="/accounts"
          className="mt-4 inline-flex h-10 items-center rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          Browse Accounts
        </Link>
      </section>
    ) : feedScope === 'following' ? (
      <EmptyState
        title="Your feed is empty"
        description="Follow an account from Explore to see its latest posts here."
      />
    ) : (
      <EmptyState
        title="No posts available"
        description="Static post data will appear here once it is added."
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <p className="text-xs font-bold uppercase text-neutral-400">
          Data source: {isApiDataSource ? 'API' : 'Mock'}
        </p>
        {isApiDataSource && activeApiUserId ? (
          <Link
            to="/posts/new"
            className="h-8 shrink-0 rounded-md bg-neutral-950 px-3 py-2 text-xs font-bold leading-4 text-white shadow-sm transition hover:bg-neutral-800"
          >
            New Post
          </Link>
        ) : null}
      </div>

      {isApiDataSource ? (
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-100 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold leading-5 text-neutral-600">
              API mode feed reflects backend follow state.
            </p>
            <button
              type="button"
              className="h-8 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
              disabled={isLoading}
              onClick={() => {
                setApiFollowRefreshKey((currentKey) => currentKey + 1);
              }}
            >
              Refresh feed
            </button>
          </div>

          <PostFilterPanel
            filters={draftFilters}
            onChange={(nextFilters) => {
              if (nextFilters.metadataKey?.trim()) {
                setFilterError('');
              }

              setDraftFilters(nextFilters);
            }}
            onApply={() => commitFilters(draftFilters)}
            onReset={() => {
              setFilterError('');
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
            isLoading={isLoading}
            resultCount={!isLoading && !error && activeApiUserId ? feedItems.length : undefined}
            mode="feed"
            activeUserId={activeApiUserId}
            error={filterError}
            hasAppliedFilters={hasAppliedFilters}
            tagSuggestions={tagSuggestions}
            onSelectTag={(tag) => commitFilters({ ...draftFilters, keyword: '', tag })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 rounded-md border border-neutral-200 bg-neutral-100 p-1">
          {feedScopeOptions.map((option) => {
            const isSelected = feedScope === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setFeedScope(option.value)}
                className={[
                  'h-9 rounded text-sm font-semibold transition',
                  isSelected
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-950',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {isApiDataSource && !activeApiUserId ? (
        <EmptyState
          title="Select an API user"
          description="Choose a backend seed user before loading the API feed."
        />
      ) : isLoading ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          {isApiDataSource ? 'Loading API feed...' : 'Loading feed...'}
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : feedItems.length === 0 ? (
        emptyState
      ) : (
        <div className="space-y-3.5">
          {feedItems.map((item) => (
            <FeedCard key={item.post.id} item={item} />
          ))}

          {hasMore ? (
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
