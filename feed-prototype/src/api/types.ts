import type { MetadataValue } from "../types/feed";

export type ApiMetadata = Record<string, MetadataValue>;

export interface ApiUser {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
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

export interface ApiPostAsset {
  id: string;
  post_id: string;
  type: string;
  title: string | null;
  description: string | null;
  src: string;
  mime_type: string | null;
  sort_order: number;
  metadata_json: ApiMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface ApiPost {
  id: string;
  account_id: string;
  title: string;
  text: string;
  metadata_json: ApiMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface ApiPostWithAssets extends ApiPost {
  assets: ApiPostAsset[];
}

export interface ApiFeedItem {
  post: ApiPost;
  account: ApiAccount;
  assets: ApiPostAsset[];
}

export interface ApiFeedResponse {
  user: ApiUser;
  items: ApiFeedItem[];
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
