import EmptyState from '../components/EmptyState';
import AccountCard from '../components/AccountCard';
import postsData from '../data/posts.json';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { Post } from '../types/feed';

const posts = postsData as unknown as Post[];

const postCountByAccountId = posts.reduce<Record<string, number>>((counts, post) => {
  counts[post.accountId] = (counts[post.accountId] ?? 0) + 1;
  return counts;
}, {});

export default function AccountsPage() {
  const accounts = useEffectiveAccounts();
  const { isFollowing, toggleFollow } = useFollowState();

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
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          postCount={postCountByAccountId[account.id] ?? 0}
          isFollowing={isFollowing(account.id)}
          onToggleFollow={toggleFollow}
        />
      ))}
    </div>
  );
}
