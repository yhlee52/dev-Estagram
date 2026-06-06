import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import accountsData from '../data/accounts.json';
import postsData from '../data/posts.json';
import { useFollowState } from '../hooks/useFollowState';
import type { Account, Post } from '../types/feed';
import { getFollowedFeedItems } from '../utils/feed';

const accounts = accountsData as unknown as Account[];
const posts = postsData as unknown as Post[];

export default function HomeFeed() {
  const { followingIds } = useFollowState();
  const follows = followingIds.map((accountId) => ({
    accountId,
    isFollowing: true,
  }));
  const feedItems = getFollowedFeedItems(posts, accounts, follows);

  if (feedItems.length === 0) {
    return (
      <EmptyState
        title="No posts yet"
        description="Followed account posts will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {feedItems.map((item) => (
        <FeedCard key={item.post.id} item={item} />
      ))}
    </div>
  );
}
