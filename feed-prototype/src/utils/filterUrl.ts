import type { PostAssetFilterType, PostFilters, PostSort } from '../types/filters';

const ASSET_FILTER_TYPES: PostAssetFilterType[] = [
  'image',
  'plot',
  'table',
  'file',
  'link',
];

const POST_SORTS: PostSort[] = ['newest', 'oldest', 'metadata_asc', 'metadata_desc'];

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
  for (const tag of filters.tags ?? []) if (tag.trim()) params.append('tag', tag.trim());
  for (const person of filters.people ?? []) params.append('person', `${person.mode}:${person.accountId}`);
  for (const value of filters.invalidPeople ?? []) params.append('person', value);
  setTrimmed('place', filters.place);
  if (filters.scope === 'feed') params.set('scope', 'feed');
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
    if (filters.sort === 'metadata_asc' || filters.sort === 'metadata_desc') {
      setTrimmed('sort_metadata_key', filters.sortMetadataKey);
    }
  }
  if (filters.myPostsOnly) {
    params.set('my_posts_only', '1');
  }
  if (filters.bookmarkedOnly) {
    params.set('bookmarked_only', '1');
  }

  return params;
}

/** Parse URL query parameters back into post filters. */
export function filtersFromSearchParams(params: URLSearchParams): PostFilters {
  const assetTypeRaw = params.get('asset_type') ?? '';
  const assetType = (ASSET_FILTER_TYPES as string[]).includes(assetTypeRaw)
    ? (assetTypeRaw as PostAssetFilterType)
    : '';

  const sortRaw = params.get('sort') ?? '';
  const sort: PostSort = (POST_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as PostSort)
    : 'newest';
  const myPostsOnlyRaw = params.get('my_posts_only');
  const bookmarkedOnlyRaw = params.get('bookmarked_only');
  const metadataMatch = params.get('metadata_match') === 'exact' ? 'exact' : undefined;

  const people = params.getAll('person').map((raw) => {
    const separator = raw.indexOf(':');
    const mode = raw.slice(0, separator);
    const accountId = raw.slice(separator + 1);
    return { raw, mode, accountId, valid: separator > 0 && Boolean(accountId) && ['related', 'authored', 'mentioned_tagged'].includes(mode) };
  });

  return {
    keyword: params.get('keyword') ?? '',
    tag: params.getAll('tag')[0] ?? '',
    tags: params.getAll('tag').slice(1),
    people: people.filter((value) => value.valid).map((value) => ({ mode: value.mode as 'related' | 'authored' | 'mentioned_tagged', accountId: value.accountId })),
    invalidPeople: people.filter((value) => !value.valid).map((value) => value.raw),
    place: params.get('place') ?? '',
    scope: params.get('scope') === 'feed' ? 'feed' : 'all',
    metadataKey: params.get('metadata_key') ?? '',
    metadataValue: params.get('metadata_value') ?? '',
    metadataMatch,
    assetType,
    accountHandle: params.get('account_handle') ?? '',
    accountId: params.get('account_id') ?? undefined,
    createdAtFrom: params.get('created_at_from') ?? '',
    createdAtTo: params.get('created_at_to') ?? '',
    sort,
    sortMetadataKey: params.get('sort_metadata_key') ?? '',
    myPostsOnly: myPostsOnlyRaw === '1' || myPostsOnlyRaw === 'true',
    bookmarkedOnly: bookmarkedOnlyRaw === '1' || bookmarkedOnlyRaw === 'true',
  };
}
