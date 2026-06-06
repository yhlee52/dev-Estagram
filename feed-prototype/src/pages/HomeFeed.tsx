import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import accountsData from '../data/accounts.json';
import followsData from '../data/follows.json';
import postsData from '../data/posts.json';
import type { Account, FollowState, Post } from '../types/feed';
import { getFollowedFeedItems } from '../utils/feed';

const accounts = accountsData as unknown as Account[];
const posts = postsData as unknown as Post[];
const follows = followsData as unknown as FollowState[];

export default function HomeFeed() {
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
