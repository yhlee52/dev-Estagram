import { useState } from 'react';
import { Link, useParams } from 'react-router';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import accountsData from '../data/accounts.json';
import postsData from '../data/posts.json';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, Post } from '../types/feed';
import { formatDateTime } from '../utils/format';
import { getPostsByAccountId, joinPostWithAccount } from '../utils/feed';

const accounts = accountsData as unknown as Account[];
const posts = postsData as unknown as Post[];

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

export default function AccountProfile() {
  const { accountId } = useParams();
  const { isFollowing, toggleFollow } = useFollowState();
  const account = accounts.find((accountItem) => accountItem.id === accountId);

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

  const accountPosts = getPostsByAccountId(posts, account.id)
    .map((post) => joinPostWithAccount(post, accounts))
    .filter((feedItem) => feedItem !== undefined);
  const following = isFollowing(account.id);
  const latestPost = accountPosts[0]?.post;
  const latestPostDate = latestPost
    ? formatDateTime(latestPost.createdAt)
    : 'No posts yet';

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <AccountAvatar account={account} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-7 text-neutral-950">
              {account.displayName}
            </h1>
            <p className="truncate text-sm text-neutral-500">@{account.handle}</p>
            {account.bio ? (
              <p className="mt-3 text-sm leading-6 text-neutral-600">{account.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SummaryItem label="Posts" value={String(accountPosts.length)} />
          <SummaryItem label="Latest" value={latestPostDate} />
          <SummaryItem label="Follow" value={following ? 'Following' : 'Not following'} />
          <SummaryItem label="Handle" value={`@${account.handle}`} />
        </div>

        <button
          type="button"
          className={[
            'w-full rounded-md px-4 py-2.5 text-sm font-bold transition-colors',
            following
              ? 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              : 'bg-neutral-950 text-white hover:bg-neutral-800',
          ].join(' ')}
          onClick={() => toggleFollow(account.id)}
        >
          {following ? 'Following' : 'Follow'}
        </button>
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
            description="Posts from this account will appear here."
          />
        )}
      </section>
    </div>
  );
}
