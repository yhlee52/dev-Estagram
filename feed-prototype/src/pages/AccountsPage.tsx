import EmptyState from '../components/EmptyState';
import AccountCard from '../components/AccountCard';
import accountsData from '../data/accounts.json';
import postsData from '../data/posts.json';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, Post } from '../types/feed';

const accounts = accountsData as unknown as Account[];
const posts = postsData as unknown as Post[];

const postCountByAccountId = posts.reduce<Record<string, number>>((counts, post) => {
  counts[post.accountId] = (counts[post.accountId] ?? 0) + 1;
  return counts;
}, {});

export default function AccountsPage() {
  const { isFollowing, toggleFollow } = useFollowState();

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No accounts yet"
        description="Accounts will appear here when static data is available."
      />
    );
  }

  return (
    <div className="space-y-4">
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
