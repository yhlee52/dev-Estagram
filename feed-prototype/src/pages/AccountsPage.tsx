import { useEffect, useMemo, useState } from 'react';
import { ApiNetworkError } from '../api/client';
import { getAccounts } from '../api/accountsApi';
import { getAllPosts } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import AccountCard from '../components/AccountCard';
import postsData from '../data/posts.json';
import { mapApiAccountToAccount } from '../data/apiFeedRepository';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useApiFollows } from '../hooks/useApiFollows';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, Post } from '../types/feed';
import {
  buildAccountActivity,
  getAccountActivity,
  sortAccounts,
  RECENT_ACTIVITY_DAYS,
  type AccountSort,
  type PostActivityEntry,
} from '../utils/accountActivity';

const posts = postsData as unknown as Post[];
const isApiDataSource = getDataSourceMode() === 'api';

const mockActivityEntries: PostActivityEntry[] = posts.map((post) => ({
  accountId: post.accountId,
  createdAt: post.createdAt,
}));

const SORT_OPTIONS: { value: AccountSort; label: string }[] = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'posts', label: 'Most posts' },
  { value: 'name', label: 'Name' },
];

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

export default function AccountsPage() {
  const mockAccounts = useEffectiveAccounts();
  const { isFollowing: isMockFollowing, toggleFollow: toggleMockFollow } =
    useFollowState();
  const { activeApiUserId } = useActiveApiUser();
  const apiFollows = useApiFollows(isApiDataSource ? activeApiUserId : '');
  const [apiAccounts, setApiAccounts] = useState<Account[]>([]);
  const [apiActivityEntries, setApiActivityEntries] = useState<
    PostActivityEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<AccountSort>('recent');

  useEffect(() => {
    if (!isApiDataSource) {
      return;
    }

    let isMounted = true;

    const loadAccounts = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [accountsResponse, postsResponse] = await Promise.all([
          getAccounts(),
          getAllPosts(),
        ]);

        if (isMounted) {
          setApiAccounts(accountsResponse.map(mapApiAccountToAccount));
          setApiActivityEntries(
            postsResponse.map((post) => ({
              accountId: post.account_id,
              createdAt: post.created_at,
            })),
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setApiAccounts([]);
          setApiActivityEntries([]);
          setError(
            loadError instanceof ApiNetworkError
              ? `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`
              : 'Could not load API accounts. Check the backend server and try again.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      isMounted = false;
    };
  }, []);

  const accounts = isApiDataSource ? apiAccounts : mockAccounts;
  const activityEntries = isApiDataSource
    ? apiActivityEntries
    : mockActivityEntries;
  const activityById = useMemo(
    () => buildAccountActivity(activityEntries),
    [activityEntries],
  );
  const sortedAccounts = useMemo(
    () => sortAccounts(accounts, activityById, sort),
    [accounts, activityById, sort],
  );

  if (isLoading) {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
        Loading API accounts...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
        {error}
      </p>
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No accounts available"
        description="Static account data will appear here once it is added."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <p className="text-xs font-bold uppercase text-neutral-400">
          Data source: {isApiDataSource ? 'API' : 'Mock'}
        </p>
        {isApiDataSource ? (
          <p className="text-right text-xs font-semibold text-neutral-500">
            Follow changes sync to API
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          Sort
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((option) => {
            const isActive = sort === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSort(option.value)}
                className={[
                  'rounded-md border px-2.5 py-1 text-xs font-bold transition-colors',
                  isActive
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isApiDataSource && apiFollows.error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {apiFollows.error}
        </p>
      ) : null}

      {sortedAccounts.map((account) => (
        (() => {
          const isOwnApiAccount =
            isApiDataSource && getAccountUserId(account) === activeApiUserId;
          const isPendingApiAccount =
            apiFollows.pendingAccountId === account.id;
          const isApiFollowDisabled =
            apiFollows.isLoading || apiFollows.isMutating || isOwnApiAccount;
          const apiFollowing = apiFollows.isFollowing(account.id);
          const activity = getAccountActivity(activityById, account.id);

          return (
            <AccountCard
              key={account.id}
              account={account}
              postCount={activity.postCount}
              recentPostCount={activity.recentPostCount}
              recentWindowDays={RECENT_ACTIVITY_DAYS}
              lastActiveAt={activity.lastActiveAt}
              isFollowing={
                isApiDataSource ? apiFollowing : isMockFollowing(account.id)
              }
              onToggleFollow={
                isApiDataSource ? apiFollows.toggleFollow : toggleMockFollow
              }
              isFollowDisabled={isApiDataSource && isApiFollowDisabled}
              followButtonLabel={
                isOwnApiAccount
                  ? 'This is your account'
                  : apiFollows.isLoading
                  ? 'Loading...'
                  : isPendingApiAccount
                  ? 'Saving...'
                  : isApiDataSource
                  ? apiFollowing
                    ? 'Unfollow'
                    : 'Follow'
                  : undefined
              }
            />
          );
        })()
      ))}
    </div>
  );
}
