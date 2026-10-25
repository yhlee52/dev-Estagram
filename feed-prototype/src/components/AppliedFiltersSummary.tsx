import { useSearchParams } from 'react-router';
import { filtersFromSearchParams } from '../utils/filterUrl';

type Chip = { id: string; label: string; keys: string[] };

function chipsFromParams(params: URLSearchParams): Chip[] {
  const f = filtersFromSearchParams(params);
  const chips: Chip[] = [];
  if (f.keyword?.trim()) chips.push({ id: 'keyword', label: `검색: ${f.keyword.trim()}`, keys: ['keyword'] });
  if (f.tag?.trim()) chips.push({ id: 'tag', label: `#${f.tag.trim()}`, keys: ['tag'] });
  if (f.metadataKey?.trim()) chips.push({
    id: 'metadata',
    label: `추가 정보: ${f.metadataKey.trim()}${f.metadataValue?.trim() ? ` ${f.metadataMatch === 'exact' ? '=' : '포함'} ${f.metadataValue.trim()}` : ''}`,
    keys: ['metadata_key', 'metadata_value', 'metadata_match'],
  });
  if (f.assetType) chips.push({ id: 'asset', label: `자료: ${f.assetType}`, keys: ['asset_type'] });
  if (f.accountHandle?.trim()) chips.push({ id: 'handle', label: `@${f.accountHandle.trim()}`, keys: ['account_handle'] });
  if (f.accountId !== undefined && String(f.accountId).trim()) chips.push({ id: 'account', label: `계정: ${String(f.accountId).trim()}`, keys: ['account_id'] });
  if (f.createdAtFrom?.trim()) chips.push({ id: 'from', label: `시작: ${f.createdAtFrom}`, keys: ['created_at_from'] });
  if (f.createdAtTo?.trim()) chips.push({ id: 'to', label: `종료: ${f.createdAtTo}`, keys: ['created_at_to'] });
  if (f.myPostsOnly) chips.push({ id: 'mine', label: '내 게시글', keys: ['my_posts_only'] });
  if (f.bookmarkedOnly) chips.push({ id: 'bookmark', label: '저장한 글', keys: ['bookmarked_only'] });
  if (f.sort === 'oldest') chips.push({ id: 'sort', label: '오래된순', keys: ['sort', 'sort_metadata_key'] });
  if (f.sort === 'metadata_asc' || f.sort === 'metadata_desc') chips.push({
    id: 'sort',
    label: `${f.sortMetadataKey || '추가 정보'} ${f.sort === 'metadata_asc' ? '오름차순' : '내림차순'}`,
    keys: ['sort', 'sort_metadata_key'],
  });
  return chips;
}

/** The same applied filter summary is visible beside or below results. */
export default function AppliedFiltersSummary() {
  const [params, setParams] = useSearchParams();
  const chips = chipsFromParams(params);
  if (chips.length === 0) return null;

  const clear = (keys: string[]) => {
    const next = new URLSearchParams(params);
    keys.forEach((key) => next.delete(key));
    setParams(next);
  };
  const clearAll = () => {
    const next = new URLSearchParams();
    const tab = params.get('tab');
    if (tab) next.set('tab', tab);
    setParams(next);
  };

  return (
    <section className="space-y-2" aria-label="적용된 검색 조건">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-bold text-neutral-500">적용된 조건 {chips.length}개</h2>
        <button type="button" className="text-xs font-bold text-neutral-600 hover:text-neutral-950" onClick={clearAll}>모두 지우기</button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li key={chip.id}>
            <button type="button" onClick={() => clear(chip.keys)}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-100"
              aria-label={`${chip.label} 조건 지우기`}>{chip.label} ×</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
