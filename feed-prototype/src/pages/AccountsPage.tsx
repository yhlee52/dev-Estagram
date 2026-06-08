import { useEffect, useMemo, useState } from 'react';
import { ApiNetworkError } from '../api/client';
import { getAccounts } from '../api/accountsApi';
import { getPosts } from '../api/postsApi';
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

const posts = postsData as unknown as Post[];
const isApiDataSource = getDataSourceMode() === 'api';

const postCountByAccountId = posts.reduce<Record<string, number>>((counts, post) => {
  counts[post.accountId] = (counts[post.accountId] ?? 0) + 1;
  return counts;
}, {});

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
  const [apiPostCountByAccountId, setApiPostCountByAccountId] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [error, setError] = useState('');

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
          getPosts(),
        ]);

        if (isMounted) {
          setApiAccounts(accountsResponse.map(mapApiAccountToAccount));
          setApiPostCountByAccountId(
            postsResponse.reduce<Record<string, number>>((counts, post) => {
              counts[post.account_id] = (counts[post.account_id] ?? 0) + 1;
              return counts;
            }, {}),
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setApiAccounts([]);
          setApiPostCountByAccountId({});
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
  const countsByAccountId = useMemo(
    () => (isApiDataSource ? apiPostCountByAccountId : postCountByAccountId),
    [apiPostCountByAccountId],
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

      {isApiDataSource && apiFollows.error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {apiFollows.error}
        </p>
      ) : null}

      {accounts.map((account) => (
        (() => {
          const isOwnApiAccount =
            isApiDataSource && getAccountUserId(account) === activeApiUserId;
          const isPendingApiAccount =
            apiFollows.pendingAccountId === account.id;
          const isApiFollowDisabled =
            apiFollows.isLoading || apiFollows.isMutating || isOwnApiAccount;
          const apiFollowing = apiFollows.isFollowing(account.id);

          return (
            <AccountCard
              key={account.id}
              account={account}
              postCount={countsByAccountId[account.id] ?? 0}
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
