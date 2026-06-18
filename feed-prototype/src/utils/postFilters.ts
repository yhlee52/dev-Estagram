import type { PostFilters } from '../types/filters';

// Shared post-filter helpers. These live here (not in PostFilterPanel.tsx) so
// the component file only exports a component — required for React Fast Refresh
// (react-refresh/only-export-components).

export const emptyPostFilters: PostFilters = {
  keyword: '',
  tag: '',
  metadataKey: '',
  metadataValue: '',
  assetType: '',
  accountHandle: '',
  myPostsOnly: false,
  bookmarkedOnly: false,
  createdAtFrom: '',
  createdAtTo: '',
  sort: 'newest',
};

export function hasActivePostFilters(filters: PostFilters): boolean {
  return Boolean(
    filters.keyword?.trim() ||
      filters.tag?.trim() ||
      filters.metadataKey?.trim() ||
      filters.metadataValue?.trim() ||
      filters.assetType ||
      filters.accountId ||
      filters.accountHandle?.trim() ||
      filters.myPostsOnly ||
      filters.bookmarkedOnly ||
      filters.createdAtFrom?.trim() ||
      filters.createdAtTo?.trim(),
  );
}

export function getPostFilterValidationError(filters: PostFilters): string {
  if (filters.metadataValue?.trim() && !filters.metadataKey?.trim()) {
    return 'Metadata key is required when metadata value is set.';
  }

  if (
    (filters.sort === 'metadata_asc' || filters.sort === 'metadata_desc') &&
    !filters.sortMetadataKey?.trim()
  ) {
    return 'Pick a metadata key to sort by.';
  }

  const from = filters.createdAtFrom?.trim();
  const to = filters.createdAtTo?.trim();
  if (from && to && from > to) {
    return 'Date from must be on or before date to.';
  }

  return '';
}
