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
          description={accountId ? `No account exists for ${accountId}.` : undefined}
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
    <div className="space-y-5">
      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xl font-semibold text-neutral-600">
            {account.displayName.trim().charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-neutral-950">
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
            'mt-4 w-full rounded-md px-4 py-2 text-sm font-semibold',
            following
              ? 'border border-neutral-200 bg-white text-neutral-700'
              : 'bg-neutral-950 text-white',
          ].join(' ')}
          onClick={() => toggleFollow(account.id)}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </section>

      {accountPosts.length > 0 ? (
        <div className="space-y-4">
          {accountPosts.map((item) => (
            <FeedCard key={item.post.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No posts yet"
          description="This account has not published any posts."
        />
      )}
    </div>
  );
}
