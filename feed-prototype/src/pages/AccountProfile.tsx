import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getAccount, getAccountPosts } from '../api/accountsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import postsData from '../data/posts.json';
import {
  mapApiAccountToAccount,
  mapApiPostToPost,
} from '../data/apiFeedRepository';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { useApiFollows } from '../hooks/useApiFollows';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, FeedItem, Post } from '../types/feed';
import { formatDateTime } from '../utils/format';
import { getPostsByAccountId, joinPostWithAccount } from '../utils/feed';

const posts = postsData as unknown as Post[];
const isApiDataSource = getDataSourceMode() === 'api';

function getProfileErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError && error.status === 404) {
    return 'This account was not found in the backend database.';
  }

  return 'Could not load this API account. Check the backend server and try again.';
}

function AccountAvatar({ account }: { account: Account }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = account.displayName.trim().charAt(0).toUpperCase() || 'A';

  if (!account.avatarUrl || hasImageError) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-2xl font-bold text-neutral-600 ring-1 ring-neutral-200">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={account.avatarUrl}
      alt={`${account.displayName} avatar`}
      className="size-20 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
      onError={() => setHasImageError(true)}
    />
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-3">
      <p className="text-xs font-bold uppercase text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-neutral-950">{value}</p>
    </div>
  );
}

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

function isAccountDeactivated(account: Account): boolean {
  return Boolean(account.metadata?.deactivated_at);
}

export default function AccountProfile() {
  const { accountId } = useParams();
  const accounts = useEffectiveAccounts();
  const { isFollowing: isMockFollowing, toggleFollow: toggleMockFollow } =
    useFollowState();
  const { activeApiUserId } = useActiveApiUser();
  const apiFollows = useApiFollows(isApiDataSource ? activeApiUserId : '');
  const [apiAccount, setApiAccount] = useState<Account | undefined>();
  const [apiAccountPosts, setApiAccountPosts] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isApiDataSource || !accountId) {
      return;
    }

    let isMounted = true;

    const loadAccountProfile = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [accountResponse, postsResponse] = await Promise.all([
          getAccount(accountId),
          getAccountPosts(accountId),
        ]);
        const mappedAccount = mapApiAccountToAccount(accountResponse);

        if (isMounted) {
          setApiAccount(mappedAccount);
          setApiAccountPosts(
            postsResponse.map((post) => ({
              account: mappedAccount,
              post: mapApiPostToPost(post, post.assets),
            })),
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setApiAccount(undefined);
          setApiAccountPosts([]);
          setError(getProfileErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAccountProfile();

    return () => {
      isMounted = false;
    };
  }, [accountId]);

  const mockAccount = accounts.find((accountItem) => accountItem.id === accountId);
  const account = isApiDataSource ? apiAccount : mockAccount;

  if (isLoading) {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
        Loading API account...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
        <Link className="block text-sm font-semibold text-neutral-950" to="/accounts">
          Browse Accounts
        </Link>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Account not found"
          description={
            accountId
              ? `We could not find an account for ${accountId}.`
              : 'Choose an account from Explore.'
          }
        />
        <Link className="block text-sm font-semibold text-neutral-950" to="/accounts">
          Browse Accounts
        </Link>
      </div>
    );
  }

  const accountPosts = isApiDataSource
    ? apiAccountPosts
    : getPostsByAccountId(posts, account.id)
        .map((post) => joinPostWithAccount(post, accounts))
        .filter((feedItem) => feedItem !== undefined);
  const following = isApiDataSource
    ? apiFollows.isFollowing(account.id)
    : isMockFollowing(account.id);
  const isOwnApiAccount =
    isApiDataSource && getAccountUserId(account) === activeApiUserId;
  const isDeactivated = isApiDataSource && isAccountDeactivated(account);
  const isPendingApiAccount = apiFollows.pendingAccountId === account.id;
  const isApiFollowDisabled =
    apiFollows.isLoading ||
    apiFollows.isMutating ||
    isOwnApiAccount ||
    isDeactivated;
  const latestPost = accountPosts[0]?.post;
  const latestPostDate = latestPost
    ? formatDateTime(latestPost.createdAt)
    : 'No posts yet';

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase text-neutral-400">
            Data source: {isApiDataSource ? 'API' : 'Mock'}
          </p>
          {isApiDataSource ? (
            <p className="text-right text-xs font-semibold text-neutral-500">
              Follow changes sync to API
            </p>
          ) : null}
        </div>

        <div className="flex items-start gap-4">
          <AccountAvatar account={account} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
                {account.displayName}
              </h1>
              {isDeactivated ? (
                <span className="shrink-0 rounded bg-neutral-200 px-2 py-0.5 text-xs font-bold text-neutral-600">
                  Deactivated
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm text-neutral-500">@{account.handle}</p>
            {account.bio ? (
              <p className="mt-3 text-sm leading-6 text-neutral-600">{account.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SummaryItem label="Posts" value={String(accountPosts.length)} />
          <SummaryItem label="Latest" value={latestPostDate} />
          <SummaryItem
            label="Follow"
            value={
              isOwnApiAccount
                ? 'This is your account'
                : following
                ? 'Following'
                : 'Not following'
            }
          />
          <SummaryItem label="Handle" value={`@${account.handle}`} />
        </div>

        {isApiDataSource && apiFollows.error ? (
          <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
            {apiFollows.error}
          </p>
        ) : null}

        {isOwnApiAccount ? (
          <Link
            to="/posts/new"
            className="flex h-11 w-full items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            New Post
          </Link>
        ) : (
          <button
            type="button"
            className={[
              'w-full rounded-md px-4 py-2.5 text-sm font-bold transition-colors',
              isApiDataSource && isApiFollowDisabled
                ? 'cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400'
                : following
                ? 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                : 'bg-neutral-950 text-white hover:bg-neutral-800',
            ].join(' ')}
            disabled={isApiDataSource && isApiFollowDisabled}
            onClick={() => {
              if (isApiDataSource) {
                void apiFollows.toggleFollow(account.id);
                return;
              }

              toggleMockFollow(account.id);
            }}
          >
            {apiFollows.isLoading
              ? 'Loading...'
              : isPendingApiAccount
              ? 'Saving...'
              : following
              ? 'Unfollow'
              : 'Follow'}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">Posts</h2>
          <span className="text-xs font-medium text-neutral-400">
            Latest first
          </span>
        </div>

        {accountPosts.length > 0 ? (
          <div className="space-y-3.5">
            {accountPosts.map((item) => (
              <FeedCard key={item.post.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No posts yet"
            description={
              isApiDataSource
                ? isOwnApiAccount
                  ? 'Create a post and it will appear here.'
                  : 'Posts from this account will appear here.'
                : 'Posts from this account will appear here.'
            }
          />
        )}
      </section>
    </div>
  );
}
