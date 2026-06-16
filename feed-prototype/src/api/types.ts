import type { MetadataValue } from "../types/feed";

export type ApiMetadata = Record<string, MetadataValue>;
export type ApiAssetType = "image" | "plot" | "table" | "file" | "link";

export interface ApiUser {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiUserCreatePayload {
  handle: string;
  display_name?: string | null;
  bio?: string | null;
}

export interface ApiAccount {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  kind: string;
  created_at: string;
  updated_at: string;
}

export interface ApiUserRegistrationResponse {
  user: ApiUser;
  account: ApiAccount;
}

export interface ApiPostAsset {
  id: string;
  post_id: string;
  type: string;
  title: string | null;
  description: string | null;
  url?: string | null;
  src: string;
  mime_type: string | null;
  sort_order: number | null;
  metadata_json: ApiMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface ApiPost {
  id: string;
  account_id: string;
  title: string;
  text: string;
  tags?: string[];
  metadata_json: ApiMetadata | null;
  imported_at?: string | null;
  created_at: string;
  updated_at: string;
  // Derived count of comments on this post (v0.5.0); absent on mock/legacy data.
  comment_count?: number;
}

export interface ApiPostAssetPayload {
  type: ApiAssetType;
  url: string;
  title?: string | null;
  description?: string | null;
  sort_order?: number | null;
}

export interface ApiPostCreatePayload {
  user_id: string;
  title: string;
  text: string;
  tags?: string[];
  metadata_json?: ApiMetadata | null;
  assets?: ApiPostAssetPayload[];
}

export interface ApiPostUpdatePayload {
  user_id: string;
  title?: string;
  text?: string;
  tags?: string[];
  metadata_json?: ApiMetadata | null;
  assets?: ApiPostAssetPayload[];
}

export interface ApiPostWithAssets extends ApiPost {
  assets: ApiPostAsset[];
}

export interface ApiPaginatedPosts {
  items: ApiPostWithAssets[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiFeedItem {
  post: ApiPost;
  account: ApiAccount;
  assets: ApiPostAsset[];
}

export interface ApiFeedResponse {
  user: ApiUser;
  items: ApiFeedItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiTagCount {
  tag: string;
  count: number;
}

export interface ApiTagListResponse {
  items: ApiTagCount[];
}

export interface ApiMetadataKeyCount {
  key: string;
  count: number;
}

export interface ApiMetadataKeyListResponse {
  items: ApiMetadataKeyCount[];
}

export interface ApiMetadataValueCount {
  value: string;
  count: number;
}

export interface ApiMetadataValueListResponse {
  key: string;
  items: ApiMetadataValueCount[];
}

export interface ApiImportBatchSummary {
  id: string;
  external_id: string;
  source: string | null;
  batch_created_at: string | null;
  status: string;
  error_message: string | null;
  first_imported_at: string;
  last_imported_at: string;
  import_count: number;
  accounts_created: number;
  accounts_updated: number;
  users_created: number;
  users_updated: number;
  posts_created: number;
  posts_updated: number;
  posts_skipped: number;
  asset_replace_target_posts: number;
  assets_deleted: number;
  assets_created: number;
  errors: number;
  post_count: number;
}

export interface ApiImportBatchListResponse {
  items: ApiImportBatchSummary[];
}

export interface ApiImportBatchPost {
  id: string;
  external_id: string | null;
  title: string;
  account_id: string;
  account_handle: string | null;
  account_display_name: string | null;
  created_at: string;
  imported_at: string | null;
}

export interface ApiImportBatchDetailResponse {
  batch: ApiImportBatchSummary;
  posts: ApiImportBatchPost[];
}

export interface ApiComment {
  id: string;
  post_id: string;
  author_user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface ApiCommentWithAuthor {
  comment: ApiComment;
  author: ApiAccount;
}

export interface ApiCommentListResponse {
  items: ApiCommentWithAuthor[];
}

export interface ApiCommentCreatePayload {
  user_id: string;
  text: string;
}

export type ApiCommentUpdatePayload = ApiCommentCreatePayload;

export interface ApiBookmark {
  id: string;
  user_id: string;
  post_id: string;
  note: string | null;
  created_at: string;
}

export interface ApiBookmarkNoteBody {
  note?: string | null;
}

export interface ApiBookmarkedPost {
  post: ApiPostWithAssets;
  account: ApiAccount;
  note: string | null;
  bookmarked_at: string;
}

export interface ApiPaginatedBookmarks {
  items: ApiBookmarkedPost[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiUserBookmarkIdsResponse {
  user_id: string;
  post_ids: string[];
}

export type ApiNotificationReason =
  | "followed_post"
  | "own_post_comment"
  | "mention"
  | string;

export interface ApiNotificationItem {
  id: string;
  source_type: "post" | "comment" | string;
  source_id: string;
  reasons: ApiNotificationReason[];
  created_at: string;
  is_read: boolean;
  post: ApiPostWithAssets;
  account: ApiAccount;
  comment: ApiComment | null;
  comment_author: ApiAccount | null;
}

export interface ApiPaginatedNotifications {
  items: ApiNotificationItem[];
  unread_count: number;
  last_read_at: string | null;
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiNotificationReadState {
  user_id: string;
  unread_count: number;
  last_read_at: string | null;
}

export interface ApiFollow {
  id: string;
  follower_user_id: string;
  following_account_id: string;
  created_at: string;
}

export interface ApiFollowWithAccount {
  follow: ApiFollow;
  account: ApiAccount;
}

export interface ApiUserFollowsResponse {
  user_id: string;
  following_account_ids: string[];
  follows: ApiFollowWithAccount[];
}
