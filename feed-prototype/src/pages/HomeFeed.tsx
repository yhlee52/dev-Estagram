import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { getHomeFeedItems, type FeedScope } from '../data/feedRepository';
import { API_FOLLOWS_CHANGE_EVENT } from '../hooks/useApiFollows';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { FeedItem } from '../types/feed';
import type { PostAssetFilterType, PostFilters } from '../types/filters';

const dataSourceMode = getDataSourceMode();
const isApiDataSource = dataSourceMode === 'api';

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

const assetTypeOptions: Array<{
  value: PostAssetFilterType;
  label: string;
}> = [
  { value: '', label: 'Any asset' },
  { value: 'image', label: 'Image' },
  { value: 'plot', label: 'Plot' },
  { value: 'table', label: 'Table' },
  { value: 'file', label: 'File' },
  { value: 'link', label: 'Link' },
];

const emptyPostFilters: PostFilters = {
  keyword: '',
  tag: '',
  metadataKey: '',
  metadataValue: '',
  assetType: '',
  accountHandle: '',
  myPostsOnly: false,
};

function hasActivePostFilters(filters: PostFilters): boolean {
  return Boolean(
    filters.keyword?.trim() ||
      filters.tag?.trim() ||
      filters.metadataKey?.trim() ||
      filters.metadataValue?.trim() ||
      filters.assetType ||
      filters.accountId ||
      filters.accountHandle?.trim() ||
      filters.myPostsOnly,
  );
}

export default function HomeFeed() {
  const [feedScope, setFeedScope] = useState<FeedScope>('following');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftFilters, setDraftFilters] = useState<PostFilters>(emptyPostFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<PostFilters>(emptyPostFilters);
  const accounts = useEffectiveAccounts();
  const { activeUserId, followingIds } = useFollowState();
  const { activeApiUserId } = useActiveApiUser();
  const [apiFollowRefreshKey, setApiFollowRefreshKey] = useState(0);

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

    const loadFeedItems = async () => {
      if (isApiDataSource && !activeApiUserId) {
        setFeedItems([]);
        setIsLoading(false);
        setError('');
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const items = await getHomeFeedItems({
          activeUserId: isApiDataSource ? activeApiUserId : activeUserId,
          scope: feedScope,
          filters: isApiDataSource ? appliedFilters : undefined,
        });

        if (isMounted) {
          setFeedItems(items);
        }
      } catch (feedError) {
        if (isMounted) {
          setFeedItems([]);
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

    void loadFeedItems();

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

  const hasAppliedFilters = hasActivePostFilters(appliedFilters);

  const emptyState =
    isApiDataSource && hasAppliedFilters ? (
      <EmptyState
        title="No matching posts"
        description="Reset the filters or try a broader keyword, tag, metadata value, asset type, or account."
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

          <form
            className="grid gap-2 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedFilters(draftFilters);
            }}
          >
            <input
              type="search"
              value={draftFilters.keyword ?? ''}
              onChange={(event) => {
                setDraftFilters((currentFilters) => ({
                  ...currentFilters,
                  keyword: event.target.value,
                }));
              }}
              placeholder="Keyword"
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
            <input
              type="text"
              value={draftFilters.tag ?? ''}
              onChange={(event) => {
                setDraftFilters((currentFilters) => ({
                  ...currentFilters,
                  tag: event.target.value,
                }));
              }}
              placeholder="Tag"
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
            <input
              type="text"
              value={draftFilters.metadataKey ?? ''}
              onChange={(event) => {
                setDraftFilters((currentFilters) => ({
                  ...currentFilters,
                  metadataKey: event.target.value,
                }));
              }}
              placeholder="Metadata key"
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
            <input
              type="text"
              value={draftFilters.metadataValue ?? ''}
              onChange={(event) => {
                setDraftFilters((currentFilters) => ({
                  ...currentFilters,
                  metadataValue: event.target.value,
                }));
              }}
              placeholder="Metadata value"
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
            <select
              value={draftFilters.assetType ?? ''}
              onChange={(event) => {
                setDraftFilters((currentFilters) => ({
                  ...currentFilters,
                  assetType: event.target.value as PostAssetFilterType,
                }));
              }}
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400"
            >
              {assetTypeOptions.map((option) => (
                <option key={option.value || 'any'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={draftFilters.accountHandle ?? ''}
              onChange={(event) => {
                setDraftFilters((currentFilters) => ({
                  ...currentFilters,
                  accountHandle: event.target.value,
                }));
              }}
              placeholder="Account handle"
              className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
            <label className="flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={Boolean(draftFilters.myPostsOnly)}
                onChange={(event) => {
                  setDraftFilters((currentFilters) => ({
                    ...currentFilters,
                    myPostsOnly: event.target.checked,
                  }));
                }}
                className="size-4 accent-neutral-950"
              />
              My posts only
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-9 flex-1 rounded-md bg-neutral-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                disabled={isLoading}
              >
                Apply
              </button>
              <button
                type="button"
                className="h-9 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
                disabled={isLoading}
                onClick={() => {
                  setDraftFilters(emptyPostFilters);
                  setAppliedFilters(emptyPostFilters);
                }}
              >
                Reset
              </button>
            </div>
          </form>
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
        </div>
      )}
    </div>
  );
}
