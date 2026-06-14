import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getAccounts } from '../api/accountsApi';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getPosts } from '../api/postsApi';
import { getTags } from '../api/tagsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import ExploreTags from '../components/ExploreTags';
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
import { routeHashtagSearch } from '../utils/hashtagSearch';
import type { ApiPostWithAssets, ApiTagCount } from '../api/types';

const TAG_SUGGESTION_LIMIT = 50;
const POPULAR_TAG_DISPLAY_LIMIT = 20;
const RECENT_TAG_LIMIT = 12;
const RECENT_TAG_POST_SCAN = 30;

const isApiDataSource = getDataSourceMode() === 'api';
const mockPosts = postsData as unknown as Post[];
const PAGE_LIMIT = 20;

/** Count tag usage across posts (case-insensitive), highest first. */
function popularTagsFromPosts(posts: Post[]): ApiTagCount[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const rawTag of post.tags ?? []) {
      const tag = rawTag.trim().toLowerCase();
      if (tag) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Collect tags from the newest posts in order, deduped case-insensitively. */
function recentTagsFromItems(items: FeedItem[]): string[] {
  const seen = new Set<string>();
  const recent: string[] = [];

  for (const item of items.slice(0, RECENT_TAG_POST_SCAN)) {
    for (const rawTag of item.post.tags ?? []) {
      const tag = rawTag.trim();
      const key = tag.toLowerCase();
      if (tag && !seen.has(key)) {
        seen.add(key);
        recent.push(tag);
        if (recent.length >= RECENT_TAG_LIMIT) {
          return recent;
        }
      }
    }
  }

  return recent;
}

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
  // The URL is the source of truth for applied filters so that hashtag links
  // like `/posts?tag=<tag>` (v0.1.1) take effect even when we are already on
  // this page (no remount) and survive reload/share.
  const appliedFilters = useMemo<PostFilters>(
    () => ({ ...emptyPostFilters, ...filtersFromSearchParams(searchParams) }),
    [searchParams],
  );
  const [draftFilters, setDraftFilters] = useState<PostFilters>(appliedFilters);
  const [syncedSearch, setSyncedSearch] = useState(() => searchParams.toString());
  const [filterError, setFilterError] = useState('');

  // Reset the editable draft when the URL changes from outside the panel
  // (e.g. a hashtag link click or browser back/forward). Adjusting state during
  // render is React's recommended alternative to a syncing effect here.
  const currentSearch = searchParams.toString();
  if (currentSearch !== syncedSearch) {
    setSyncedSearch(currentSearch);
    setDraftFilters(appliedFilters);
  }
  const [apiItems, setApiItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<ApiTagCount[]>([]);
  const accountsByIdRef = useRef<Map<string, Account>>(new Map());

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

  // Mock mode has no filter panel, but hashtag chips still link here as
  // `/posts?tag=<tag>` (v0.1.1). Apply just the tag filter client-side so those
  // links are not a dead-end; matching is case-insensitive like the API filter.
  const mockTagFilter = appliedFilters.tag?.trim().toLowerCase() ?? '';
  const mockItems = useMemo(() => {
    const allItems = getFeedItems(mockPosts, mockAccounts);
    if (!mockTagFilter) {
      return allItems;
    }

    return allItems.filter((item) =>
      (item.post.tags ?? []).some(
        (tag) => tag.trim().toLowerCase() === mockTagFilter,
      ),
    );
  }, [mockAccounts, mockTagFilter]);
  const items = isApiDataSource ? apiItems : mockItems;
  const hasAppliedFilters = hasActivePostFilters(appliedFilters);

  // Explore landing (v0.2.2): popular tags come from the tag index (API) or a
  // client-side count (mock); recent tags are derived from the newest posts
  // already on screen. Shown only when no filter is applied so picking a tag
  // swaps this section for results.
  const popularTags = useMemo<ApiTagCount[]>(
    () =>
      (isApiDataSource ? tagSuggestions : popularTagsFromPosts(mockPosts)).slice(
        0,
        POPULAR_TAG_DISPLAY_LIMIT,
      ),
    [tagSuggestions],
  );
  const recentTags = useMemo(() => recentTagsFromItems(items), [items]);

  // The URL is the source of truth here, so committing only updates the query
  // string; `draftFilters` re-syncs from it on the next render. `#tag` in the
  // search box is routed to the tag filter before validation/serialization.
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-neutral-950">Explore</h2>
          <p className="text-xs font-semibold text-neutral-500">
            {isApiDataSource ? 'Search and browse all posts' : 'Browse mock posts'}
          </p>
        </div>
        <p className="text-xs font-bold uppercase text-neutral-400">
          {isApiDataSource ? 'API' : 'Mock'}
        </p>
      </div>

      {!hasAppliedFilters ? (
        <ExploreTags popularTags={popularTags} recentTags={recentTags} />
      ) : null}

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
            onApply={() => commitFilters(draftFilters)}
            onReset={() => {
              setFilterError('');
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
            isLoading={isLoading}
            resultCount={!isLoading && !error ? items.length : undefined}
            mode="browse"
            activeUserId={activeApiUserId}
            error={filterError}
            hasAppliedFilters={hasAppliedFilters}
            tagSuggestions={tagSuggestions}
            onSelectTag={(tag) => commitFilters({ ...draftFilters, keyword: '', tag })}
          />
        </section>
      ) : (
        <div className="space-y-2">
          {appliedFilters.tag?.trim() ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              <p className="truncate text-sm font-semibold text-neutral-700">
                Filtered by{' '}
                <span className="font-bold text-neutral-950">
                  #{appliedFilters.tag.trim()}
                </span>
              </p>
              <button
                type="button"
                className="h-8 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('tag');
                  setSearchParams(next, { replace: true });
                }}
              >
                Clear tag
              </button>
            </div>
          ) : null}
          <p className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-500 shadow-sm">
            Tag filter works in mock mode. Full filter/search is available in API mode.
          </p>
        </div>
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
