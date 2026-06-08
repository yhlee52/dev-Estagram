import { isApiMode } from '../config/dataSource';
import { apiFeedRepository } from './apiFeedRepository';
import type {
  FeedRepository,
  FeedScope,
  GetHomeFeedItemsOptions,
} from './feedRepositoryTypes';
import { mockFeedRepository } from './mockFeedRepository';

export const getFeedRepository = (): FeedRepository =>
  isApiMode() ? apiFeedRepository : mockFeedRepository;

export const getHomeFeedItems = (
  options?: GetHomeFeedItemsOptions,
) => getFeedRepository().getHomeFeedItems(options);

export type { FeedRepository, FeedScope, GetHomeFeedItemsOptions };
