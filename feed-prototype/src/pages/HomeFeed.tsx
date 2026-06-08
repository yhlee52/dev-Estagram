import { useEffect, useState } from 'react';
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

const feedScopeOptions: Array<{
  value: FeedScope;
  label: string;
}> = [
  { value: 'following', label: 'Following' },
  { value: 'all', label: 'All' },
];

export default function HomeFeed() {
  const [feedScope, setFeedScope] = useState<FeedScope>('following');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
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
        });

        if (isMounted) {
          setFeedItems(items);
        }
      } catch (feedError) {
        if (isMounted) {
          setFeedItems([]);
          setError(
            isApiDataSource
              ? getFeedErrorMessage(feedError)
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
    feedScope,
    followingIds,
    accounts,
  ]);

  const emptyState =
    isApiDataSource ? (
      <EmptyState
        title="No feed to display"
        description="This backend user has no followed account posts in the API feed yet."
      />
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
        {isApiDataSource ? (
          <p className="text-right text-xs font-semibold text-neutral-500">
            API follow state
          </p>
        ) : null}
      </div>

      {isApiDataSource ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2">
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
