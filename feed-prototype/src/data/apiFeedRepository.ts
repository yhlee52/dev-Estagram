import { getFeed } from '../api/feedApi';
import type {
  ApiAccount,
  ApiFeedItem,
  ApiFeedResponse,
  ApiMetadata,
  ApiPost,
  ApiPostAsset,
} from '../api/types';
import { getActiveApiUserId } from '../auth/apiActiveUser';
import type {
  FeedRepository,
  GetHomeFeedItemsOptions,
} from './feedRepositoryTypes';
import type {
  Account,
  FeedItem,
  MetadataValue,
  Post,
  PostAsset,
  PostAssetType,
} from '../types/feed';

const supportedAssetTypes: readonly PostAssetType[] = [
  'image',
  'plot',
  'table',
  'file',
  'link',
];

const isPostAssetType = (value: string): value is PostAssetType =>
  supportedAssetTypes.includes(value as PostAssetType);

const getStringArray = (
  metadata: ApiMetadata | null,
  key: string,
): string[] => {
  const value = metadata?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const metadataOrUndefined = (
  metadata: ApiMetadata | null,
): Record<string, MetadataValue> | undefined => metadata ?? undefined;

export const mapApiAccountToAccount = (account: ApiAccount): Account => ({
  id: account.id,
  handle: account.handle,
  displayName: account.display_name,
  avatarUrl: account.avatar_url ?? undefined,
  bio: account.bio ?? undefined,
  kind:
    account.kind === 'person' || account.kind === 'bot' || account.kind === 'team'
      ? account.kind
      : undefined,
  metadata: {
    user_id: account.user_id,
    created_at: account.created_at,
    updated_at: account.updated_at,
  },
});

export const mapApiAssetToPostAsset = (asset: ApiPostAsset): PostAsset => ({
  id: asset.id,
  type: isPostAssetType(asset.type) ? asset.type : 'text',
  title: asset.title ?? undefined,
  description: asset.description ?? undefined,
  src: asset.src,
  url: asset.url ?? asset.src,
  alt: asset.title ?? undefined,
  content: asset.metadata_json?.content,
  sort_order: asset.sort_order,
  metadata: {
    ...(asset.metadata_json ?? {}),
    post_id: asset.post_id,
    mime_type: asset.mime_type,
    sort_order: asset.sort_order,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  },
});

export const mapApiPostToPost = (
  post: ApiPost,
  assets: ApiPostAsset[],
): Post => ({
  id: post.id,
  account_id: post.account_id,
  accountId: post.account_id,
  title: post.title,
  text: post.text,
  caption: post.text,
  created_at: post.created_at,
  createdAt: post.created_at,
  updated_at: post.updated_at,
  updatedAt: post.updated_at,
  imported_at: post.imported_at ?? undefined,
  importedAt: post.imported_at ?? undefined,
  tags: post.tags ?? getStringArray(post.metadata_json, 'tags'),
  assets: assets.map(mapApiAssetToPostAsset),
  metadata_json: metadataOrUndefined(post.metadata_json),
  metadata: {
    ...(post.metadata_json ?? {}),
    ...(post.imported_at ? { imported_at: post.imported_at } : {}),
  },
});

export const mapApiFeedItemToFeedItem = (item: ApiFeedItem): FeedItem => ({
  account: mapApiAccountToAccount(item.account),
  post: mapApiPostToPost(item.post, item.assets),
});

export const mapApiFeedResponseToFeedItems = (
  response: ApiFeedResponse,
): FeedItem[] => response.items.map(mapApiFeedItemToFeedItem);

export const apiFeedRepository: FeedRepository = {
  async getHomeFeedItems(options: GetHomeFeedItemsOptions = {}) {
    const userId = options.activeUserId ?? getActiveApiUserId();

    if (!userId) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const response = await getFeed(userId, options.filters, {
      cursor: options.cursor,
      limit: options.limit,
    });

    return {
      items: mapApiFeedResponseToFeedItems(response),
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    };
  },
};
