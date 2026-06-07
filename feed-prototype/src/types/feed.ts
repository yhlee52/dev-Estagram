export type PostAssetType =
  | "image"
  | "plot"
  | "chart"
  | "table"
  | "html"
  | "json"
  | "text";

export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };

export type PostMetadata = Record<string, MetadataValue>;

export interface Account {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  kind?: "person" | "bot" | "team";
  metadata?: PostMetadata;
}

export interface PostAsset {
  id: string;
  type: PostAssetType;
  title?: string;
  description?: string;
  src?: string;
  url?: string;
  alt?: string;
  content?: MetadataValue;
  metadata?: PostMetadata;
}

export interface Post {
  id: string;
  accountId: string;
  title: string;
  caption?: string;
  createdAt: string;
  tags: string[];
  assets: PostAsset[];
  metadata?: PostMetadata;
}

export interface FollowState {
  accountId: string;
  isFollowing: boolean;
}

export interface FeedItem {
  post: Post;
  account: Account;
}
