import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getBookmark, updateBookmarkNote } from '../api/bookmarksApi';
import { getApiBaseUrl } from '../config/apiConfig';
import { useBookmarks } from '../hooks/useBookmarks';
import BookmarkButton from './BookmarkButton';

type BookmarkPanelProps = {
  postId: string;
};

const MAX_NOTE_LENGTH = 2000;

function getNoteErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}.`;
  }
  if (error instanceof ApiClientError) {
    return error.message;
  }
  return 'Could not save the note.';
}

/**
 * PostDetail bookmark control (v0.5.1): toggle + a private note editor shown
 * while the post is bookmarked. The note (annotation) is visible only to the
 * owner. API mode only — PostDetail gates rendering.
 */
export default function BookmarkPanel({ postId }: BookmarkPanelProps) {
  const { activeApiUserId, isBookmarked } = useBookmarks();
  const bookmarked = isBookmarked(postId);

  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Load the existing note whenever the post becomes bookmarked.
  useEffect(() => {
    let isMounted = true;

    const loadNote = async () => {
      if (!activeApiUserId || !bookmarked) {
        if (isMounted) {
          setNote('');
          setSavedNote('');
          setError('');
        }
        return;
      }

      try {
        const bookmark = await getBookmark(activeApiUserId, postId);
        if (isMounted) {
          setNote(bookmark.note ?? '');
          setSavedNote(bookmark.note ?? '');
        }
      } catch {
        // A freshly added bookmark may 404 if not yet visible; leave note empty.
        if (isMounted) {
          setNote('');
          setSavedNote('');
        }
      }
    };

    void loadNote();

    return () => {
      isMounted = false;
    };
  }, [activeApiUserId, bookmarked, postId]);

  const handleSaveNote = useCallback(async () => {
    if (!activeApiUserId || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const trimmed = note.trim();
      const updated = await updateBookmarkNote(
        activeApiUserId,
        postId,
        trimmed ? trimmed : null,
      );
      setSavedNote(updated.note ?? '');
      setNote(updated.note ?? '');
    } catch (saveError) {
      setError(getNoteErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }, [activeApiUserId, isSaving, note, postId]);

  if (!activeApiUserId) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-neutral-950">Bookmark</h2>
        <BookmarkButton postId={postId} />
      </div>

      {bookmarked ? (
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase text-neutral-400">
            Private note
          </label>
          <textarea
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            placeholder="Add a private note (only you can see this)..."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              disabled={isSaving || note.trim() === savedNote.trim()}
              onClick={handleSaveNote}
            >
              {isSaving ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs font-medium text-neutral-400">
          Bookmark this post to save it and add a private note.
        </p>
      )}
    </section>
  );
}
