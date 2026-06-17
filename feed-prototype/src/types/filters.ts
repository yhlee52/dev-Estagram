export type PostAssetFilterType = 'image' | 'plot' | 'table' | 'file' | 'link' | '';

export type PostSort = 'newest' | 'oldest' | 'metadata_asc' | 'metadata_desc';

/**
 * How a metadata value filter is matched. `contains` (default) keeps the v0.1.x
 * free-input ILIKE substring behavior; `exact` is set when the value was picked
 * from a facet, since facet values come straight from the data (v0.4.0).
 */
export type MetadataMatch = 'contains' | 'exact';

export type PostFilters = {
  keyword?: string;
  tag?: string;
  metadataKey?: string;
  metadataValue?: string;
  metadataMatch?: MetadataMatch;
  assetType?: PostAssetFilterType;
  accountId?: string | number;
  accountHandle?: string;
  myPostsOnly?: boolean;
  bookmarkedOnly?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  sort?: PostSort;
  /** Required when sort is metadata_asc/metadata_desc: the metadata key to sort by. */
  sortMetadataKey?: string;
};
