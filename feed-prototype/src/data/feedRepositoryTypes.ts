import type { FeedItem } from '../types/feed';
import type { PostFilters } from '../types/filters';

export type FeedScope = 'following' | 'all';

export interface GetHomeFeedItemsOptions {
  activeUserId?: string;
  scope?: FeedScope;
  filters?: PostFilters;
  cursor?: string;
  limit?: number;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FeedRepository {
  getHomeFeedItems(options?: GetHomeFeedItemsOptions): Promise<FeedPage>;
}
