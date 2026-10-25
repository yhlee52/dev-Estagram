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
import ApiProfilePage from './ApiProfilePage';
import { getPostsByAccountId, joinPostWithAccount } from '../utils/feed';

const posts = postsData as unknown as Post[];
const isApiDataSource = getDataSourceMode() === 'api';

function getProfileErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다. 서버를 확인해 주세요.`;
  }

  if (error instanceof ApiClientError && error.status === 404) {
    return '계정을 찾지 못했습니다.';
  }

  return '계정을 불러오지 못했습니다. 다시 시도해 주세요.';
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

function LegacyAccountProfile() {
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
        계정을 불러오는 중...
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
          계정 찾기
        </Link>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="계정을 찾지 못했습니다"
          description={
            accountId
              ? `${accountId} 계정을 찾지 못했습니다.`
              : '탐색에서 계정을 선택해 주세요.'
          }
        />
        <Link className="block text-sm font-semibold text-neutral-950" to="/accounts">
          계정 찾기
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
    : '게시글이 없습니다';

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <AccountAvatar account={account} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
                {account.displayName}
              </h1>
              {isDeactivated ? (
                <span className="shrink-0 rounded bg-neutral-200 px-2 py-0.5 text-xs font-bold text-neutral-600">
                  비활성
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
          <SummaryItem label="게시글" value={String(accountPosts.length)} />
          <SummaryItem label="최근 게시글" value={latestPostDate} />
          <SummaryItem
            label="팔로우"
            value={
              isOwnApiAccount
                ? '내 계정'
                : following
                ? '팔로잉'
                : '팔로우하지 않음'
            }
          />
          <SummaryItem label="아이디" value={`@${account.handle}`} />
        </div>

        {isApiDataSource && apiFollows.error ? (
          <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
            {apiFollows.error}
          </p>
        ) : null}

        {isApiDataSource && !isOwnApiAccount && !isDeactivated ? (
          <Link
            to={`/messages/${account.id}`}
            className="flex h-11 w-full items-center justify-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 transition hover:bg-neutral-100"
          >
            메시지
          </Link>
        ) : null}

        {isOwnApiAccount ? (
          <Link
            to="/posts/new"
            className="flex h-11 w-full items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            새 게시글
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
              ? '불러오는 중...'
              : isPendingApiAccount
              ? '저장하는 중...'
              : following
              ? '팔로우 취소'
              : '팔로우'}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">게시글</h2>
          <span className="text-xs font-medium text-neutral-400">
            최신순
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
            title="게시글이 없습니다"
            description={
              isApiDataSource
                ? isOwnApiAccount
                  ? '게시글을 작성하면 여기에 표시됩니다.'
                  : '이 계정의 게시글이 여기에 표시됩니다.'
                : '이 계정의 게시글이 여기에 표시됩니다.'
            }
          />
        )}
      </section>
    </div>
  );
}

export default function AccountProfile() {
  return isApiDataSource ? <ApiProfilePage /> : <LegacyAccountProfile />;
}
