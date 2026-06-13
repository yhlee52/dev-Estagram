import type { PostFilters } from '../types/filters';

type BuildPostFilterQueryOptions = {
  userId?: string;
  cursor?: string;
  limit?: number;
};

const appendStringParam = (
  searchParams: URLSearchParams,
  key: string,
  value: string | number | undefined,
) => {
  if (value === undefined) {
    return;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return;
  }

  searchParams.set(key, normalizedValue);
};

export const buildPostFilterQuery = (
  filters?: PostFilters,
  options: BuildPostFilterQueryOptions = {},
): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (filters) {
    appendStringParam(searchParams, 'keyword', filters.keyword);
    appendStringParam(searchParams, 'tag', filters.tag);
    appendStringParam(searchParams, 'metadata_key', filters.metadataKey);
    appendStringParam(searchParams, 'metadata_value', filters.metadataValue);
    appendStringParam(searchParams, 'asset_type', filters.assetType);
    appendStringParam(searchParams, 'account_id', filters.accountId);
    appendStringParam(searchParams, 'account_handle', filters.accountHandle);
    appendStringParam(searchParams, 'created_at_from', filters.createdAtFrom);
    appendStringParam(searchParams, 'created_at_to', filters.createdAtTo);

    // Only emit non-default sort to keep query strings clean.
    if (filters.sort && filters.sort !== 'newest') {
      searchParams.set('sort', filters.sort);
    }

    if (filters.myPostsOnly) {
      searchParams.set('my_posts_only', 'true');
      appendStringParam(searchParams, 'user_id', options.userId);
    }
  }

  appendStringParam(searchParams, 'cursor', options.cursor);
  appendStringParam(searchParams, 'limit', options.limit);

  return searchParams;
};
