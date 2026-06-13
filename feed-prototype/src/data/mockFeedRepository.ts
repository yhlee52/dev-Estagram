import postsData from './posts.json';
import type { FeedRepository, GetHomeFeedItemsOptions } from './feedRepositoryTypes';
import type { Post } from '../types/feed';
import {
  getEffectiveAccounts,
  readFollowingByUserOverlay,
} from '../utils/localData';
import { getFeedItems, getFollowedFeedItems } from '../utils/feed';

const posts = postsData as unknown as Post[];

export const mockFeedRepository: FeedRepository = {
  async getHomeFeedItems(options: GetHomeFeedItemsOptions = {}) {
    const scope = options.scope ?? 'following';
    const accounts = getEffectiveAccounts();

    // Mock mode is not paginated: return the full set with no further pages.
    if (scope === 'all') {
      return { items: getFeedItems(posts, accounts), nextCursor: null, hasMore: false };
    }

    const followingByUser = readFollowingByUserOverlay();
    const followingIds = options.activeUserId
      ? followingByUser[options.activeUserId] ?? []
      : [];

    return {
      items: getFollowedFeedItems(posts, accounts, followingIds),
      nextCursor: null,
      hasMore: false,
    };
  },
};
