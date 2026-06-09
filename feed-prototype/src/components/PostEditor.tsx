import { useMemo, useState, type FormEvent } from 'react';
import type { ApiAssetType, ApiMetadata, ApiPostAssetPayload } from '../api/types';
import type { Post } from '../types/feed';

export type PostEditorValues = {
  title: string;
  text: string;
  tags: string[];
  metadata_json: ApiMetadata | null;
  assets: ApiPostAssetPayload[];
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

const metadataToDrafts = (metadata: Post['metadata']): MetadataDraft[] =>
  Object.entries(metadata ?? {}).map(([key, value]) => ({
    id: createDraftId('metadata'),
    key,
    value:
      typeof value === 'string' ? value : value === null ? '' : JSON.stringify(value),
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

  const submitLabel = mode === 'create' ? 'Publish Post' : 'Save Changes';
  const pendingLabel = mode === 'create' ? 'Publishing...' : 'Saving...';
  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  const addAsset = () => {
    const url = assetDraft.url.trim();

    if (!url) {
      setLocalError('Asset url is required.');
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
      setLocalError('Metadata key is required.');
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
      setLocalError('Title is required.');
      return;
    }

    if (
      hasDraftInput(
        assetDraft.url,
        assetDraft.title,
        assetDraft.description,
      )
    ) {
      setLocalError('Add or clear the pending asset before saving.');
      return;
    }

    if (hasDraftInput(metadataDraft.key, metadataDraft.value)) {
      setLocalError('Add or clear the pending metadata before saving.');
      return;
    }

    const metadataEntries = metadataDrafts
      .map((draft) => [draft.key.trim(), draft.value.trim()] as const)
      .filter(([key]) => key);
    const metadataKeys = metadataEntries.map(([key]) => key);
    const duplicateMetadataKey = metadataKeys.find(
      (key, index) => metadataKeys.indexOf(key) !== index,
    );

    if (duplicateMetadataKey) {
      setLocalError(`Metadata key "${duplicateMetadataKey}" is duplicated.`);
      return;
    }

    const metadata_json =
      metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : null;
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
      metadata_json,
      assets,
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
          Title
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
          Text
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
          Text can be empty in MVP9; title is the only required text field.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-xs font-bold uppercase text-neutral-400"
          htmlFor="post-tags"
        >
          Tags
        </label>
        <input
          id="post-tags"
          className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="daily-report, temperature"
        />
        <p className="text-xs leading-5 text-neutral-400">
          Comma-separated tags are trimmed; empty tags and duplicates are removed.
        </p>
      </div>

      <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-neutral-950">Assets</h2>
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
                {assetType}
              </option>
            ))}
          </select>
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={assetDraft.url}
            onChange={(event) =>
              setAssetDraft((draft) => ({ ...draft, url: event.target.value }))
            }
            placeholder="/assets/sample.png or https://..."
          />
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={assetDraft.title}
            onChange={(event) =>
              setAssetDraft((draft) => ({ ...draft, title: event.target.value }))
            }
            placeholder="Asset title"
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
            placeholder="Asset description"
          />
          <button
            type="button"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800"
            onClick={addAsset}
          >
            Add asset
          </button>
        </div>
        <p className="text-xs leading-5 text-neutral-400">
          Asset type and URL are required. MVP9 stores URL or local path strings only.
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
                      {draft.title || `${draft.type} asset`}
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
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-neutral-950">Metadata</h2>
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
            placeholder="Key"
          />
          <input
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-400"
            value={metadataDraft.value}
            onChange={(event) =>
              setMetadataDraft((draft) => ({ ...draft, value: event.target.value }))
            }
            placeholder="Value"
          />
          <button
            type="button"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 sm:col-span-2"
            onClick={addMetadata}
          >
            Add metadata
          </button>
        </div>
        <p className="text-xs leading-5 text-neutral-400">
          Metadata keys are required. Adding the same key replaces the existing draft.
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
                  Remove
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
          Cancel
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
