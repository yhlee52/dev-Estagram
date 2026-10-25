import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { searchAccounts } from '../api/accountsApi';
import type { ApiAccountSearchPage } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import AccountCard from '../components/AccountCard';
import EmptyState from '../components/EmptyState';
import { getDataSourceMode } from '../config/dataSource';
import { mapApiAccountToAccount } from '../data/apiFeedRepository';
import { useApiFollows } from '../hooks/useApiFollows';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import { useFollowState } from '../hooks/useFollowState';
import postsData from '../data/posts.json';
import type { Post } from '../types/feed';

const PAGE_SIZE = 20;
type AccountSort = 'handle' | 'recent' | 'post_count';

export function ApiAccountsSearch() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const sortRaw = params.get('account_sort');
  const sort: AccountSort = sortRaw === 'recent' || sortRaw === 'post_count' ? sortRaw : 'handle';
  const [draft, setDraft] = useState(keyword);
  const [items, setItems] = useState<ApiAccountSearchPage['items']>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const isComposing = useRef(false);
  const queryKeyRef = useRef('');
  useEffect(() => { queryKeyRef.current = `${keyword}:${sort}`; }, [keyword, sort]);
  const { activeApiUserId } = useActiveApiUser();
  const follows = useApiFollows(activeApiUserId);

  useEffect(() => { setDraft(keyword); }, [keyword]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setItems([]);
    setCursor(null);
    void searchAccounts({ keyword, sort, limit: PAGE_SIZE }).then((page) => {
      if (!live) return;
      setItems(page.items);
      setCursor(page.next_cursor);
    }).catch(() => {
      if (!live) return;
      setItems([]);
      setCursor(null);
      setError('계정을 불러오지 못했습니다. 다시 시도해 주세요.');
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [keyword, sort, retryCount]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComposing.current) return;
    const next = new URLSearchParams(params);
    const term = draft.trim().normalize('NFC');
    if (term) next.set('keyword', term);
    else next.delete('keyword');
    if (next.toString() !== params.toString()) setParams(next);
  };
  const changeSort = (value: AccountSort) => {
    const next = new URLSearchParams(params);
    if (value === 'handle') next.delete('account_sort');
    else next.set('account_sort', value);
    setParams(next);
  };
  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    const expectedCursor = cursor;
    const requestKey = queryKeyRef.current;
    setLoadingMore(true);
    try {
      const page = await searchAccounts({ keyword, sort, cursor, limit: PAGE_SIZE });
      if (requestKey !== queryKeyRef.current || expectedCursor !== cursor) return;
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.account.id === item.account.id))]);
      setCursor(page.next_cursor);
    } catch {
      if (requestKey === queryKeyRef.current) setError('계정을 더 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally { if (requestKey === queryKeyRef.current) setLoadingMore(false); }
  };

  return <div className="space-y-3">
    <form onSubmit={submit} onCompositionStart={() => { isComposing.current = true; }} onCompositionEnd={() => { isComposing.current = false; }}
      className="flex gap-2 rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
      <input aria-label="계정 검색어" value={draft} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && (isComposing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
        placeholder="이름 또는 @아이디 검색" className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm" />
      <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white" type="submit">검색</button>
    </form>
    <div className="flex flex-wrap gap-2" aria-label="계정 정렬">
      {([['handle', '아이디순'], ['recent', '최근 활동순'], ['post_count', '게시글 많은순']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={sort === value} onClick={() => changeSort(value)}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${sort === value ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white'}`}>{label}</button>)}
    </div>
    {loading ? <p role="status" className="text-sm text-neutral-500">계정을 찾는 중...</p> : null}
    {error ? <div role="alert" className="flex items-center gap-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setRetryCount((count) => count + 1)} className="font-bold underline">다시 시도</button></div> : null}
    {!loading && !error && items.length === 0 ? <EmptyState title="계정을 찾지 못했습니다" description="검색어를 바꿔 보세요." /> : null}
    {!loading ? <p className="text-xs text-neutral-500">현재 불러온 계정 {items.length}개</p> : null}
    {!loading && items.map((item) => {
      const account = mapApiAccountToAccount(item.account);
      const own = item.account.user_id === activeApiUserId;
      return <AccountCard key={account.id} account={account} postCount={item.post_count}
        recentPostCount={undefined} lastActiveAt={item.last_post_at ?? undefined}
        isFollowing={follows.isFollowing(account.id)} onToggleFollow={follows.toggleFollow}
        isFollowDisabled={own || follows.isLoading || follows.isMutating}
        followButtonLabel={own ? '내 계정' : follows.isFollowing(account.id) ? '팔로잉' : '팔로우'} />;
    })}
    {cursor ? <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
      className="w-full rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-bold">{loadingMore ? '불러오는 중...' : '더 보기'}</button> : null}
  </div>;
}

export default function AccountsPage() {
  const mockAccounts = useEffectiveAccounts();
  const { isFollowing, toggleFollow } = useFollowState();
  const posts = postsData as unknown as Post[];
  if (getDataSourceMode() === 'api') return <ApiAccountsSearch />;
  return <div className="space-y-3">
    <h1 className="text-lg font-bold">계정 찾기</h1>
    {mockAccounts.map((account) => <AccountCard key={account.id} account={account} postCount={posts.filter((post) => post.accountId === account.id).length}
      isFollowing={isFollowing(account.id)} onToggleFollow={toggleFollow} />)}
  </div>;
}
