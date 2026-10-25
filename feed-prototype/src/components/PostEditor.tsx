import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getAccount, searchAccounts } from '../api/accountsApi';
import type { ApiAccount, ApiAssetType, ApiMetadata, ApiPostAssetPayload } from '../api/types';
import type { Post } from '../types/feed';

export type PostEditorValues = {
  title: string;
  text: string;
  tags: string[];
  metadata_json: ApiMetadata | null;
  assets: ApiPostAssetPayload[];
  tagged_account_ids: string[];
};

type MetadataDraft = {
  id: string;
  key: string;
  value: string;
};

type AssetDraft = {
  id: string;
  type: ApiAssetType;
  url: string;
  title: string;
  description: string;
};

type PostEditorProps = {
  mode: 'create' | 'edit';
  initialPost?: Post;
  isSubmitting: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (values: PostEditorValues) => void | Promise<void>;
};

const assetTypes: ApiAssetType[] = ['image', 'plot', 'table', 'file', 'link'];

const createDraftId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const parseTags = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );

const metadataDisplayValue = (value: unknown): string =>
  typeof value === 'string' ? value : value === null ? '' : JSON.stringify(value);

const metadataToDrafts = (metadata: Post['metadata']): MetadataDraft[] =>
  Object.entries(metadata ?? {}).filter(([key]) => key !== 'location').map(([key, value]) => ({
    id: createDraftId('metadata'),
    key,
    value: metadataDisplayValue(value),
  }));

const hasDraftInput = (...values: string[]): boolean =>
  values.some((value) => value.trim().length > 0);

const postAssetsToDrafts = (post: Post | undefined): AssetDraft[] =>
  (post?.assets ?? [])
    .filter((asset) => asset.type === 'image' || asset.type === 'plot' || asset.type === 'table' || asset.type === 'file' || asset.type === 'link')
    .map((asset) => ({
      id: asset.id ?? createDraftId('asset'),
      type: asset.type as ApiAssetType,
      url: asset.url ?? asset.src ?? '',
      title: asset.title ?? '',
      description: asset.description ?? '',
    }));

export default function PostEditor({
  mode,
  initialPost,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: PostEditorProps) {
  const [title, setTitle] = useState(initialPost?.title ?? '');
  const [text, setText] = useState(initialPost?.text ?? initialPost?.caption ?? '');
  const [tagsInput, setTagsInput] = useState((initialPost?.tags ?? []).join(', '));
  const originalLocation = (initialPost?.metadata_json ?? initialPost?.metadata)?.location;
  const [location, setLocation] = useState(typeof originalLocation === 'string' ? originalLocation : '');
  const [locationTouched, setLocationTouched] = useState(false);
  const [taggedAccountIds, setTaggedAccountIds] = useState<string[]>(initialPost?.taggedAccountIds ?? []);
  const [taggedAccounts, setTaggedAccounts] = useState<Record<string, ApiAccount>>({});
  const [personQuery, setPersonQuery] = useState('');
  const [personMatches, setPersonMatches] = useState<ApiAccount[]>([]);
  const [personSearch, setPersonSearch] = useState<{ query: string; state: 'loading' | 'ready' | 'error' }>({ query: '', state: 'ready' });
  const [assetDrafts, setAssetDrafts] = useState<AssetDraft[]>(
    postAssetsToDrafts(initialPost),
  );
  const [metadataDrafts, setMetadataDrafts] = useState<MetadataDraft[]>(
    metadataToDrafts(initialPost?.metadata ?? initialPost?.metadata_json),
  );
  const [assetDraft, setAssetDraft] = useState<AssetDraft>({
    id: createDraftId('asset-input'),
    type: 'image',
    url: '',
    title: '',
    description: '',
  });
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>({
    id: createDraftId('metadata-input'),
    key: '',
    value: '',
  });
  const [localError, setLocalError] = useState('');

  const submitLabel = mode === 'create' ? '게시하기' : '변경 사항 저장';
  const pendingLabel = mode === 'create' ? '게시하는 중...' : '저장하는 중...';
  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  useEffect(() => {
    let active = true;
    void Promise.all(taggedAccountIds.map((id) => getAccount(id).catch(() => null))).then((accounts) => {
      if (active) setTaggedAccounts(Object.fromEntries(accounts.filter((account): account is ApiAccount => account !== null).map((account) => [account.id, account])));
    });
    return () => { active = false; };
  }, [taggedAccountIds]);

  useEffect(() => {
    let active = true;
    const query = personQuery.trim();
    if (!query) return;
    const timer = window.setTimeout(() => {
      setPersonSearch({ query, state: 'loading' });
      void searchAccounts({ keyword: query, limit: 8 }).then((page) => {
        if (active) { setPersonMatches(page.items.map((item) => item.account)); setPersonSearch({ query, state: 'ready' }); }
      }).catch(() => { if (active) { setPersonMatches([]); setPersonSearch({ query, state: 'error' }); } });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [personQuery]);

  const addAsset = () => {
    const url = assetDraft.url.trim();

    if (!url) {
      setLocalError('첨부 자료 URL을 입력해 주세요.');
      return;
    }

    setAssetDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        ...assetDraft,
        id: createDraftId('asset'),
        url,
        title: assetDraft.title.trim(),
        description: assetDraft.description.trim(),
      },
    ]);
    setAssetDraft({
      id: createDraftId('asset-input'),
      type: 'image',
      url: '',
      title: '',
      description: '',
    });
    setLocalError('');
  };

  const addMetadata = () => {
    const key = metadataDraft.key.trim();

    if (!key) {
      setLocalError('추가 정보 항목을 입력해 주세요.');
      return;
    }
    if (key === 'location') {
      setLocalError('장소는 위의 장소 입력칸에서 설정해 주세요.');
      return;
    }

    setMetadataDrafts((currentDrafts) => {
      const nextDraft = {
        id: createDraftId('metadata'),
        key,
        value: metadataDraft.value.trim(),
      };
      const existingIndex = currentDrafts.findIndex(
        (draft) => draft.key.trim() === key,
      );

      if (existingIndex === -1) {
        return [...currentDrafts, nextDraft];
      }

      return currentDrafts.map((draft, index) =>
        index === existingIndex ? nextDraft : draft,
      );
    });
    setMetadataDraft({
      id: createDraftId('metadata-input'),
      key: '',
      value: '',
    });
    setLocalError('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setLocalError('제목을 입력해 주세요.');
      return;
    }
    if (personQuery.trim()) {
      setLocalError('입력 중인 인물은 후보에서 선택하거나 지워 주세요.');
      return;
    }

    if (
      hasDraftInput(
        assetDraft.url,
        assetDraft.title,
        assetDraft.description,
      )
    ) {
      setLocalError('입력 중인 첨부 자료를 추가하거나 지워 주세요.');
      return;
    }

    if (hasDraftInput(metadataDraft.key, metadataDraft.value)) {
      setLocalError('입력 중인 추가 정보를 추가하거나 지워 주세요.');
      return;
    }

    const metadataEntries = metadataDrafts
      .map((draft) => [draft.key.trim(), draft.value.trim()] as const)
      .filter(([key]) => key);
    const metadataKeys = metadataEntries.map(([key]) => key);
    if (metadataKeys.includes('location')) {
      setLocalError('장소는 장소 입력칸에서 설정해 주세요.');
      return;
    }
    const duplicateMetadataKey = metadataKeys.find(
      (key, index) => metadataKeys.indexOf(key) !== index,
    );

    if (duplicateMetadataKey) {
      setLocalError(`추가 정보 항목 "${duplicateMetadataKey}"이(가) 중복되었습니다.`);
      return;
    }

    const originalMetadata = initialPost?.metadata_json ?? initialPost?.metadata ?? {};
    const metadata_json = Object.fromEntries(metadataEntries.map(([key, value]) => [key,
      Object.prototype.hasOwnProperty.call(originalMetadata, key) && metadataDisplayValue(originalMetadata[key]) === value
        ? originalMetadata[key] : value,
    ])) as ApiMetadata;
    if (location.trim()) metadata_json.location = location.trim();
    else if (!locationTouched && originalLocation !== undefined) metadata_json.location = originalLocation;
    const assets = assetDrafts
      .map((draft) => ({
        type: draft.type,
        url: draft.url.trim(),
        title: draft.title.trim() || null,
        description: draft.description.trim() || null,
      }))
      .filter((asset) => asset.url);

    setLocalError('');
    void onSubmit({
      title: trimmedTitle,
      text: text.trim(),
      tags,
      metadata_json: Object.keys(metadata_json).length ? metadata_json : null,
      assets,
      tagged_account_ids: taggedAccountIds,
    });
  };

  return (
    <form
      className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="space-y-1.5">
        <label
          className="block text-xs font-bold uppercase text-neutral-400"
          htmlFor="post-title"
        >
          제목
        </label>
        <input
          id="post-title"
          className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-400"
          maxLength={200}
          aria-invalid={Boolean((error || localError) && !title.trim())}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <p className="text-xs font-medium text-neutral-400">{title.length}/200</p>
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-xs font-bold uppercase text-neutral-400"
          htmlFor="post-text"
        >
          본문
        </label>
        <textarea
          id="post-text"
          className="min-h-36 w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-950 outline-none transition focus:border-neutral-400"
          maxLength={5000}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="text-xs font-medium text-neutral-400">{text.length}/5000</p>
        <p className="text-xs leading-5 text-neutral-400">
          본문은 비워 둘 수 있습니다. 제목만 필수입니다.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-xs font-bold uppercase text-neutral-400"
          htmlFor="post-tags"
        >
          태그
        </label>
        <input
          id="post-tags"
          className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="daily-report, temperature"
        />
        <p className="text-xs leading-5 text-neutral-400">
          쉼표로 등록 태그를 구분하세요. 본문의 #태그는 자동으로 등록되지 않습니다.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="post-location" className="block text-xs font-bold text-neutral-600">장소</label>
        <input id="post-location" value={location} maxLength={120} onChange={(event) => { setLocation(event.target.value); setLocationTouched(true); }}
          placeholder="예: 서울숲" className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm" />
        {originalLocation !== undefined && typeof originalLocation !== 'string' ? <p className="text-xs text-amber-700">기존 장소 값이 문자열이 아닙니다. 장소를 바꾸지 않으면 원값을 유지합니다.</p> : null}
      </div>

      <section className="space-y-2" aria-label="인물 태그">
        <label htmlFor="post-person-tag" className="block text-xs font-bold text-neutral-600">인물 태그 (최대 5명)</label>
        <input id="post-person-tag" value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} placeholder="표시 이름 또는 @아이디로 찾기"
          className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm" />
        {personQuery.trim() && personSearch.query === personQuery.trim() && personSearch.state === 'ready' && personMatches.length > 0 ? <ul className="max-h-40 overflow-auto rounded-md border bg-white">
          {personMatches.map((account) => <li key={account.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100" onClick={() => {
            if (taggedAccountIds.includes(account.id)) { setLocalError('이미 태그한 인물입니다.'); return; }
            if (taggedAccountIds.length >= 5) { setLocalError('인물은 최대 5명까지 태그할 수 있습니다.'); return; }
            setTaggedAccountIds((ids) => [...ids, account.id]); setPersonQuery(''); setPersonMatches([]); setLocalError('');
          }}>{account.display_name} · @{account.handle}</button></li>)}
        </ul> : null}
        {personQuery.trim() ? <p className="text-xs text-neutral-500" aria-live="polite">{personSearch.query !== personQuery.trim() || personSearch.state === 'loading' ? '인물 후보를 찾는 중...' : personSearch.state === 'error' ? '인물 후보를 불러오지 못했습니다. 다시 입력해 주세요.' : personMatches.length === 0 ? '일치하는 인물이 없습니다.' : '후보를 선택하면 태그에 추가됩니다.'}</p> : null}
        <ul className="flex flex-wrap gap-2">{taggedAccountIds.map((id) => <li key={id} className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
          {taggedAccounts[id]?.display_name ?? id} <button type="button" aria-label={`${taggedAccounts[id]?.display_name ?? id} 태그 제거`} onClick={() => setTaggedAccountIds((ids) => ids.filter((value) => value !== id))}>×</button>
        </li>)}</ul>
      </section>

      <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-neutral-950">첨부 자료</h2>
          <span className="text-xs font-semibold text-neutral-400">
            {assetDrafts.length}
          </span>
        </div>

        <div className="grid gap-2">
          <select
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800"
            value={assetDraft.type}
            onChange={(event) =>
              setAssetDraft((draft) => ({
                ...draft,
                type: event.target.value as ApiAssetType,
              }))
            }
          >
            {assetTypes.map((assetType) => (
              <option key={assetType} value={assetType}>
                {({ image: '사진', plot: '그래프', table: '표', file: '파일', link: '링크' } as Record<ApiAssetType, string>)[assetType]}
              </option>
            ))}
          </select>
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={assetDraft.url}
            onChange={(event) =>
              setAssetDraft((draft) => ({ ...draft, url: event.target.value }))
            }
            placeholder="/assets/sample.png 또는 https://..."
          />
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={assetDraft.title}
            onChange={(event) =>
              setAssetDraft((draft) => ({ ...draft, title: event.target.value }))
            }
            placeholder="첨부 자료 제목"
          />
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={assetDraft.description}
            onChange={(event) =>
              setAssetDraft((draft) => ({
                ...draft,
                description: event.target.value,
              }))
            }
            placeholder="첨부 자료 설명"
          />
          <button
            type="button"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800"
            onClick={addAsset}
          >
            첨부 자료 추가
          </button>
        </div>
        <p className="text-xs leading-5 text-neutral-400">
          유형과 URL을 입력해 주세요. 파일 업로드 대신 URL이나 로컬 자산 경로를 저장합니다.
        </p>

        {assetDrafts.length > 0 ? (
          <div className="space-y-2">
            {assetDrafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-950">
                      {draft.title || '첨부 자료'}
                    </p>
                    <p className="break-all text-xs font-medium text-neutral-500">
                      {draft.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs font-bold text-neutral-600"
                    onClick={() =>
                      setAssetDrafts((currentDrafts) =>
                        currentDrafts.filter((item) => item.id !== draft.id),
                      )
                    }
                  >
                    제거
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-neutral-950">추가 정보</h2>
          <span className="text-xs font-semibold text-neutral-400">
            {metadataDrafts.length}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={metadataDraft.key}
            onChange={(event) =>
              setMetadataDraft((draft) => ({ ...draft, key: event.target.value }))
            }
            placeholder="항목"
          />
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={metadataDraft.value}
            onChange={(event) =>
              setMetadataDraft((draft) => ({ ...draft, value: event.target.value }))
            }
            placeholder="값"
          />
          <button
            type="button"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 sm:col-span-2"
            onClick={addMetadata}
          >
            추가 정보 넣기
          </button>
        </div>
        <p className="text-xs leading-5 text-neutral-400">
          항목은 필수입니다. 같은 항목을 다시 추가하면 입력 중인 값을 교체합니다.
        </p>

        {metadataDrafts.length > 0 ? (
          <div className="space-y-2">
            {metadataDrafts.map((draft) => (
              <div
                key={draft.id}
                className="grid gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  className="h-9 min-w-0 rounded-md border border-neutral-200 px-2 text-sm font-semibold text-neutral-900"
                  value={draft.key}
                  onChange={(event) =>
                    setMetadataDrafts((currentDrafts) =>
                      currentDrafts.map((item) =>
                        item.id === draft.id
                          ? { ...item, key: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  className="h-9 min-w-0 rounded-md border border-neutral-200 px-2 text-sm text-neutral-900"
                  value={draft.value}
                  onChange={(event) =>
                    setMetadataDrafts((currentDrafts) =>
                      currentDrafts.map((item) =>
                        item.id === draft.id
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="h-9 rounded-md border border-neutral-200 px-2 text-xs font-bold text-neutral-600"
                  onClick={() =>
                    setMetadataDrafts((currentDrafts) =>
                      currentDrafts.filter((item) => item.id !== draft.id),
                    )
                  }
                >
                  제거
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {localError || error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {localError || error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h-11 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="submit"
          className="h-11 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
