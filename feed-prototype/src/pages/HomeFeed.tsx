import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getDataSourceMode } from '../config/dataSource';
import { getHomeFeedItems, type FeedScope } from '../data/feedRepository';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { FeedItem } from '../types/feed';

const dataSourceMode = getDataSourceMode();
const isApiDataSource = dataSourceMode === 'api';

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
      } catch {
        if (isMounted) {
          setFeedItems([]);
          setError('Could not load the feed. Check that the API server is running.');
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
    feedScope,
    followingIds,
    accounts,
  ]);

  const emptyState =
    isApiDataSource ? (
      <EmptyState
        title="No API feed posts"
        description="The selected backend user has no followed account posts in the API feed."
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
            Read-only
          </p>
        ) : null}
      </div>

      {isApiDataSource ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs font-semibold leading-5 text-neutral-600">
          API mode reads the backend feed only. Follow and unfollow changes are not available in MVP6.
        </p>
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
          Loading feed...
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
