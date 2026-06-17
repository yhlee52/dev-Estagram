import type { FormEvent } from 'react';
import type { ApiMetadataKeyCount, ApiTagCount } from '../api/types';
import type { PostAssetFilterType, PostFilters, PostSort } from '../types/filters';
import MetadataFacetControl from './MetadataFacetControl';
import PinnedMetadataKeysControl from './PinnedMetadataKeysControl';
import TagSearchInput from './TagSearchInput';

type PostFilterPanelProps = {
  filters: PostFilters;
  onChange: (filters: PostFilters) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
  resultCount?: number;
  mode: 'feed' | 'browse';
  activeUserId?: string;
  error?: string;
  hasAppliedFilters?: boolean;
  tagSuggestions?: ApiTagCount[];
  onSelectTag?: (tag: string) => void;
  metadataKeySuggestions?: ApiMetadataKeyCount[];
  onSelectFacet?: (key: string, value: string) => void;
};

const assetTypeOptions: Array<{
  value: PostAssetFilterType;
  label: string;
}> = [
  { value: '', label: 'All' },
  { value: 'image', label: 'image' },
  { value: 'plot', label: 'plot' },
  { value: 'table', label: 'table' },
  { value: 'file', label: 'file' },
  { value: 'link', label: 'link' },
];

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

export default function PostFilterPanel({
  filters,
  onChange,
  onApply,
  onReset,
  isLoading = false,
  resultCount,
  mode,
  activeUserId,
  error = '',
  hasAppliedFilters = false,
  tagSuggestions = [],
  onSelectTag,
  metadataKeySuggestions = [],
  onSelectFacet,
}: PostFilterPanelProps) {
  const resultLabel =
    resultCount === undefined
      ? ''
      : `${hasAppliedFilters ? 'Filters applied - ' : ''}Showing ${resultCount} ${
          resultCount === 1 ? 'post' : 'posts'
        }`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply();
  };

  return (
    <form className="space-y-2.5" onSubmit={handleSubmit}>
      {/* Promoted full-width search (v0.2.1): the primary way in, set apart from
          the secondary filter grid below. */}
      <TagSearchInput
        ariaLabel="Keyword"
        value={filters.keyword ?? ''}
        onChange={(keyword) => {
          onChange({ ...filters, keyword });
        }}
        onSelectTag={(tag) => onSelectTag?.(tag)}
        suggestions={tagSuggestions}
        placeholder="Search posts by keyword or #tag"
        className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 text-base text-neutral-950 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
      />

      {/* Facet selection (v0.4.0): fills the free-input metadata fields below
          with a data-derived key/value (exact match). API mode only — renders
          nothing when there are no known keys. */}
      <MetadataFacetControl
        keySuggestions={metadataKeySuggestions}
        onSelectFacet={(key, value) => onSelectFacet?.(key, value)}
      />

      {/* Pin metadata keys to show as chips on cards (v0.4.1). Display
          preference, persisted to localStorage; independent of the filters. */}
      <PinnedMetadataKeysControl keySuggestions={metadataKeySuggestions} />

      <div className="grid gap-2 md:grid-cols-2">
        <input
          aria-label="Tag"
          type="text"
          value={filters.tag ?? ''}
          onChange={(event) => {
            onChange({ ...filters, tag: event.target.value });
          }}
          placeholder="Exact tag (or #tag in search)"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <input
          aria-label="Metadata key"
          type="text"
          value={filters.metadataKey ?? ''}
          onChange={(event) => {
            // Manual edits revert to contains (ILIKE); exact is only for facet picks.
            onChange({ ...filters, metadataKey: event.target.value, metadataMatch: undefined });
          }}
          placeholder="Metadata key e.g. severity"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <input
          aria-label="Metadata value"
          type="text"
          value={filters.metadataValue ?? ''}
          onChange={(event) => {
            // Manual edits revert to contains (ILIKE); exact is only for facet picks.
            onChange({ ...filters, metadataValue: event.target.value, metadataMatch: undefined });
          }}
          placeholder="Metadata value e.g. high"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <select
          aria-label="Asset type"
          value={filters.assetType ?? ''}
          onChange={(event) => {
            onChange({
              ...filters,
              assetType: event.target.value as PostAssetFilterType,
            });
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400"
        >
          {assetTypeOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Account handle"
          type="text"
          value={filters.accountHandle ?? ''}
          onChange={(event) => {
            onChange({ ...filters, accountHandle: event.target.value });
          }}
          placeholder="Account handle"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <input
          aria-label="Created from"
          type="date"
          value={filters.createdAtFrom ?? ''}
          onChange={(event) => {
            onChange({ ...filters, createdAtFrom: event.target.value });
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
        />
        <input
          aria-label="Created to"
          type="date"
          value={filters.createdAtTo ?? ''}
          onChange={(event) => {
            onChange({ ...filters, createdAtTo: event.target.value });
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
        />
        <select
          aria-label="Sort order"
          value={filters.sort ?? 'newest'}
          onChange={(event) => {
            const nextSort = event.target.value as PostSort;
            const isMetadataSort =
              nextSort === 'metadata_asc' || nextSort === 'metadata_desc';
            onChange({
              ...filters,
              sort: nextSort,
              // Seed a key when switching into metadata sort; clear it otherwise.
              sortMetadataKey: isMetadataSort
                ? filters.sortMetadataKey || metadataKeySuggestions[0]?.key || ''
                : '',
            });
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          {metadataKeySuggestions.length > 0 ? (
            <>
              <option value="metadata_asc">Metadata value ↑</option>
              <option value="metadata_desc">Metadata value ↓</option>
            </>
          ) : null}
        </select>
        {(filters.sort === 'metadata_asc' || filters.sort === 'metadata_desc') &&
        metadataKeySuggestions.length > 0 ? (
          <select
            aria-label="Sort metadata key"
            value={filters.sortMetadataKey ?? ''}
            onChange={(event) => {
              onChange({ ...filters, sortMetadataKey: event.target.value });
            }}
            className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400"
          >
            <option value="">Sort by which key…</option>
            {metadataKeySuggestions.map((item) => (
              <option key={item.key} value={item.key}>
                {item.key}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 has-[:disabled]:text-neutral-400">
          <input
            type="checkbox"
            checked={Boolean(filters.myPostsOnly)}
            disabled={!activeUserId}
            onChange={(event) => {
              onChange({ ...filters, myPostsOnly: event.target.checked });
            }}
            className="size-4 accent-neutral-950"
          />
          My posts only
        </label>
        <label className="flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 has-[:disabled]:text-neutral-400">
          <input
            type="checkbox"
            checked={Boolean(filters.bookmarkedOnly)}
            disabled={!activeUserId}
            onChange={(event) => {
              onChange({ ...filters, bookmarkedOnly: event.target.checked });
            }}
            className="size-4 accent-neutral-950"
          />
          Bookmarked only
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-9 flex-1 rounded-md bg-neutral-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={isLoading}
          >
            Apply
          </button>
          <button
            type="button"
            className="h-9 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
            disabled={isLoading}
            onClick={onReset}
          >
            Reset
          </button>
        </div>
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}
        {mode === 'browse' && !activeUserId ? (
          <p className="text-xs font-semibold text-neutral-500 md:col-span-2">
            Select an API user to enable My posts only.
          </p>
        ) : null}
        {(filters.sort === 'metadata_asc' || filters.sort === 'metadata_desc') &&
        filters.sortMetadataKey?.trim() ? (
          <p className="text-xs font-semibold text-neutral-500 md:col-span-2">
            Sorting by “{filters.sortMetadataKey.trim()}” — only posts that have
            this metadata key are shown.
          </p>
        ) : null}
        {resultLabel ? (
          <p className="text-xs font-semibold text-neutral-500 md:col-span-2">
            {resultLabel}
          </p>
        ) : null}
      </div>
    </form>
  );
}
