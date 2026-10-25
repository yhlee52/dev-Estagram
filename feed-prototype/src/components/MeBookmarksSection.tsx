import { useEffect, useState } from 'react';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getUserBookmarks, updateBookmarkNote } from '../api/bookmarksApi';
import type { ApiBookmarkedPost } from '../api/types';
import { getApiBaseUrl } from '../config/apiConfig';
import {
  mapApiAccountToAccount,
  mapApiPostToPost,
} from '../data/apiFeedRepository';
import { useBookmarks } from '../hooks/useBookmarks';
import EmptyState from './EmptyState';
import FeedCard from './FeedCard';

type MeBookmarksSectionProps = {
  userId: string;
};

const MAX_NOTE_LENGTH = 2000;

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다.`;
  }
  if (error instanceof ApiClientError) {
    return `저장한 글을 불러오지 못했습니다. (${error.status})`;
  }
  return '저장한 글을 불러오지 못했습니다.';
}

/** One bookmarked post: the card plus an inline private-note editor. */
function BookmarkRow({
  item,
  userId,
}: {
  item: ApiBookmarkedPost;
  userId: string;
}) {
  const [note, setNote] = useState(item.note ?? '');
  const [savedNote, setSavedNote] = useState(item.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const feedItem = {
    post: mapApiPostToPost(item.post, item.post.assets),
    account: mapApiAccountToAccount(item.account),
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const trimmed = note.trim();
      const updated = await updateBookmarkNote(
        userId,
        item.post.id,
        trimmed ? trimmed : null,
      );
      setSavedNote(updated.note ?? '');
      setNote(updated.note ?? '');
    } catch {
      setError('메모를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <FeedCard item={feedItem} />
      <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <label className="block text-xs font-bold uppercase text-neutral-400">
          나만 볼 수 있는 메모
        </label>
        <textarea
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950"
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="나만 볼 수 있는 메모를 입력하세요..."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? (
          <p className="text-xs font-semibold text-red-700">{error}</p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-md bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={isSaving || note.trim() === savedNote.trim()}
            onClick={handleSave}
          >
            {isSaving ? '저장하는 중...' : '메모 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Me tab "Bookmarks" section (v0.5.1): the active user's bookmarked posts with
 * inline private notes. Items the user un-bookmarks (via the card toggle) drop
 * out immediately by intersecting with the live bookmark set.
 */
export default function MeBookmarksSection({ userId }: MeBookmarksSectionProps) {
  const { isBookmarked } = useBookmarks();
  const [items, setItems] = useState<ApiBookmarkedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadBookmarks = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await getUserBookmarks(userId);
        if (isMounted) {
          setItems(response.items);
          setCursor(response.next_cursor);
        }
      } catch (loadError) {
        if (isMounted) {
          setItems([]);
          setCursor(null);
          setError(getLoadErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadBookmarks();

    return () => {
      isMounted = false;
    };
  }, [userId, retryCount]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getUserBookmarks(userId, undefined, { cursor });
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.post.id === item.post.id))]);
      setCursor(page.next_cursor);
    } catch (loadError) {
      setError(getLoadErrorMessage(loadError));
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleItems = items.filter((item) => isBookmarked(item.post.id));

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <h2 className="text-sm font-bold text-neutral-950">저장한 글</h2>
        <span className="text-xs font-medium text-neutral-400">최신순</span>
      </div>

      {error ? <div role="alert" className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
        {error} <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="ml-2 underline">다시 시도</button>
      </div> : null}
      {isLoading ? (
        <p role="status" className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          저장한 글을 불러오는 중...
        </p>
      ) : visibleItems.length > 0 ? (
        <div className="space-y-4">
          {visibleItems.map((item) => (
            <BookmarkRow key={item.post.id} item={item} userId={userId} />
          ))}
        </div>
      ) : !error ? (
        <EmptyState
          title="저장한 글이 없습니다"
          description="게시글을 저장하면 여기에 표시되고 나만 볼 수 있는 메모를 남길 수 있습니다."
        />
      ) : null}
      {cursor && !isLoading ? <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="w-full rounded-md border bg-white p-2 text-sm font-bold">{loadingMore ? '불러오는 중...' : '더 보기'}</button> : null}
    </section>
  );
}
