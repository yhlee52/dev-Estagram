import { useRef, type FormEvent } from 'react';
import type { ApiMetadataKeyCount, ApiTagCount } from '../api/types';
import type { PostAssetFilterType, PostFilters, PostSort } from '../types/filters';
import MetadataFacetControl from './MetadataFacetControl';
import TagSearchInput from './TagSearchInput';

type PostFilterPanelProps = {
  filters: PostFilters;
  onChange: (filters: PostFilters) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
  resultCount?: number;
  mode: 'feed' | 'browse';
  advancedOpen?: boolean;
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
  { value: '', label: '모든 유형' },
  { value: 'image', label: '사진' },
  { value: 'plot', label: '그래프' },
  { value: 'table', label: '표' },
  { value: 'file', label: '파일' },
  { value: 'link', label: '링크' },
];

export default function PostFilterPanel({
  filters,
  onChange,
  onApply,
  onReset,
  isLoading = false,
  resultCount,
  mode,
  advancedOpen = true,
  activeUserId,
  error = '',
  hasAppliedFilters = false,
  tagSuggestions = [],
  onSelectTag,
  metadataKeySuggestions = [],
  onSelectFacet,
}: PostFilterPanelProps) {
  const isComposing = useRef(false);
  const resultLabel =
    resultCount === undefined
      ? ''
      : `${hasAppliedFilters ? '조건 적용 · ' : ''}현재 불러온 게시글 ${resultCount.toLocaleString('ko-KR')}개`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComposing.current) return;
    onApply();
  };

  return (
    <form className="space-y-2.5" onSubmit={handleSubmit}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => { isComposing.current = false; }}>
      {/* Promoted full-width search (v0.2.1): the primary way in, set apart from
          the secondary filter grid below. */}
      <div className="flex gap-2"><div className="min-w-0 flex-1"><TagSearchInput
        ariaLabel="검색어"
        value={filters.keyword ?? ''}
        onChange={(keyword) => {
          onChange({ ...filters, keyword });
        }}
        onSelectTag={(tag) => onSelectTag?.(tag)}
        suggestions={tagSuggestions}
        placeholder="게시글 검색 또는 #태그"
        className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 text-base text-neutral-950 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
      /></div><button type="submit" disabled={isLoading} className="rounded-md bg-neutral-950 px-4 text-sm font-bold text-white disabled:opacity-50">검색</button></div>

      <div className={advancedOpen ? 'space-y-2.5' : 'hidden'}>

      {/* Facet selection (v0.4.0): fills the free-input metadata fields below
          with a data-derived key/value (exact match). API mode only — renders
          nothing when there are no known keys. */}
      <MetadataFacetControl
        keySuggestions={metadataKeySuggestions}
        onSelectFacet={(key, value) => onSelectFacet?.(key, value)}
      />

      <div className="grid gap-2 md:grid-cols-2">
        <input
          aria-label="태그"
          type="text"
          value={filters.tag ?? ''}
          onChange={(event) => {
            onChange({ ...filters, tag: event.target.value });
          }}
          placeholder="태그 정확히 입력"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <input
          aria-label="추가 정보 항목"
          type="text"
          value={filters.metadataKey ?? ''}
          onChange={(event) => {
            // Manual edits revert to contains (ILIKE); exact is only for facet picks.
            onChange({ ...filters, metadataKey: event.target.value, metadataMatch: undefined });
          }}
          placeholder="추가 정보 항목"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <input
          aria-label="추가 정보 값"
          type="text"
          value={filters.metadataValue ?? ''}
          onChange={(event) => {
            // Manual edits revert to contains (ILIKE); exact is only for facet picks.
            onChange({ ...filters, metadataValue: event.target.value, metadataMatch: undefined });
          }}
          placeholder="추가 정보 값"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <select
          aria-label="첨부 자료 유형"
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
          aria-label="계정 아이디"
          type="text"
          value={filters.accountHandle ?? ''}
          onChange={(event) => {
            onChange({ ...filters, accountHandle: event.target.value });
          }}
          placeholder="계정 아이디"
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <input
          aria-label="작성 시작일"
          type="date"
          value={filters.createdAtFrom ?? ''}
          onChange={(event) => {
            onChange({ ...filters, createdAtFrom: event.target.value });
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
        />
        <input
          aria-label="작성 종료일"
          type="date"
          value={filters.createdAtTo ?? ''}
          onChange={(event) => {
            onChange({ ...filters, createdAtTo: event.target.value });
          }}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
        />
        <select
          aria-label="정렬 순서"
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
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          {metadataKeySuggestions.length > 0 ? (
            <>
              <option value="metadata_asc">추가 정보 값 오름차순</option>
              <option value="metadata_desc">추가 정보 값 내림차순</option>
            </>
          ) : null}
        </select>
        {(filters.sort === 'metadata_asc' || filters.sort === 'metadata_desc') &&
        metadataKeySuggestions.length > 0 ? (
          <select
            aria-label="정렬할 추가 정보 항목"
            value={filters.sortMetadataKey ?? ''}
            onChange={(event) => {
              onChange({ ...filters, sortMetadataKey: event.target.value });
            }}
            className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400"
          >
            <option value="">정렬할 항목 선택…</option>
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
          내 게시글만
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
          저장한 글만
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-9 flex-1 rounded-md bg-neutral-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={isLoading}
          >
            적용
          </button>
          <button
            type="button"
            className="h-9 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
            disabled={isLoading}
            onClick={onReset}
          >
            초기화
          </button>
        </div>
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}
        {mode === 'browse' && !activeUserId ? (
          <p className="text-xs font-semibold text-neutral-500 md:col-span-2">
            로그인하면 내 게시글과 저장한 글을 찾을 수 있습니다.
          </p>
        ) : null}
        {(filters.sort === 'metadata_asc' || filters.sort === 'metadata_desc') &&
        filters.sortMetadataKey?.trim() ? (
          <p className="text-xs font-semibold text-neutral-500 md:col-span-2">
            “{filters.sortMetadataKey.trim()}” 값으로 정렬하면 해당 항목이 있는 게시글만 표시됩니다.
          </p>
        ) : null}
      </div>
      </div>
      {resultLabel ? <p className="text-xs font-semibold text-neutral-500">{resultLabel}</p> : null}
      {error && !advancedOpen ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
