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
      <SummaryItem label="Posts" value={String(activity.postCount)} />
      <SummaryItem
        label={`Last ${RECENT_ACTIVITY_DAYS}d`}
        value={String(activity.recentPostCount)}
      />
      <SummaryItem
        label="Last active"
        value={
          activity.lastActiveAt ? formatRelativeTime(activity.lastActiveAt) : '--'
        }
      />
    </div>
  );
}

function getProfileErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError && error.status === 404) {
    return 'Your API user or account was not found in the backend database. Switch user and choose a seeded backend user.';
  }

  return 'Could not load your API profile. Check the backend server and try again.';
}

function getProfileSaveErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return 'Only this account user can edit this profile.';
    }

    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not save this profile. Check the backend server and try again.';
}

function getPasswordChangeErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not change this password. Check the backend server and try again.';
}

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

function getDeactivateErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return 'Only this account user can deactivate it.';
    }

    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not deactivate this account. Check the backend server and try again.';
}

function DeactivateAccountPanel({
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
        <h2 className="text-sm font-bold text-red-700">Danger zone</h2>
        <p className="text-xs font-semibold leading-5 text-neutral-500">
          Deactivating hides your account from others and signs you out. Your posts
          are preserved. You will not be able to log back in &mdash; an operator must
          reactivate the account.
        </p>
      </div>

      <button
        type="button"
        className="h-10 rounded-md border border-red-300 bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isDeactivating}
        onClick={() => setIsConfirmOpen(true)}
      >
        Deactivate account
      </button>

      {error ? (
        <p className="text-xs font-semibold text-red-700">{error}</p>
      ) : null}

      {isConfirmOpen ? (
        <ConfirmDialog
          title="Deactivate this account?"
          description="Your account will be hidden from others and you will be signed out. Your posts are preserved. Reactivation requires an operator."
          confirmLabel="Deactivate account"
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
          <h2 className="text-sm font-bold text-neutral-950">Account Profile</h2>
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
          <span className="text-xs font-bold uppercase text-neutral-400">Bio</span>
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

function PasswordChangePanel() {
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
      setError('New password must be at least 4 characters.');
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
      setMessage('Password changed.');
    } catch (changeError) {
      setError(getPasswordChangeErrorMessage(changeError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-neutral-950">Password</h2>
        <p className="text-xs font-semibold leading-5 text-neutral-500">
          Change the password for this API user.
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-neutral-400">
            Current password
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
            New password
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
            {isSaving ? 'Saving...' : 'Change Password'}
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
function ApiMePage() {
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
            <h2 className="text-sm font-bold text-neutral-950">My Posts</h2>
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
            <h2 className="text-sm font-bold text-neutral-950">Following</h2>
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
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600">
                      {followed.displayName.trim().charAt(0).toUpperCase() || 'A'}
                    </span>
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
        title="No active user"
        description="Choose an active user from the header to see this area."
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
          <SummaryItem label="Following" value={String(followingIds.length)} />
          <SummaryItem
            label="Account"
            value={connectedAccount ? `@${connectedAccount.handle}` : 'Not linked'}
          />
        </div>

        <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs font-semibold leading-5 text-neutral-500">
          Mock mode is read-only. Creating, editing, and deleting posts is
          available in API mode.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">Connected Account</h2>
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
            title="No connected account"
            description="This local user does not have a connected account yet."
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">My Posts</h2>
          <span className="text-xs font-medium text-neutral-400">Latest first</span>
        </div>

        {connectedAccount && userPosts.length > 0 ? (
          <div className="space-y-3.5">
            {userPosts.map((item) => (
              <FeedCard key={item.post.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No posts yet"
            description={
              connectedAccount
                ? 'Posts from your connected account will appear here.'
                : 'Connect this user to an account to show personal posts.'
            }
          />
        )}
      </section>
    </div>
  );
}

export default function MePage() {
  return isApiMode() ? <ApiMePage /> : <MockMePage />;
}
