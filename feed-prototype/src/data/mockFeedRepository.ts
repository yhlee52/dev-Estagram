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

    if (scope === 'all') {
      return getFeedItems(posts, accounts);
    }

    const followingByUser = readFollowingByUserOverlay();
    const followingIds = options.activeUserId
      ? followingByUser[options.activeUserId] ?? []
      : [];

    return getFollowedFeedItems(posts, accounts, followingIds);
  },
};
