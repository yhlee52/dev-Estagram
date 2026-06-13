import type { PostFilters } from '../types/filters';

/**
 * Route a `#`-prefixed search box value to the tag filter (v0.1.2).
 *
 * People type tags as `#chamber` in the keyword box, but keyword search matches
 * title/text/account, not tags. When the keyword starts with `#`, treat the rest
 * as a single tag filter and clear the keyword. Non-`#` keywords pass through
 * unchanged so ordinary keyword search keeps working.
 *
 * Single-tag policy matches v0.1.1: the whole string after `#` (trimmed) becomes
 * one tag; an empty `#` clears the tag without filtering.
 */
export function routeHashtagSearch(filters: PostFilters): PostFilters {
  const keyword = filters.keyword?.trim() ?? '';
  if (!keyword.startsWith('#')) {
    return filters;
  }

  const tag = keyword.slice(1).trim();
  return { ...filters, keyword: '', tag };
}
