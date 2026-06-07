import { useState } from 'react';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import postsData from '../data/posts.json';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import type { Post } from '../types/feed';
import { getFeedItems, getFollowedFeedItems } from '../utils/feed';

const posts = postsData as unknown as Post[];
type FeedScope = 'following' | 'all';

const feedScopeOptions: Array<{
  value: FeedScope;
  label: string;
}> = [
  { value: 'following', label: 'Following' },
  { value: 'all', label: 'All' },
];

export default function HomeFeed() {
  const [feedScope, setFeedScope] = useState<FeedScope>('following');
  const accounts = useEffectiveAccounts();
  const { followingIds } = useFollowState();
  const followingFeedItems = getFollowedFeedItems(posts, accounts, followingIds);
  const allFeedItems = getFeedItems(posts, accounts);
  const feedItems = feedScope === 'following' ? followingFeedItems : allFeedItems;

  const emptyState =
    feedScope === 'following' ? (
      <EmptyState
        title="Your feed is empty"
        description="Follow an account from Explore to see its latest posts here."
      />
    ) : (
      <EmptyState
        title="No posts available"
        description="Static post data will appear here once it is added."
      />
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-md border border-neutral-200 bg-neutral-100 p-1">
        {feedScopeOptions.map((option) => {
          const isSelected = feedScope === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setFeedScope(option.value)}
              className={[
                'h-9 rounded text-sm font-semibold transition',
                isSelected
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-950',
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {feedItems.length === 0 ? (
        emptyState
      ) : (
        <div className="space-y-3.5">
          {feedItems.map((item) => (
            <FeedCard key={item.post.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
