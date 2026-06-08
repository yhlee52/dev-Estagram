import type { FeedItem } from '../types/feed';

export type FeedScope = 'following' | 'all';

export interface GetHomeFeedItemsOptions {
  activeUserId?: string;
  scope?: FeedScope;
}

export interface FeedRepository {
  getHomeFeedItems(options?: GetHomeFeedItemsOptions): Promise<FeedItem[]>;
}
