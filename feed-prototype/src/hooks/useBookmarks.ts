import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, ApiNetworkError } from '../api/client';
import {
  addBookmark as addBookmarkApi,
  getUserBookmarkIds,
  removeBookmark as removeBookmarkApi,
} from '../api/bookmarksApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';

/**
 * Shared bookmark state (v0.5.1). A bookmark toggle sits on every post card, so
 * the active user's bookmarked post ids are cached at module scope and loaded
 * once; toggles update the cache and notify all hook instances via a custom
 * event (the same pattern as `apiActiveUser` / `usePinnedMetadataKeys`).
 */
const BOOKMARKS_CHANGE_EVENT = 'feed-prototype-bookmarks-change';

let cachedUserId: string | null = null;
let cachedIds = new Set<string>();
let inFlightUserId: string | null = null;

const dispatchBookmarksChange = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(BOOKMARKS_CHANGE_EVENT));
};

const idsForUser = (userId: string): Set<string> =>
  cachedUserId === userId ? new Set(cachedIds) : new Set();

async function ensureLoaded(userId: string, force = false): Promise<void> {
  if (!userId) {
    return;
  }
  if (!force && cachedUserId === userId) {
    return;
  }
  if (inFlightUserId === userId) {
    return;
  }

  inFlightUserId = userId;
  try {
    const response = await getUserBookmarkIds(userId);
    cachedUserId = userId;
    cachedIds = new Set(response.post_ids);
    dispatchBookmarksChange();
  } finally {
    inFlightUserId = null;
  }
}

function getToggleErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Could not update the bookmark because the backend API is unreachable at ${getApiBaseUrl()}.`;
  }
  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return 'Could not bookmark: the API user or post was not found in the backend database.';
    }
    return `Could not update the bookmark. The backend returned ${error.status}.`;
  }
  return 'Could not update the bookmark.';
}

export function useBookmarks() {
  const { activeApiUserId } = useActiveApiUser();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() =>
    idsForUser(activeApiUserId),
  );
  const [pendingPostId, setPendingPostId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sync = () => setBookmarkedIds(idsForUser(activeApiUserId));
    sync();

    window.addEventListener(BOOKMARKS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(BOOKMARKS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [activeApiUserId]);

  useEffect(() => {
    void ensureLoaded(activeApiUserId).catch(() => {
      /* surfaced lazily on the next toggle; cards just render un-bookmarked */
    });
  }, [activeApiUserId]);

  const isBookmarked = useCallback(
    (postId: string) => bookmarkedIds.has(postId),
    [bookmarkedIds],
  );

  const toggleBookmark = useCallback(
    async (postId: string) => {
      if (!activeApiUserId) {
        setError('Select an API user before bookmarking.');
        return;
      }

      const currentlyBookmarked = cachedIds.has(postId);
      setPendingPostId(postId);
      setError('');

      try {
        if (currentlyBookmarked) {
          await removeBookmarkApi(activeApiUserId, postId);
          cachedIds.delete(postId);
        } else {
          await addBookmarkApi(activeApiUserId, postId);
          cachedIds.add(postId);
        }
        cachedUserId = activeApiUserId;
        cachedIds = new Set(cachedIds);
        dispatchBookmarksChange();
      } catch (toggleError) {
        setError(getToggleErrorMessage(toggleError));
      } finally {
        setPendingPostId('');
      }
    },
    [activeApiUserId],
  );

  const refresh = useCallback(
    () => ensureLoaded(activeApiUserId, true),
    [activeApiUserId],
  );

  return {
    activeApiUserId,
    bookmarkedIds,
    isBookmarked,
    pendingPostId,
    error,
    toggleBookmark,
    refresh,
  };
}
