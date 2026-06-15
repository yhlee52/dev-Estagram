import type { PostAssetFilterType, PostFilters, PostSort } from '../types/filters';

const ASSET_FILTER_TYPES: PostAssetFilterType[] = [
  'image',
  'plot',
  'table',
  'file',
  'link',
];

/**
 * Serialize applied post filters into URL query parameters.
 *
 * Parameter names mirror the backend query contract (snake_case) so that links
 * like `/posts?tag=<tag>` (v0.1.1) and shareable filter links stay consistent.
 * Pagination state (cursor/limit) is intentionally not encoded.
 */
export function filtersToSearchParams(filters: PostFilters): URLSearchParams {
  const params = new URLSearchParams();

  const setTrimmed = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) {
      params.set(key, trimmed);
    }
  };

  setTrimmed('keyword', filters.keyword);
  setTrimmed('tag', filters.tag);
  setTrimmed('metadata_key', filters.metadataKey);
  setTrimmed('metadata_value', filters.metadataValue);
  // Only encode exact match (facet-selected); contains is the default so older
  // shareable links without this param keep working.
  if (filters.metadataMatch === 'exact' && filters.metadataValue?.trim()) {
    params.set('metadata_match', 'exact');
  }
  if (filters.assetType) {
    params.set('asset_type', filters.assetType);
  }
  setTrimmed('account_handle', filters.accountHandle);
  if (filters.accountId !== undefined && String(filters.accountId).trim()) {
    params.set('account_id', String(filters.accountId).trim());
  }
  setTrimmed('created_at_from', filters.createdAtFrom);
  setTrimmed('created_at_to', filters.createdAtTo);
  if (filters.sort && filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }
  if (filters.myPostsOnly) {
    params.set('my_posts_only', '1');
  }

  return params;
}

/** Parse URL query parameters back into post filters. */
export function filtersFromSearchParams(params: URLSearchParams): PostFilters {
  const assetTypeRaw = params.get('asset_type') ?? '';
  const assetType = (ASSET_FILTER_TYPES as string[]).includes(assetTypeRaw)
    ? (assetTypeRaw as PostAssetFilterType)
    : '';

  const sort: PostSort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const myPostsOnlyRaw = params.get('my_posts_only');
  const metadataMatch = params.get('metadata_match') === 'exact' ? 'exact' : undefined;

  return {
    keyword: params.get('keyword') ?? '',
    tag: params.get('tag') ?? '',
    metadataKey: params.get('metadata_key') ?? '',
    metadataValue: params.get('metadata_value') ?? '',
    metadataMatch,
    assetType,
    accountHandle: params.get('account_handle') ?? '',
    accountId: params.get('account_id') ?? undefined,
    createdAtFrom: params.get('created_at_from') ?? '',
    createdAtTo: params.get('created_at_to') ?? '',
    sort,
    myPostsOnly: myPostsOnlyRaw === '1' || myPostsOnlyRaw === 'true',
  };
}
