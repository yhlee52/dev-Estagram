import { useState } from 'react';
import { Link } from 'react-router';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import postsData from '../data/posts.json';
import { useActiveUser } from '../hooks/useActiveUser';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, Post, User } from '../types/feed';
import { getPostsByAccountId, joinPostWithAccount } from '../utils/feed';

const posts = postsData as unknown as Post[];

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

function UserSummary({
  user,
  account,
  followingCount,
}: {
  user: User;
  account?: Account;
  followingCount: number;
}) {
  return (
    <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <Avatar src={user.avatar} name={user.display_name} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
            {user.display_name}
          </h1>
          <p className="truncate text-sm text-neutral-500">@{user.handle}</p>
          {user.bio ? (
            <p className="mt-3 text-sm leading-6 text-neutral-600">{user.bio}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SummaryItem label="Following" value={String(followingCount)} />
        <SummaryItem label="Account" value={account ? `@${account.handle}` : 'Not linked'} />
      </div>
    </section>
  );
}

function ConnectedAccount({ account }: { account: Account }) {
  return (
    <Link
      to={`/accounts/${account.id}`}
      className="block rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-bold text-neutral-950">
          {account.displayName}
        </h2>
        <p className="truncate text-xs text-neutral-500">@{account.handle}</p>
        {account.bio ? (
          <p className="mt-2 text-sm leading-6 text-neutral-600">{account.bio}</p>
        ) : null}
      </div>
    </Link>
  );
}

export default function MePage() {
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
        .filter((feedItem) => feedItem !== undefined)
    : [];

  return (
    <div className="space-y-4">
      <UserSummary
        user={activeUser}
        account={connectedAccount}
        followingCount={followingIds.length}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">Connected Account</h2>
        </div>

        {connectedAccount ? (
          <ConnectedAccount account={connectedAccount} />
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
