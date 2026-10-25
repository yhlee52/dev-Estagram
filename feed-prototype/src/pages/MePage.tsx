import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { changePassword } from '../api/authApi';
import { ApiClientError, ApiNetworkError } from '../api/client';
import {
  deactivateAccount,
  getAccountPosts,
  getAccounts,
  updateAccountProfile,
} from '../api/accountsApi';
import { getUser } from '../api/usersApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import MeBookmarksSection from '../components/MeBookmarksSection';
import MeMentionsSection from '../components/MeMentionsSection';
import MyPostCard from '../components/MyPostCard';
import postsData from '../data/posts.json';
import {
  mapApiAccountToAccount,
  mapApiPostToPost,
} from '../data/apiFeedRepository';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import { useActiveUser } from '../hooks/useActiveUser';
import { useApiFollows } from '../hooks/useApiFollows';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, FeedItem, Post, User } from '../types/feed';
import {
  buildAccountActivity,
  getAccountActivity,
  RECENT_ACTIVITY_DAYS,
  type AccountActivity,
} from '../utils/accountActivity';
import { getPostsByAccountId, joinPostWithAccount } from '../utils/feed';
import { formatRelativeTime } from '../utils/format';
import ApiProfilePage from './ApiProfilePage';

const posts = postsData as unknown as Post[];

// How many of my posts to render at once before requiring "Load more" (v0.3.4).
// The activity summary still reflects every post; only the rendered card list is
// windowed so a large history does not mount hundreds of cards at once.
const MY_POSTS_PAGE_SIZE = 20;

function Avatar({ src, name }: { src?: string; name: string }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || 'U';

  if (!src || hasImageError) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xl font-bold text-neutral-600 ring-1 ring-neutral-200">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className="size-16 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
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

/** Total / recent-window / last-active signals for the user's own posts. */
function getMyActivity(myPosts: Post[], accountId: string): AccountActivity {
  const activityById = buildAccountActivity(
    myPosts.map((post) => ({ accountId, createdAt: post.createdAt })),
  );

  return getAccountActivity(activityById, accountId);
}

function ActivitySummary({ activity }: { activity: AccountActivity }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SummaryItem label="게시글" value={String(activity.postCount)} />
      <SummaryItem
        label={`최근 ${RECENT_ACTIVITY_DAYS}일`}
        value={String(activity.recentPostCount)}
      />
      <SummaryItem
        label="최근 활동"
        value={
          activity.lastActiveAt ? formatRelativeTime(activity.lastActiveAt) : '--'
        }
      />
    </div>
  );
}

function getProfileErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다. 서버 상태를 확인해 주세요.`;
  }

  if (error instanceof ApiClientError && error.status === 404) {
    return '계정을 찾지 못했습니다. 다시 로그인해 주세요.';
  }

  return '프로필을 불러오지 못했습니다.';
}

function getProfileSaveErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return '내 프로필만 수정할 수 있습니다.';
    }

    return `프로필을 저장하지 못했습니다. (${error.status})`;
  }

  return '프로필을 저장하지 못했습니다.';
}

function getPasswordChangeErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다.`;
  }

  if (error instanceof ApiClientError) {
    return error.status === 400 ? '현재 비밀번호를 확인해 주세요.' : `비밀번호를 변경하지 못했습니다. (${error.status})`;
  }

  return '비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.';
}

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

function getDeactivateErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return '내 계정만 비활성화할 수 있습니다.';
    }

    return `계정을 비활성화하지 못했습니다. (${error.status})`;
  }

  return '계정을 비활성화하지 못했습니다. 다시 시도해 주세요.';
}

export function DeactivateAccountPanel({
  account,
  onDeactivated,
}: {
  account: Account;
  onDeactivated: () => void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setIsDeactivating(true);
    setError('');

    try {
      await deactivateAccount(account.id);
      // Server has revoked our session; sign out so the login gate takes over.
      onDeactivated();
    } catch (deactivateError) {
      setError(getDeactivateErrorMessage(deactivateError));
      setIsDeactivating(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-red-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-red-700">계정 비활성화</h2>
        <p className="text-xs font-semibold leading-5 text-neutral-500">
          비활성화하면 다른 사람이 계정을 찾을 수 없고 즉시 로그아웃됩니다.
          게시글은 보존되며 다시 로그인하려면 운영자가 계정을 재활성화해야 합니다.
        </p>
      </div>

      <button
        type="button"
        className="h-10 rounded-md border border-red-300 bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isDeactivating}
        onClick={() => setIsConfirmOpen(true)}
      >
        계정 비활성화
      </button>

      {error ? (
        <p className="text-xs font-semibold text-red-700">{error}</p>
      ) : null}

      {isConfirmOpen ? (
        <ConfirmDialog
          title="계정을 비활성화할까요?"
          description="계정이 검색에서 숨겨지고 즉시 로그아웃됩니다. 게시글은 보존되며 재활성화에는 운영자가 필요합니다."
          confirmLabel="비활성화"
          danger
          isConfirming={isDeactivating}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      ) : null}
    </section>
  );
}

function NewPostButton({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  if (size === 'sm') {
    return (
      <Link
        to="/posts/new"
        className="h-8 shrink-0 rounded-md bg-neutral-950 px-3 py-2 text-xs font-bold leading-4 text-white shadow-sm transition hover:bg-neutral-800"
      >
        New Post
      </Link>
    );
  }

  return (
    <Link
      to="/posts/new"
      className="flex h-11 w-full items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
    >
      New Post
    </Link>
  );
}

function AccountProfileEditor({
  account,
  onUpdated,
}: {
  account: Account;
  onUpdated: (account: Account) => void;
}) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [bio, setBio] = useState(account.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(account.displayName);
    setBio(account.bio ?? '');
    setAvatarUrl(account.avatarUrl ?? '');
    setMessage('');
    setError('');
  }, [account.id, account.displayName, account.bio, account.avatarUrl]);

  const trimmedDisplayName = displayName.trim();
  const hasChanges =
    trimmedDisplayName !== account.displayName ||
    bio.trim() !== (account.bio ?? '') ||
    avatarUrl.trim() !== (account.avatarUrl ?? '');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !trimmedDisplayName || !hasChanges) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const updated = await updateAccountProfile(account.id, {
        display_name: trimmedDisplayName,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      onUpdated(mapApiAccountToAccount(updated));
      setMessage('Profile saved.');
    } catch (saveError) {
      setError(getProfileSaveErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-neutral-950">계정 프로필</h2>
          <p className="truncate text-xs font-semibold text-neutral-500">
            @{account.handle}
          </p>
        </div>
        <Avatar
          src={avatarUrl.trim() || account.avatarUrl}
          name={trimmedDisplayName || account.displayName}
        />
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-neutral-400">
            Display name
          </span>
          <input
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-900 outline-none transition focus:border-neutral-400"
            value={displayName}
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-neutral-400">소개</span>
          <textarea
            className="min-h-24 w-full resize-y rounded-md border border-neutral-200 px-3 py-2 text-sm leading-6 text-neutral-900 outline-none transition focus:border-neutral-400"
            value={bio}
            maxLength={500}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-neutral-400">
            Avatar URL
          </span>
          <input
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
            value={avatarUrl}
            maxLength={1000}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="min-h-5 text-xs font-semibold text-neutral-500">
            {message || error}
          </p>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={isSaving || !trimmedDisplayName || !hasChanges}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function PasswordChangePanel() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setMessage('');
    setError('');

    if (newPassword.length < 4) {
      setError('새 비밀번호는 4자 이상 입력하세요.');
      return;
    }

    setIsSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('비밀번호를 변경했습니다.');
    } catch (changeError) {
      setError(getPasswordChangeErrorMessage(changeError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-neutral-950">비밀번호</h2>
        <p className="text-xs font-semibold leading-5 text-neutral-500">
          로그인에 사용할 비밀번호를 변경합니다.
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-neutral-400">
            현재 비밀번호
          </span>
          <input
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
            value={currentPassword}
            type="password"
            autoComplete="current-password"
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setError('');
              setMessage('');
            }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-neutral-400">
            새 비밀번호
          </span>
          <input
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
            value={newPassword}
            type="password"
            autoComplete="new-password"
            onChange={(event) => {
              setNewPassword(event.target.value);
              setError('');
              setMessage('');
            }}
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="min-h-5 text-xs font-semibold text-neutral-500">
            {message || error}
          </p>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={isSaving || !currentPassword || !newPassword}
          >
            {isSaving ? '저장하는 중...' : '비밀번호 변경'}
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * API mode (v0.2.3): the Me tab loads the active API user's own account and
 * posts so it is no longer empty in API mode, and adds inline post management
 * (New Post, per-post Edit / Delete).
 */
export function ApiMePage() {
  const { activeApiUserId, activeApiUser, clearActiveApiUser } =
    useActiveApiUser();
  const apiFollows = useApiFollows(activeApiUserId);
  const [user, setUser] = useState<User | undefined>();
  const [account, setAccount] = useState<Account | undefined>();
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [myPosts, setMyPosts] = useState<FeedItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(MY_POSTS_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeApiUserId) {
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setError('');
      setVisibleCount(MY_POSTS_PAGE_SIZE);

      try {
        const [apiUser, accounts] = await Promise.all([
          getUser(activeApiUserId),
          getAccounts(),
        ]);
        const mappedAccounts = accounts.map(mapApiAccountToAccount);
        if (isMounted) {
          setAllAccounts(mappedAccounts);
        }
        const myApiAccount = mappedAccounts.find(
          (candidate) => getAccountUserId(candidate) === activeApiUserId,
        );

        if (!myApiAccount) {
          if (isMounted) {
            setUser({
              id: apiUser.id,
              handle: apiUser.handle,
              display_name: apiUser.display_name,
              avatar: apiUser.avatar_url ?? undefined,
              bio: apiUser.bio ?? undefined,
            });
            setAccount(undefined);
            setMyPosts([]);
          }
          return;
        }

        const accountPosts = await getAccountPosts(myApiAccount.id);

        if (isMounted) {
          setUser({
            id: apiUser.id,
            handle: apiUser.handle,
            display_name: apiUser.display_name,
            avatar: apiUser.avatar_url ?? undefined,
            bio: apiUser.bio ?? undefined,
            account_id: myApiAccount.id,
          });
          setAccount(myApiAccount);
          setMyPosts(
            accountPosts.map((post) => ({
              account: myApiAccount,
              post: mapApiPostToPost(post, post.assets),
            })),
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setUser(undefined);
          setAccount(undefined);
          setMyPosts([]);
          setError(getProfileErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [activeApiUserId]);

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="Select an API user"
        description="Choose a backend seed user from the header to see your profile and posts."
      />
    );
  }

  if (isLoading) {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
        Loading your profile...
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

  const handle = account?.handle ?? user?.handle ?? activeApiUser?.handle ?? '';
  const displayName = account?.displayName ?? user?.display_name ?? handle;
  const bio = account?.bio ?? user?.bio;
  const activity = account
    ? getMyActivity(
        myPosts.map((item) => item.post),
        account.id,
      )
    : { postCount: 0, recentPostCount: 0, lastActiveAt: null };

  const followingIdSet = new Set(apiFollows.followingIds);
  const followedAccounts = allAccounts.filter((candidate) =>
    followingIdSet.has(candidate.id),
  );

  const handlePostDeleted = (postId: string) => {
    setMyPosts((current) => current.filter((item) => item.post.id !== postId));
  };

  const handleAccountUpdated = (updatedAccount: Account) => {
    setAccount(updatedAccount);
    setAllAccounts((current) =>
      current.map((candidate) =>
        candidate.id === updatedAccount.id ? updatedAccount : candidate,
      ),
    );
    setMyPosts((current) =>
      current.map((item) =>
        item.account.id === updatedAccount.id
          ? { ...item, account: updatedAccount }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase text-neutral-400">
            Data source: API
          </p>
          <p className="text-right text-xs font-semibold text-neutral-500">
            Your account
          </p>
        </div>

        <div className="flex items-start gap-4">
          <Avatar src={account?.avatarUrl} name={displayName} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
              {displayName}
            </h1>
            <p className="truncate text-sm text-neutral-500">@{handle}</p>
            {bio ? (
              <p className="mt-3 text-sm leading-6 text-neutral-600">{bio}</p>
            ) : null}
          </div>
        </div>

        <ActivitySummary activity={activity} />

        <div className="grid grid-cols-2 gap-2">
          <SummaryItem
            label="Following"
            value={apiFollows.isLoading ? '...' : String(apiFollows.followingIds.length)}
          />
          <SummaryItem
            label="Account"
            value={account ? `@${account.handle}` : 'Not linked'}
          />
        </div>

        {account ? <NewPostButton /> : null}
      </section>

      {account ? (
        <AccountProfileEditor
          account={account}
          onUpdated={handleAccountUpdated}
        />
      ) : null}

      {account ? <PasswordChangePanel /> : null}

      {account ? (
        <DeactivateAccountPanel
          account={account}
          onDeactivated={clearActiveApiUser}
        />
      ) : null}

      {account ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-sm font-bold text-neutral-950">내 게시글</h2>
            <NewPostButton size="sm" />
          </div>

          {myPosts.length > 0 ? (
            <div className="space-y-3.5">
              {myPosts.slice(0, visibleCount).map((item) => (
                <MyPostCard
                  key={item.post.id}
                  item={item}
                  onDeleted={handlePostDeleted}
                />
              ))}

              {myPosts.length > visibleCount ? (
                <button
                  type="button"
                  className="h-10 w-full rounded-md border border-neutral-200 bg-white text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
                  onClick={() =>
                    setVisibleCount((current) => current + MY_POSTS_PAGE_SIZE)
                  }
                >
                  Load more ({myPosts.length - visibleCount} left)
                </button>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No posts yet"
              description="Create your first post and it will appear here."
              action={<NewPostButton size="sm" />}
            />
          )}
        </section>
      ) : (
        <EmptyState
          title="No connected account"
          description="This API user does not have an account in the backend database yet."
        />
      )}

      {account ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-sm font-bold text-neutral-950">팔로잉</h2>
            <span className="text-xs font-medium text-neutral-400">
              {followedAccounts.length} account
              {followedAccounts.length === 1 ? '' : 's'}
            </span>
          </div>

          {followedAccounts.length > 0 ? (
            <ul className="space-y-2">
              {followedAccounts.map((followed) => (
                <li key={followed.id}>
                  <Link
                    to={`/accounts/${followed.id}`}
                    className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300"
                  >
                    {followed.avatarUrl ? (
                      <img
                        src={followed.avatarUrl}
                        alt=""
                        className="size-9 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600">
                        {followed.displayName.trim().charAt(0).toUpperCase() ||
                          'A'}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-neutral-950">
                        {followed.displayName}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        @{followed.handle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Not following anyone yet"
              description="Follow accounts to see them here and in your home feed."
            />
          )}
        </section>
      ) : null}

      {account ? <MeMentionsSection userId={activeApiUserId} /> : null}

      {account ? <MeBookmarksSection userId={activeApiUserId} /> : null}
    </div>
  );
}

/**
 * Mock mode: the existing read-only profile + connected account + my posts,
 * now with an activity summary. Create / edit / delete stay API-only.
 */
function MockMePage() {
  const { activeUser } = useActiveUser();
  const accounts = useEffectiveAccounts();
  const { followingIds } = useFollowState();

  if (!activeUser) {
    return (
      <EmptyState
        title="선택된 사용자가 없습니다"
        description="메뉴에서 사용자를 선택해 주세요."
      />
    );
  }

  const connectedAccount = activeUser.account_id
    ? accounts.find((account) => account.id === activeUser.account_id)
    : undefined;
  const userPosts = connectedAccount
    ? getPostsByAccountId(posts, connectedAccount.id)
        .map((post) => joinPostWithAccount(post, accounts))
        .filter((feedItem): feedItem is FeedItem => feedItem !== undefined)
    : [];
  const activity = connectedAccount
    ? getMyActivity(
        userPosts.map((item) => item.post),
        connectedAccount.id,
      )
    : { postCount: 0, recentPostCount: 0, lastActiveAt: null };

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <Avatar src={activeUser.avatar} name={activeUser.display_name} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
              {activeUser.display_name}
            </h1>
            <p className="truncate text-sm text-neutral-500">@{activeUser.handle}</p>
            {activeUser.bio ? (
              <p className="mt-3 text-sm leading-6 text-neutral-600">{activeUser.bio}</p>
            ) : null}
          </div>
        </div>

        {connectedAccount ? <ActivitySummary activity={activity} /> : null}

        <div className="grid grid-cols-2 gap-2">
          <SummaryItem label="팔로잉" value={String(followingIds.length)} />
          <SummaryItem
            label="계정"
            value={connectedAccount ? `@${connectedAccount.handle}` : '연결되지 않음'}
          />
        </div>

        <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs font-semibold leading-5 text-neutral-500">
          데모 모드에서는 게시글을 읽을 수 있습니다. 작성·수정·삭제는 API 모드에서 사용할 수 있습니다.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">연결된 계정</h2>
        </div>

        {connectedAccount ? (
          <Link
            to={`/accounts/${connectedAccount.id}`}
            className="block rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
          >
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-neutral-950">
                {connectedAccount.displayName}
              </h3>
              <p className="truncate text-xs text-neutral-500">
                @{connectedAccount.handle}
              </p>
              {connectedAccount.bio ? (
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {connectedAccount.bio}
                </p>
              ) : null}
            </div>
          </Link>
        ) : (
          <EmptyState
            title="연결된 계정이 없습니다"
            description="이 사용자에게 연결된 계정이 없습니다."
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">내 게시글</h2>
          <span className="text-xs font-medium text-neutral-400">최신순</span>
        </div>

        {connectedAccount && userPosts.length > 0 ? (
          <div className="space-y-3.5">
            {userPosts.map((item) => (
              <FeedCard key={item.post.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="게시글이 없습니다"
            description={
              connectedAccount
                ? '연결된 계정의 게시글이 여기에 표시됩니다.'
                : '계정을 연결하면 게시글을 볼 수 있습니다.'
            }
          />
        )}
      </section>
    </div>
  );
}

export default function MePage() {
  return isApiMode() ? <ApiProfilePage /> : <MockMePage />;
}
