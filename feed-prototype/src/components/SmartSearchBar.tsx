import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { getAccount, searchAccounts } from '../api/accountsApi';
import { getPlaces } from '../api/placesApi';
import { getTags } from '../api/tagsApi';
import type { ApiAccount } from '../api/types';
import type { PostFilters } from '../types/filters';

type Person = NonNullable<PostFilters['people']>[number];
type Suggestion = { kind: 'person'; account: ApiAccount } | { kind: 'tag'; value: string } | { kind: 'place'; value: string };
export type SmartSearchDraft = { input: string; tags: string[]; people: Person[]; place: string; scope: 'all' | 'feed' };
type Props = { filters: PostFilters; initialDraft?: SmartSearchDraft; onApply: (value: PostFilters) => void; onAdvanced: (draft: SmartSearchDraft) => void; showScope?: boolean };

function tokensOf(value: string): { tokens: string[]; error: string } {
  const tokens: string[] = []; let current = ''; let quoted = false;
  for (const char of value) {
    if (char === '"' && current.startsWith('장소:')) quoted = !quoted;
    if (/\s/u.test(char) && !quoted) { if (current) tokens.push(current); current = ''; }
    else current += char;
  }
  if (current) tokens.push(current);
  const malformedPlace = tokens.some((token) => token.startsWith('장소:') && token.includes('"') && !/^장소:"[^"]*"$/u.test(token));
  return { tokens, error: quoted || malformedPlace ? '장소의 큰따옴표를 올바르게 닫아 주세요.' : '' };
}

function tokenKind(token: string): 'person' | 'tag' | 'place' | null {
  if (token.startsWith('@')) return 'person';
  if (token.startsWith('#')) return 'tag';
  if (token.startsWith('장소:')) return 'place';
  return null;
}

function tokenValue(token: string): string {
  const kind = tokenKind(token);
  const raw = kind === 'place' ? token.slice(3) : token.slice(1);
  return raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2 ? raw.slice(1, -1) : raw;
}

export default function SmartSearchBar({ filters, initialDraft, onApply, onAdvanced, showScope = false }: Props) {
  const id = useId(); const inputRef = useRef<HTMLInputElement>(null); const composing = useRef(false);
  const [input, setInput] = useState(initialDraft?.input ?? filters.keyword ?? '');
  const [tags, setTags] = useState(initialDraft?.tags ?? [filters.tag, ...(filters.tags ?? [])].filter((value): value is string => Boolean(value)));
  const [people, setPeople] = useState<Person[]>(initialDraft?.people ?? filters.people ?? []);
  const [place, setPlace] = useState(initialDraft?.place ?? filters.place ?? '');
  const [scope, setScope] = useState<'all' | 'feed'>(initialDraft?.scope ?? filters.scope ?? 'all');
  const [accounts, setAccounts] = useState<Record<string, ApiAccount>>({});
  const [suggestionResult, setSuggestionResult] = useState<{ key: string; items: Suggestion[] }>({ key: '', items: [] });
  const [open, setOpen] = useState(false); const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false); const [suggestionError, setSuggestionError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  useEffect(() => {
    let current = true;
    void Promise.all(people.map((person) => getAccount(person.accountId).catch(() => null))).then((items) => {
      if (current) setAccounts(Object.fromEntries(items.filter((item): item is ApiAccount => item !== null).map((item) => [item.id, item])));
    });
    return () => { current = false; };
  }, [people]);

  const { tokens } = tokensOf(input);
  const activeToken = tokens.find((token) => tokenKind(token) === 'person') ?? [...tokens].reverse().find((token) => tokenKind(token) !== null);
  const kind = activeToken ? tokenKind(activeToken) : null;
  const query = activeToken ? tokenValue(activeToken).replace(/^"/, '') : '';
  const suggestionKey = `${kind ?? ''}:${query}`;
  const suggestions = suggestionResult.key === suggestionKey ? suggestionResult.items : [];
  const appliedTags = [filters.tag, ...(filters.tags ?? [])].filter((value): value is string => Boolean(value));
  const hasPendingDraft = input !== (filters.keyword ?? '') || JSON.stringify(tags) !== JSON.stringify(appliedTags)
    || JSON.stringify(people) !== JSON.stringify(filters.people ?? []) || place !== (filters.place ?? '');

  useEffect(() => {
    let current = true;
    if (!open || !kind) return;
    const statusTimer = window.setTimeout(() => { if (current) { setLoading(true); setSuggestionError(false); } }, 0);
    const timer = window.setTimeout(() => {
      const request = kind === 'person' ? searchAccounts({ keyword: query, limit: 8 }).then((page): Suggestion[] => page.items.map((item) => ({ kind: 'person', account: item.account })))
        : kind === 'tag' ? getTags(8, query).then((items): Suggestion[] => items.map((item) => ({ kind: 'tag', value: item.tag })))
          : getPlaces(query, 8).then((items): Suggestion[] => items.map((item) => ({ kind: 'place', value: item.value })));
      void request.then((items) => { if (current) { setSuggestionResult({ key: suggestionKey, items }); setActive(-1); setLoading(false); } })
        .catch(() => { if (current) { setSuggestionResult({ key: suggestionKey, items: [] }); setSuggestionError(true); setLoading(false); } });
    }, 250);
    return () => { current = false; window.clearTimeout(statusTimer); window.clearTimeout(timer); };
  }, [open, kind, query, retryTick, suggestionKey]);

  const select = (item: Suggestion) => {
    if (item.kind === 'person') {
      if (people.some((person) => person.accountId === item.account.id)) { setError('이미 추가한 인물입니다.'); return; }
      if (people.length >= 5) { setError('인물은 최대 5명까지 선택할 수 있습니다.'); return; }
      setPeople((current) => [...current, { accountId: item.account.id, mode: 'related' }]);
      setAccounts((current) => ({ ...current, [item.account.id]: item.account }));
    } else if (item.kind === 'tag') {
      if (tags.some((tag) => tag.toLowerCase() === item.value.toLowerCase())) { setError('이미 추가한 태그입니다.'); return; }
      if (tags.length >= 5) { setError('태그는 최대 5개까지 선택할 수 있습니다.'); return; }
      setTags((current) => [...current, item.value]);
    } else {
      if (place) setNotice('이전 장소를 새 장소로 교체했습니다.');
      setPlace(item.value);
    }
    if (activeToken) setInput((value) => value.replace(activeToken, '').replace(/\s+/g, ' ').trim());
    setError(''); setOpen(false); setActive(-1); inputRef.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault(); if (composing.current) return;
    const parsed = tokensOf(input);
    if (parsed.error) { setError(parsed.error); return; }
    const nextTags = [...tags]; let nextPlace = place; const words: string[] = [];
    for (const token of parsed.tokens) {
      const tokenType = tokenKind(token); const value = tokenValue(token).trim();
      if (tokenType === 'person') { setError(value ? `@${value} 인물을 후보에서 선택해 주세요.` : '인물을 선택해 주세요.'); return; }
      if (tokenType && !value) { setError('완성되지 않은 태그나 장소 조건이 있습니다.'); return; }
      if (tokenType === 'tag') {
        if (nextTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) { setError('같은 태그가 중복되었습니다.'); return; }
        nextTags.push(value);
      } else if (tokenType === 'place') {
        if (nextPlace) setNotice('이전 장소를 새 장소로 교체했습니다.');
        nextPlace = value;
      } else words.push(token);
    }
    if (nextTags.length > 5) { setError('태그는 최대 5개까지 선택할 수 있습니다.'); return; }
    setError(''); setOpen(false);
    onApply({ ...filters, keyword: words.join(' '), tag: nextTags[0] ?? '', tags: nextTags.slice(1), people, place: nextPlace, scope });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return; }
    if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setOpen(true); setActive((value) => (value + 1) % suggestions.length); }
    if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setOpen(true); setActive((value) => value <= 0 ? suggestions.length - 1 : value - 1); }
    if (event.key === 'Escape') { setOpen(false); setActive(-1); }
    if (event.key === 'Enter' && open && active >= 0 && suggestions[active]) { event.preventDefault(); select(suggestions[active]); }
  };

  return <form className="space-y-2" onSubmit={submit} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
    <div className="flex gap-2"><div className="relative min-w-0 flex-1">
      <input ref={inputRef} role="combobox" aria-label="게시글 검색" aria-expanded={open && Boolean(kind)} aria-controls={open && kind && suggestions.length ? `${id}-list` : undefined} aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined} value={input} onChange={(event) => { setInput(event.target.value); setOpen(true); setError(''); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown} placeholder="키워드, @인물, #태그, 장소:서울숲"
        className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-neutral-300" />
      {open && kind ? <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border bg-white shadow-lg">
        <p className="px-3 py-1 text-xs text-neutral-500" aria-live="polite">{loading ? '후보를 찾는 중...' : suggestionError ? <>후보를 불러오지 못했습니다. <button type="button" className="underline" onClick={() => setRetryTick((value) => value + 1)}>다시 시도</button></> : suggestions.length ? '후보를 선택하면 조건이 추가됩니다.' : '일치하는 후보가 없습니다.'}</p>
        {suggestions.length > 0 ? <ul id={`${id}-list`} role="listbox" className="max-h-52 overflow-auto">{suggestions.map((item, index) => <li key={item.kind === 'person' ? item.account.id : item.value} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-100" onMouseDown={(event) => event.preventDefault()} onClick={() => select(item)}>
          {item.kind === 'person' ? <>{item.account.avatar_url ? <img src={item.account.avatar_url} alt="" className="size-6 rounded-full" /> : null}{item.account.display_name} <span className="text-neutral-500">@{item.account.handle}</span></> : item.kind === 'tag' ? `#${item.value}` : `장소: ${item.value}`}
        </li>)}</ul> : null}
      </div> : null}
    </div><button type="submit" className="rounded-md bg-neutral-950 px-4 text-sm font-bold text-white">검색</button></div>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-neutral-500">조건:</span>
      {(['person', 'tag', 'place'] as const).map((item) => <button key={item} type="button" className="rounded-full border bg-white px-2 py-1" onClick={() => { setInput((value) => `${value.trim()} ${item === 'person' ? '@' : item === 'tag' ? '#' : '장소:'}`.trim()); setOpen(true); inputRef.current?.focus(); }}>{item === 'person' ? '인물' : item === 'tag' ? '태그' : '장소'} 선택</button>)}
      <button type="button" className="font-semibold underline" onClick={() => onAdvanced({ input, tags, people, place, scope })}>상세 조건</button>
    </div>
    <div className="flex flex-wrap gap-2">
      {people.map((person) => <span key={person.accountId} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs">
        @{accounts[person.accountId]?.handle ?? person.accountId}
        <Link to={`/accounts/${encodeURIComponent(person.accountId)}`} className="underline" aria-label={`${accounts[person.accountId]?.display_name ?? person.accountId} 프로필 보기`}>프로필</Link>
        <select aria-label={`${accounts[person.accountId]?.display_name ?? person.accountId} 검색 방식`} value={person.mode} onChange={(event) => setPeople((current) => current.map((item) => item.accountId === person.accountId ? { ...item, mode: event.target.value as Person['mode'] } : item))} className="bg-transparent">
          <option value="related">관련 전체</option><option value="authored">작성한 글</option><option value="mentioned_tagged">태그·멘션된 글</option>
        </select><button type="button" aria-label="인물 조건 삭제" onClick={() => setPeople((current) => current.filter((item) => item.accountId !== person.accountId))}>×</button>
      </span>)}
      {tags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-2 py-1 text-xs">#{tag} <button type="button" aria-label={`${tag} 태그 수정`} onClick={() => { setTags((current) => current.filter((item) => item !== tag)); setInput((value) => `${value.trim()} #${tag}`.trim()); setOpen(true); inputRef.current?.focus(); }}>수정</button> <button type="button" aria-label={`${tag} 태그 삭제`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>×</button></span>)}
      {place ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs">장소: {place} <button type="button" aria-label="장소 수정" onClick={() => { setInput((value) => `${value.trim()} 장소:"${place}"`.trim()); setPlace(''); setOpen(true); inputRef.current?.focus(); }}>수정</button> <button type="button" aria-label="장소 삭제" onClick={() => setPlace('')}>×</button></span> : null}
      {(people.length > 0 || tags.length > 0 || place || input) ? <button type="button" className="text-xs underline" onClick={() => { setInput(''); setPeople([]); setTags([]); setPlace(''); setScope('all'); setNotice(''); setError(''); }}>입력 조건 모두 지우기</button> : null}
    </div>
    {showScope ? <label className="flex items-center gap-2 text-xs font-semibold">검색 범위 <select aria-label="검색 범위" value={scope} onChange={(event) => { const next = event.target.value as 'all' | 'feed'; setScope(next); if (hasPendingDraft) setNotice('입력 중인 조건과 범위는 검색을 누르면 함께 적용됩니다.'); else onApply({ ...filters, scope: next }); }} className="rounded border bg-white px-2 py-1"><option value="all">전체 게시글</option><option value="feed">내 피드</option></select></label> : <p className="text-xs text-neutral-500">검색 범위: 전체 게시글</p>}
    {notice ? <p className="text-xs text-neutral-600" aria-live="polite">{notice}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </form>;
}
