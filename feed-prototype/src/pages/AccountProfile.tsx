import { Link, useParams } from 'react-router';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import accountsData from '../data/accounts.json';
import postsData from '../data/posts.json';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, Post } from '../types/feed';
import { getPostsByAccountId, joinPostWithAccount } from '../utils/feed';

const accounts = accountsData as unknown as Account[];
const posts = postsData as unknown as Post[];

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

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xl font-bold text-neutral-600 ring-1 ring-neutral-200">
            {account.displayName.trim().charAt(0).toUpperCase() || 'A'}
          </div>
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

        <button
          type="button"
          className={[
            'mt-4 w-full rounded-md px-4 py-2.5 text-sm font-bold transition-colors',
            following
              ? 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              : 'bg-neutral-950 text-white hover:bg-neutral-800',
          ].join(' ')}
          onClick={() => toggleFollow(account.id)}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </section>

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
    </div>
  );
}
