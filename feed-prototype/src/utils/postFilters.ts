import type { PostFilters } from '../types/filters';

// Shared post-filter helpers. These live here (not in PostFilterPanel.tsx) so
// the component file only exports a component — required for React Fast Refresh
// (react-refresh/only-export-components).

export const emptyPostFilters: PostFilters = {
  keyword: '',
  tag: '',
  tags: [],
  people: [],
  invalidPeople: [],
  place: '',
  scope: 'all',
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
      Boolean(filters.tags?.length) ||
      Boolean(filters.people?.length) ||
      Boolean(filters.invalidPeople?.length) ||
      filters.place?.trim() ||
      filters.scope === 'feed' ||
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
  if (filters.invalidPeople?.length) return 'URL에 잘못된 인물 조건이 있습니다. 해당 조건을 지우고 다시 검색해 주세요.';
  if ((filters.people?.length ?? 0) > 5 || (filters.tags?.length ?? 0) + (filters.tag?.trim() ? 1 : 0) > 5) return '인물과 태그는 각각 최대 5개까지 선택할 수 있습니다.';
  const tags = [filters.tag, ...(filters.tags ?? [])].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim().toLocaleLowerCase());
  if (new Set(tags).size !== tags.length) return '같은 태그가 중복되었습니다. 하나를 지워 주세요.';
  const people = (filters.people ?? []).map((value) => value.accountId);
  if (new Set(people).size !== people.length) return '같은 인물 조건이 중복되었습니다. 하나를 지워 주세요.';
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
