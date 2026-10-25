import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getAccounts } from '../api/accountsApi';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getPosts } from '../api/postsApi';
import { getTags } from '../api/tagsApi';
import { getMetadataKeys } from '../api/metadataApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import ExploreTags from '../components/ExploreTags';
import FeedCard from '../components/FeedCard';
import PostFilterPanel from '../components/PostFilterPanel';
import {
  emptyPostFilters,
  getPostFilterValidationError,
  hasActivePostFilters,
} from '../utils/postFilters';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { mapApiAccountToAccount, mapApiPostToPost } from '../data/apiFeedRepository';
import postsData from '../data/posts.json';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import type { Account, FeedItem, Post } from '../types/feed';
import type { PostFilters } from '../types/filters';
import { ApiAccountsSearch } from './AccountsPage';
import AppliedFiltersSummary from '../components/AppliedFiltersSummary';
import { getFeedItems } from '../utils/feed';
import { filtersFromSearchParams, filtersToSearchParams } from '../utils/filterUrl';
import { routeHashtagSearch } from '../utils/hashtagSearch';
import type { ApiMetadataKeyCount, ApiPostWithAssets, ApiTagCount } from '../api/types';

const TAG_SUGGESTION_LIMIT = 50;
const FACET_KEY_LIMIT = 50;
const POPULAR_TAG_DISPLAY_LIMIT = 20;
const RECENT_TAG_LIMIT = 12;
const RECENT_TAG_POST_SCAN = 30;

const isApiDataSource = getDataSourceMode() === 'api';
const mockPosts = postsData as unknown as Post[];
const PAGE_LIMIT = 20;

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다. 서버를 확인해 주세요.`;
  }

  if (error instanceof ApiClientError) {
    return `게시글을 불러오지 못했습니다. (${error.status})`;
  }

  return '게시글을 불러오지 못했습니다. 다시 시도해 주세요.';
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
  const accountTab = isApiDataSource && searchParams.get('tab') === 'accounts';
  const restoreKey = `explore-return:${activeApiUserId}:${searchParams.toString()}`;
  const queryKeyRef = useRef(searchParams.toString());
  useEffect(() => { queryKeyRef.current = searchParams.toString(); }, [searchParams]);
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (next.has('tab') && next.get('tab') !== 'accounts') next.delete('tab');
    if (next.has('sort') && !['newest', 'oldest', 'metadata_asc', 'metadata_desc'].includes(next.get('sort') ?? '')) next.delete('sort');
    if (['metadata_asc', 'metadata_desc'].includes(next.get('sort') ?? '') && !next.get('sort_metadata_key')?.trim()) next.delete('sort');
    if (next.has('asset_type') && !['image', 'plot', 'table', 'file', 'link'].includes(next.get('asset_type') ?? '')) next.delete('asset_type');
    if (next.has('metadata_match') && !['contains', 'exact'].includes(next.get('metadata_match') ?? '')) next.delete('metadata_match');
    if (!next.get('metadata_key')?.trim()) { next.delete('metadata_value'); next.delete('metadata_match'); }
    if (!['metadata_asc', 'metadata_desc'].includes(next.get('sort') ?? '')) next.delete('sort_metadata_key');
    for (const key of ['created_at_from', 'created_at_to']) {
      const value = next.get(key);
      if (value && !validCalendarDate(value)) next.delete(key);
    }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
  const [metadataKeySuggestions, setMetadataKeySuggestions] = useState<
    ApiMetadataKeyCount[]
  >([]);
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

    // Known metadata keys for facet selection (v0.4.0). Enhancement-only.
    void getMetadataKeys(FACET_KEY_LIMIT)
      .then((keys) => {
        if (isMounted) {
          setMetadataKeySuggestions(keys);
        }
      })
      .catch(() => {
        /* facet selection is an enhancement; ignore load errors */
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isApiDataSource || accountTab) {
      return;
    }

    let isMounted = true;

    const loadFirstPage = async () => {
      setIsLoading(true);
      setIsLoadingMore(false);
      setError('');
      let restore: { count: number; y: number } | null = null;
      try {
        const saved = window.sessionStorage.getItem(restoreKey);
        if (saved) restore = JSON.parse(saved) as { count: number; y: number };
        window.sessionStorage.removeItem(restoreKey);
      } catch { /* History restoration is optional. */ }

      try {
        const [accountsResponse, firstPage] = await Promise.all([
          getAccounts(true),
          getPosts(appliedFilters, { limit: PAGE_LIMIT, activeUserId: activeApiUserId }),
        ]);

        if (!isMounted) {
          return;
        }

        const accountsById = new Map(
          accountsResponse.map(mapApiAccountToAccount).map((account) => [account.id, account]),
        );
        accountsByIdRef.current = accountsById;

        const loaded = [...firstPage.items];
        let nextCursor = firstPage.next_cursor;
        let hasMore = firstPage.has_more;
        for (let pageNumber = 1; isMounted && restore && loaded.length < Math.min(restore.count, PAGE_LIMIT * 10) && nextCursor && hasMore && pageNumber < 10; pageNumber += 1) {
          const page = await getPosts(appliedFilters, { limit: PAGE_LIMIT, activeUserId: activeApiUserId, cursor: nextCursor });
          loaded.push(...page.items);
          nextCursor = page.next_cursor;
          hasMore = page.has_more;
        }
        if (!isMounted) return;
        setApiItems(mapPostsToItems(loaded, accountsById));
        setNextCursor(nextCursor);
        setHasMore(hasMore);
        if (restore && Number.isFinite(restore.y)) requestAnimationFrame(() => window.scrollTo(0, restore!.y));
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
  }, [appliedFilters, activeApiUserId, accountTab, restoreKey]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    const requestKey = queryKeyRef.current;

    try {
      const postsResponse = await getPosts(appliedFilters, {
        cursor: nextCursor,
        limit: PAGE_LIMIT,
        activeUserId: activeApiUserId,
      });
      if (requestKey !== queryKeyRef.current) return;

      setApiItems((current) => [
        ...current,
        ...mapPostsToItems(postsResponse.items, accountsByIdRef.current),
      ]);
      setNextCursor(postsResponse.next_cursor);
      setHasMore(postsResponse.has_more);
    } catch (loadMoreError) {
      if (requestKey === queryKeyRef.current) setError(getBrowseErrorMessage(loadMoreError));
    } finally {
      if (requestKey === queryKeyRef.current) setIsLoadingMore(false);
    }
  };

  const rememberResultPosition = () => {
    if (!isApiDataSource) return;
    try { window.sessionStorage.setItem(restoreKey, JSON.stringify({ count: apiItems.length, y: window.scrollY })); }
    catch { /* Browsing still works when storage is unavailable. */ }
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
    setSearchParams(filtersToSearchParams(routed));
  };

  const resetFilters = () => {
    setFilterError('');
    setSearchParams(new URLSearchParams());
  };

  const chooseTab = (tab: 'posts' | 'accounts') => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'accounts') next.set('tab', 'accounts');
    else next.delete('tab');
    setSearchParams(next);
  };

  const tabs = isApiDataSource ? (
    <div className="flex gap-2" role="tablist" aria-label="탐색 유형">
      <button type="button" role="tab" aria-selected={!accountTab} onClick={() => chooseTab('posts')}
        className={`rounded-md px-4 py-2 text-sm font-bold ${!accountTab ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-700'}`}>게시글</button>
      <button type="button" role="tab" aria-selected={accountTab} onClick={() => chooseTab('accounts')}
        className={`rounded-md px-4 py-2 text-sm font-bold ${accountTab ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-700'}`}>계정</button>
    </div>
  ) : null;

  if (accountTab) {
    return <div className="space-y-4">
      <h1 className="text-lg font-bold">탐색</h1>
      {tabs}
      <p className="text-xs text-neutral-500">게시글 상세 조건은 게시글 탭에서 적용됩니다.</p>
      <ApiAccountsSearch />
    </div>;
  }

  return (
    <div className="space-y-4">
      {tabs}
      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-neutral-950">탐색</h2>
          <p className="text-xs font-semibold text-neutral-500">
            전체 게시글을 찾아보세요
          </p>
        </div>
      </div>

      {!hasAppliedFilters ? (
        <ExploreTags popularTags={popularTags} recentTags={recentTags} />
      ) : null}

      {isApiDataSource ? (
        <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-100 p-3">
          <p className="text-xs font-semibold leading-5 text-neutral-600">
            팔로우 여부와 관계없이 모든 게시글에서 검색합니다.
          </p>
          <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}
            className="text-sm font-bold text-neutral-800 underline">상세 조건 {advancedOpen ? '접기' : '열기'}</button>
          <PostFilterPanel
            filters={draftFilters}
            onChange={(nextFilters) => {
              if (nextFilters.metadataKey?.trim()) {
                setFilterError('');
              }

              setDraftFilters(nextFilters);
            }}
            onApply={() => commitFilters(draftFilters)}
            onReset={resetFilters}
            isLoading={isLoading}
            resultCount={!isLoading && !error ? items.length : undefined}
            mode="browse"
            advancedOpen={advancedOpen}
            activeUserId={activeApiUserId}
            error={filterError}
            hasAppliedFilters={hasAppliedFilters}
            tagSuggestions={tagSuggestions}
            onSelectTag={(tag) => commitFilters({ ...draftFilters, keyword: '', tag })}
            metadataKeySuggestions={metadataKeySuggestions}
            onSelectFacet={(key, value) =>
              commitFilters({
                ...draftFilters,
                metadataKey: key,
                metadataValue: value,
                metadataMatch: 'exact',
              })
            }
          />
        </section>
      ) : (
        <div className="space-y-2">
          {appliedFilters.tag?.trim() ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              <p className="truncate text-sm font-semibold text-neutral-700">
                적용된 태그{' '}
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
                  setSearchParams(next);
                }}
              >
                태그 지우기
              </button>
            </div>
          ) : null}
          <p className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-500 shadow-sm">
            데모 모드에서는 태그로 게시글을 찾아볼 수 있습니다.
          </p>
        </div>
      )}

      <AppliedFiltersSummary />

      {error && items.length > 0 ? <p role="alert" className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {isLoading ? (
        <p role="status" className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          게시글을 불러오는 중...
        </p>
      ) : error && items.length === 0 ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error} <button type="button" className="ml-2 underline" onClick={() => window.location.reload()}>다시 시도</button>
        </p>
      ) : items.length === 0 ? (
        hasAppliedFilters ? (
          <EmptyState
            title="검색 결과가 없습니다"
            description="검색어를 바꾸거나 상세 조건을 초기화해 보세요."
            action={
              <button
                type="button"
                className="h-9 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
                onClick={resetFilters}
              >
                조건 초기화
              </button>
            }
          />
        ) : (
          <EmptyState
            title="게시글이 없습니다"
            description="게시글이 추가되면 여기에 표시됩니다."
          />
        )
      ) : (
        <div className="space-y-3.5" onClickCapture={(event) => {
          if (!(event.target as HTMLElement).closest('button')) rememberResultPosition();
        }} onKeyDownCapture={(event) => {
          if (event.key === 'Enter') rememberResultPosition();
        }}>
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
              {isLoadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
