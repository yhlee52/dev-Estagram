import { useSearchParams } from 'react-router';
import { hasActivePostFilters } from './PostFilterPanel';
import { filtersFromSearchParams } from '../utils/filterUrl';

type FilterChip = {
  /** Stable key for React. */
  id: string;
  /** Human-readable summary of the active filter. */
  label: string;
  /** URL query params removed when this chip is cleared. */
  paramKeys: string[];
};

function buildChips(params: URLSearchParams): FilterChip[] {
  const filters = filtersFromSearchParams(params);
  const chips: FilterChip[] = [];

  if (filters.keyword?.trim()) {
    chips.push({
      id: 'keyword',
      label: `"${filters.keyword.trim()}"`,
      paramKeys: ['keyword'],
    });
  }
  if (filters.tag?.trim()) {
    chips.push({ id: 'tag', label: `#${filters.tag.trim()}`, paramKeys: ['tag'] });
  }
  if (filters.metadataKey?.trim()) {
    const value = filters.metadataValue?.trim();
    chips.push({
      id: 'metadata',
      label: value
        ? `${filters.metadataKey.trim()} = ${value}`
        : `has ${filters.metadataKey.trim()}`,
      paramKeys: ['metadata_key', 'metadata_value'],
    });
  }
  if (filters.assetType) {
    chips.push({
      id: 'assetType',
      label: `type: ${filters.assetType}`,
      paramKeys: ['asset_type'],
    });
  }
  if (filters.accountHandle?.trim()) {
    chips.push({
      id: 'accountHandle',
      label: `@${filters.accountHandle.trim()}`,
      paramKeys: ['account_handle'],
    });
  }
  if (filters.accountId !== undefined && String(filters.accountId).trim()) {
    chips.push({
      id: 'accountId',
      label: `account: ${String(filters.accountId).trim()}`,
      paramKeys: ['account_id'],
    });
  }
  if (filters.createdAtFrom?.trim()) {
    chips.push({
      id: 'createdAtFrom',
      label: `from ${filters.createdAtFrom.trim()}`,
      paramKeys: ['created_at_from'],
    });
  }
  if (filters.createdAtTo?.trim()) {
    chips.push({
      id: 'createdAtTo',
      label: `to ${filters.createdAtTo.trim()}`,
      paramKeys: ['created_at_to'],
    });
  }
  if (filters.myPostsOnly) {
    chips.push({
      id: 'myPostsOnly',
      label: 'My posts only',
      paramKeys: ['my_posts_only'],
    });
  }
  if (filters.sort === 'oldest') {
    chips.push({ id: 'sort', label: 'Oldest first', paramKeys: ['sort'] });
  }

  return chips;
}

/**
 * Right-rail summary of the filters currently applied to the feed/browse list.
 *
 * The URL query string is the single source of truth for applied filters
 * (v0.1.0), so this reads and edits the URL directly rather than holding its own
 * filter state — the HomeFeed/PostsBrowsePage list reacts to the same URL.
 */
export default function AppliedFiltersSummary() {
  const [searchParams, setSearchParams] = useSearchParams();

  if (!hasActivePostFilters(filtersFromSearchParams(searchParams))) {
    return null;
  }

  const chips = buildChips(searchParams);

  const clearKeys = (paramKeys: string[]) => {
    const next = new URLSearchParams(searchParams);
    paramKeys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const clearAll = () => {
    // Keep a non-filter sort if it is the only remaining state.
    const next = new URLSearchParams(searchParams);
    [
      'keyword',
      'tag',
      'metadata_key',
      'metadata_value',
      'asset_type',
      'account_handle',
      'account_id',
      'created_at_from',
      'created_at_to',
      'my_posts_only',
    ].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          Applied filters
        </h2>
        <button
          type="button"
          className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
          onClick={clearAll}
        >
          Clear all
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li key={chip.id}>
            <button
              type="button"
              onClick={() => clearKeys(chip.paramKeys)}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-2.5 pr-2 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-100"
              aria-label={`Remove filter ${chip.label}`}
            >
              <span className="truncate">{chip.label}</span>
              <span
                aria-hidden="true"
                className="text-neutral-400 transition group-hover:text-neutral-700"
              >
                &times;
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
