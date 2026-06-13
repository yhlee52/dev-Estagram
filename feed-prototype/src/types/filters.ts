export type PostAssetFilterType = 'image' | 'plot' | 'table' | 'file' | 'link' | '';

export type PostSort = 'newest' | 'oldest';

export type PostFilters = {
  keyword?: string;
  tag?: string;
  metadataKey?: string;
  metadataValue?: string;
  assetType?: PostAssetFilterType;
  accountId?: string | number;
  accountHandle?: string;
  myPostsOnly?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  sort?: PostSort;
};
