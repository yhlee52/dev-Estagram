import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { getAuthSession } from '../api/authApi';
import { getAccount, getAccountRelations, getAccountSummary, getPinnedPosts, replacePinnedPosts, updateAccountProfile } from '../api/accountsApi';
import { getUserNotifications } from '../api/notificationsApi';
import { getPosts } from '../api/postsApi';
import type { ApiAccount, ApiAccountRelationPage, ApiAccountSummary, ApiNotificationItem, ApiPostWithAssets } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import FeedCard from '../components/FeedCard';
import MeBookmarksSection from '../components/MeBookmarksSection';
import MyPostCard from '../components/MyPostCard';
import { mapApiAccountToAccount, mapApiPostToPost } from '../data/apiFeedRepository';
import { useApiFollows } from '../hooks/useApiFollows';
import type { FeedItem } from '../types/feed';
import { emptyPostFilters } from '../utils/postFilters';
import { formatDateTime } from '../utils/format';

type Tab = 'posts' | 'assets' | 'followers' | 'following' | 'bookmarks' | 'mentions';
const PAGE_SIZE = 20;

function ProfileAvatar({ account }: { account: ApiAccount }) {
  const [broken, setBroken] = useState(false);
  return account.avatar_url && !broken
    ? <img src={account.avatar_url} alt="" onError={() => setBroken(true)} className="size-20 rounded-full border-4 border-white bg-neutral-100 object-cover" />
    : <div className="flex size-20 items-center justify-center rounded-full border-4 border-white bg-neutral-200 text-2xl font-bold">{account.display_name.charAt(0)}</div>;
}

export default function ApiProfilePage() {
  const { accountId: routeAccountId } = useParams();
  const [params, setParams] = useSearchParams();
  const { activeApiUserId } = useActiveApiUser();
  const follows = useApiFollows(activeApiUserId);
  const [account, setAccount] = useState<ApiAccount | null>(null);
  const [summary, setSummary] = useState<ApiAccountSummary | null>(null);
  const [pinned, setPinned] = useState<ApiPostWithAssets[]>([]);
  const [items, setItems] = useState<ApiPostWithAssets[]>([]);
  const [relationItems, setRelationItems] = useState<ApiAccountRelationPage['items']>([]);
  const [mentions, setMentions] = useState<ApiNotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [tabError, setTabError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [tabRetry, setTabRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: '', bio: '', avatar_url: '', cover_url: '', links: [{ label: '', url: '' }] });
  const tabRaw = params.get('tab');
  const tab: Tab = ['assets', 'followers', 'following', 'bookmarks', 'mentions'].includes(tabRaw ?? '') ? tabRaw as Tab : 'posts';
  const own = Boolean(account && account.user_id === activeApiUserId);
  const canManage = own && !routeAccountId;
  const effectiveTab: Tab = !canManage && (tab === 'bookmarks' || tab === 'mentions') ? 'posts' : tab;
  useEffect(() => {
    if (account && !canManage && (tab === 'bookmarks' || tab === 'mentions')) {
      const next = new URLSearchParams(params);
      next.delete('tab');
      setParams(next, { replace: true });
    }
  }, [account, canManage, tab, params, setParams]);
  const keyRef = useRef('');
  useEffect(() => { keyRef.current = `${account?.id ?? ''}:${effectiveTab}`; }, [account?.id, effectiveTab]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setAccount(null);
    setItems([]);
    setRelationItems([]);
    setMentions([]);
    const load = async () => {
      try {
        const nextAccount = routeAccountId ? await getAccount(routeAccountId) : (await getAuthSession()).account;
        if (!nextAccount) throw new Error('Account missing');
        const [nextSummary, nextPins] = await Promise.all([getAccountSummary(nextAccount.id), getPinnedPosts(nextAccount.id)]);
        if (!live) return;
        setAccount(nextAccount);
        setSummary(nextSummary);
        setPinned(nextPins);
        setEditForm({
          display_name: nextAccount.display_name,
          bio: nextAccount.bio ?? '',
          avatar_url: nextAccount.avatar_url ?? '',
          cover_url: nextAccount.cover_url ?? '',
          links: nextAccount.profile_links?.length ? nextAccount.profile_links : [{ label: '', url: '' }],
        });
      } catch {
        if (live) setError('프로필을 불러오지 못했습니다. 다시 시도해 주세요.');
      } finally { if (live) setLoading(false); }
    };
    void load();
    return () => { live = false; };
  }, [routeAccountId, activeApiUserId, profileRetry]);

  useEffect(() => {
    if (!account) return;
    if (effectiveTab === 'bookmarks') {
      setCursor(null);
      setTabLoading(false);
      setTabError('');
      return;
    }
    let live = true;
    setItems([]);
    setRelationItems([]);
    setMentions([]);
    setCursor(null);
    setTabLoading(true);
    setTabError('');
    const load = async () => {
      try {
        if (effectiveTab === 'posts' || effectiveTab === 'assets') {
          const page = await getPosts({ ...emptyPostFilters, accountId: account.id }, { limit: PAGE_SIZE, hasAssets: effectiveTab === 'assets', excludePinned: effectiveTab === 'posts' });
          if (live) { setItems(page.items); setCursor(page.next_cursor); }
        } else if (effectiveTab === 'followers' || effectiveTab === 'following') {
          const page = await getAccountRelations(account.id, effectiveTab);
          if (live) { setRelationItems(page.items); setCursor(page.next_cursor); }
        } else if (effectiveTab === 'mentions') {
          const page = await getUserNotifications(activeApiUserId, { reason: 'mention', limit: PAGE_SIZE });
          if (live) { setMentions(page.items); setCursor(page.next_cursor); }
        }
      } catch {
        if (live) setTabError('목록을 불러오지 못했습니다. 다시 시도해 주세요.');
      } finally { if (live) setTabLoading(false); }
    };
    void load();
    return () => { live = false; };
  }, [account, effectiveTab, activeApiUserId, tabRetry]);

  const loadMore = async () => {
    if (!account || !cursor || loadingMore) return;
    const requestKey = keyRef.current;
    setLoadingMore(true);
    try {
      if (effectiveTab === 'posts' || effectiveTab === 'assets') {
        const page = await getPosts({ ...emptyPostFilters, accountId: account.id }, { cursor, limit: PAGE_SIZE, hasAssets: effectiveTab === 'assets', excludePinned: effectiveTab === 'posts' });
        if (requestKey === keyRef.current) { setItems((current) => [...current, ...page.items.filter((post) => !current.some((old) => old.id === post.id))]); setCursor(page.next_cursor); }
      } else if (effectiveTab === 'followers' || effectiveTab === 'following') {
        const page = await getAccountRelations(account.id, effectiveTab, cursor);
        if (requestKey === keyRef.current) { setRelationItems((current) => [...current, ...page.items]); setCursor(page.next_cursor); }
      } else if (effectiveTab === 'mentions') {
        const page = await getUserNotifications(activeApiUserId, { reason: 'mention', cursor, limit: PAGE_SIZE });
        if (requestKey === keyRef.current) { setMentions((current) => [...current, ...page.items]); setCursor(page.next_cursor); }
      }
    } catch { if (requestKey === keyRef.current) setTabError('더 불러오지 못했습니다. 다시 시도해 주세요.'); }
    finally { if (requestKey === keyRef.current) setLoadingMore(false); }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account || !canManage || saving) return;
    setSaving(true);
    setTabError('');
    try {
      const updated = await updateAccountProfile(account.id, {
        display_name: editForm.display_name.trim(),
        bio: editForm.bio.trim() || null,
        avatar_url: editForm.avatar_url.trim() || null,
        cover_url: editForm.cover_url.trim() || null,
        profile_links: editForm.links.filter((link) => link.label.trim() && link.url.trim()).map((link) => ({ label: link.label.trim(), url: link.url.trim() })),
      });
      setAccount(updated);
      setEditing(false);
    } catch { setTabError('프로필을 저장하지 못했습니다. 입력 내용을 확인해 주세요.'); }
    finally { setSaving(false); }
  };

  const setPins = async (postIds: string[]) => {
    if (!account || !canManage || pinning) return;
    setPinning(true);
    setTabError('');
    try {
      const nextPins = await replacePinnedPosts(account.id, postIds);
      setPinned(nextPins);
      if (effectiveTab === 'posts' || effectiveTab === 'assets') {
        const page = await getPosts({ ...emptyPostFilters, accountId: account.id }, { limit: PAGE_SIZE, hasAssets: effectiveTab === 'assets', excludePinned: effectiveTab === 'posts' });
        setItems(page.items);
        setCursor(page.next_cursor);
      }
    }
    catch { setTabError('고정 게시글을 변경하지 못했습니다.'); }
    finally { setPinning(false); }
  };
  const chooseTab = (nextTab: Tab) => {
    const next = new URLSearchParams(params);
    if (nextTab === 'posts') next.delete('tab'); else next.set('tab', nextTab);
    setParams(next);
  };
  const asItem = (post: ApiPostWithAssets): FeedItem => ({ account: mapApiAccountToAccount(account!), post: mapApiPostToPost(post, post.assets) });

  if (loading) return <p role="status" className="py-8 text-center text-sm text-neutral-500">프로필을 불러오는 중...</p>;
  if (error || !account) return <EmptyState title="프로필을 볼 수 없습니다" description={error || '계정을 찾지 못했습니다.'} action={<button type="button" onClick={() => setProfileRetry((count) => count + 1)} className="rounded-md border px-3 py-2 text-sm font-bold">다시 시도</button>} />;
  const visibleTabs: Array<[Tab, string]> = [
    ['posts', '게시글'], ['assets', '사진·첨부 자료'], ['followers', '팔로워'], ['following', '팔로잉'],
    ...(canManage ? [['bookmarks', '저장한 글'], ['mentions', '언급']] as Array<[Tab, string]> : []),
  ];
  const safeTab = effectiveTab;

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="h-32 bg-neutral-200 sm:h-40"
        style={account.cover_url ? { backgroundImage: `url(${JSON.stringify(account.cover_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
      <div className="space-y-4 px-4 pb-5 sm:px-6">
        <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
          <ProfileAvatar key={`${account.id}:${account.avatar_url ?? ''}`} account={account} />
          <div className="flex flex-wrap gap-2">
            {canManage ? <><button type="button" onClick={() => setEditing((value) => !value)} className="rounded-md border px-3 py-2 text-sm font-bold">프로필 편집</button>
              <Link to="/posts/new" className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white">글쓰기</Link>
              <Link to={`/accounts/${account.id}`} className="rounded-md border px-3 py-2 text-sm font-bold">공개 프로필 보기</Link>
              <Link to="/settings" className="rounded-md border px-3 py-2 text-sm font-bold">설정</Link></>
              : own ? <Link to="/me" className="rounded-md border px-3 py-2 text-sm font-bold">내 프로필</Link>
              : account.deactivated_at ? <span className="rounded-md bg-neutral-100 px-3 py-2 text-sm">비활성 계정</span>
              : <><button type="button" onClick={() => { void follows.toggleFollow(account.id).then(() => getAccountSummary(account.id)).then(setSummary).catch(() => {}); }} disabled={follows.isLoading || follows.isMutating} className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{follows.isFollowing(account.id) ? '팔로잉' : '팔로우'}</button>
                <Link to={`/messages/${account.id}`} className="rounded-md border px-3 py-2 text-sm font-bold">메시지</Link></>}
          </div>
        </div>
        {follows.error && !canManage ? <p role="alert" className="text-sm text-red-700">{follows.error}</p> : null}
        <div><h1 className="break-words text-xl font-bold">{account.display_name}</h1><p className="text-sm text-neutral-500">@{account.handle}</p>
          {account.bio ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{account.bio}</p> : null}
          {account.profile_links?.length ? <div className="mt-2 flex flex-wrap gap-3">{account.profile_links.map((link, index) => <a key={`${link.url}:${index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline">{link.label}</a>)}</div> : null}
          {account.deactivated_at ? <p className="mt-2 text-xs text-neutral-500">이 계정은 비활성 상태입니다. 기존 게시글은 계속 볼 수 있습니다.</p> : null}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          {[['게시글', summary?.post_count], ['팔로워', summary?.follower_count], ['팔로잉', summary?.following_count]].map(([label, value]) =>
            <div key={String(label)} className="rounded-md bg-neutral-50 p-2"><strong className="block text-base">{typeof value === 'number' ? value.toLocaleString('ko-KR') : '—'}</strong>{label}</div>)}
        </div>
        {summary?.last_post_at ? <p className="text-xs text-neutral-500">최근 게시글 {formatDateTime(summary.last_post_at)}</p> : null}
      </div>
    </section>

    {editing && canManage ? <form onSubmit={(event) => void saveProfile(event)} className="space-y-3 rounded-md border bg-white p-4" aria-label="프로필 편집">
      <h2 className="font-bold">프로필 편집</h2>
      <label className="block text-sm">표시 이름<input required maxLength={120} value={editForm.display_name} onChange={(event) => setEditForm({ ...editForm, display_name: event.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="block text-sm">소개<textarea maxLength={500} value={editForm.bio} onChange={(event) => setEditForm({ ...editForm, bio: event.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="block text-sm">프로필 사진 URL<input value={editForm.avatar_url} onChange={(event) => setEditForm({ ...editForm, avatar_url: event.target.value })} className="mt-1 w-full rounded-md border p-2" /></label>
      <label className="block text-sm">커버 이미지 URL<input value={editForm.cover_url} onChange={(event) => setEditForm({ ...editForm, cover_url: event.target.value })} placeholder="/assets/... 또는 https://..." className="mt-1 w-full rounded-md border p-2" /></label>
      <fieldset className="space-y-2"><legend className="text-sm font-bold">프로필 링크 (최대 3개)</legend>
        {editForm.links.map((link, index) => <div key={index} className="flex flex-wrap gap-2"><input aria-label={`링크 ${index + 1} 이름`} placeholder="이름" required={Boolean(link.label || link.url)} maxLength={40} value={link.label} onChange={(event) => setEditForm((current) => ({ ...current, links: current.links.map((item, i) => i === index ? { ...item, label: event.target.value } : item) }))} className="min-w-32 flex-1 rounded-md border p-2 text-sm" /><input aria-label={`링크 ${index + 1} 주소`} placeholder="https://..." required={Boolean(link.label || link.url)} type="url" maxLength={1000} value={link.url} onChange={(event) => setEditForm((current) => ({ ...current, links: current.links.map((item, i) => i === index ? { ...item, url: event.target.value } : item) }))} className="min-w-40 flex-1 rounded-md border p-2 text-sm" /></div>)}
        {editForm.links.length < 3 ? <button type="button" onClick={() => setEditForm((current) => ({ ...current, links: [...current.links, { label: '', url: '' }] }))} className="text-sm underline">링크 추가</button> : null}
      </fieldset>
      <div className="flex gap-2"><button type="submit" disabled={saving} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white">{saving ? '저장하는 중...' : '저장'}</button><button type="button" onClick={() => setEditing(false)} className="rounded-md border px-4 py-2 text-sm">취소</button></div>
    </form> : null}

    {pinned.length ? <section className="space-y-3"><h2 className="text-sm font-bold">고정 게시글</h2>{pinned.map((post, index) => <div key={post.id} className="space-y-1"><FeedCard item={asItem(post)} />{canManage ? <div className="flex justify-end gap-2 text-xs"><button type="button" disabled={pinning || index === 0} onClick={() => void setPins(pinned.map((item) => item.id).map((id, i, ids) => i === index - 1 ? ids[index] : i === index ? ids[index - 1] : id))}>위로</button><button type="button" disabled={pinning || index === pinned.length - 1} onClick={() => void setPins(pinned.map((item) => item.id).map((id, i, ids) => i === index + 1 ? ids[index] : i === index ? ids[index + 1] : id))}>아래로</button><button type="button" disabled={pinning} onClick={() => void setPins(pinned.filter((item) => item.id !== post.id).map((item) => item.id))}>고정 해제</button></div> : null}</div>)}</section> : null}

    <nav className="flex flex-wrap gap-2" aria-label="프로필 콘텐츠">
      {visibleTabs.map(([value, label]) => <button key={value} type="button" aria-current={safeTab === value ? 'page' : undefined} onClick={() => chooseTab(value)} className={`rounded-md px-3 py-2 text-sm font-bold ${safeTab === value ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-600'}`}>{label}</button>)}
    </nav>
    {tabError ? <div role="alert" className="flex items-center gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700"><span>{tabError}</span><button type="button" onClick={() => setTabRetry((count) => count + 1)} className="font-bold underline">다시 시도</button></div> : null}
    {tabLoading ? <p role="status" className="py-6 text-center text-sm text-neutral-500">목록을 불러오는 중...</p> : null}
    {!tabLoading && (safeTab === 'posts' || safeTab === 'assets') ? <section className={safeTab === 'assets' ? 'grid gap-3 lg:grid-cols-2' : 'space-y-3'}>
      {items.length === 0 ? <EmptyState title="게시글이 없습니다" description={safeTab === 'assets' ? '첨부 자료가 있는 게시글이 없습니다.' : '게시글을 작성하면 여기에 표시됩니다.'} /> : items.map((post) => <div key={post.id} className="space-y-1">{canManage ? <MyPostCard item={asItem(post)} onDeleted={(postId) => { setItems((current) => current.filter((item) => item.id !== postId)); setPinned((current) => current.filter((item) => item.id !== postId)); setSummary((current) => current ? { ...current, post_count: Math.max(0, current.post_count - 1) } : current); }} /> : <FeedCard item={asItem(post)} />}
        {canManage ? <button type="button" disabled={pinning} onClick={() => void setPins(pinned.length < 3 ? [...pinned.map((item) => item.id), post.id] : [...pinned.slice(0, 2).map((item) => item.id), post.id])} className="text-xs font-bold underline">{pinned.length < 3 ? '프로필에 고정' : '마지막 고정 글 교체'}</button> : null}</div>)}
    </section> : null}
    {!tabLoading && (safeTab === 'followers' || safeTab === 'following') ? <section className="space-y-2">{relationItems.length === 0 ? <EmptyState title="계정이 없습니다" /> : relationItems.map((item) => <Link key={item.id} to={`/accounts/${item.id}`} className="block rounded-md border bg-white p-3 text-sm font-semibold">{item.display_name} <span className="text-neutral-500">@{item.handle}</span>{item.deactivated_at ? ' · 비활성' : ''}</Link>)}</section> : null}
    {safeTab === 'bookmarks' && canManage ? <MeBookmarksSection userId={activeApiUserId} /> : null}
    {!tabLoading && safeTab === 'mentions' && canManage ? <section className="space-y-2">{mentions.length === 0 ? <EmptyState title="언급이 없습니다" /> : mentions.map((item) => <Link key={item.id} to={`/posts/${item.post.id}${item.source_type === 'comment' ? '#comments' : ''}`} className="block rounded-md border bg-white p-3 text-sm">{item.post.title}</Link>)}</section> : null}
    {cursor && !tabLoading ? <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="w-full rounded-md border bg-white p-2 text-sm font-bold">{loadingMore ? '불러오는 중...' : '더 보기'}</button> : null}
  </div>;
}
