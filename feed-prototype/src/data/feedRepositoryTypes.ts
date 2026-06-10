import type { FeedItem } from '../types/feed';
import type { PostFilters } from '../types/filters';

export type FeedScope = 'following' | 'all';

export interface GetHomeFeedItemsOptions {
  activeUserId?: string;
  scope?: FeedScope;
  filters?: PostFilters;
}

export interface FeedRepository {
  getHomeFeedItems(options?: GetHomeFeedItemsOptions): Promise<FeedItem[]>;
}
