import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, ApiNetworkError } from '../api/client';
import {
  getUserNotifications,
  markNotificationsRead,
} from '../api/notificationsApi';
import type { ApiNotificationItem } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';

export const NOTIFICATIONS_CHANGE_EVENT = 'feed-prototype-notifications-change';

type UseNotificationsOptions = {
  limit?: number;
  unreadOnly?: boolean;
};

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}.`;
  }
  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return 'Your API user or account was not found in the backend database.';
    }
    return `Could not load notifications. The backend returned ${error.status}.`;
  }
  return 'Could not load notifications.';
}

function dispatchNotificationsChange() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGE_EVENT));
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { activeApiUserId } = useActiveApiUser();
  const limit = options.limit ?? 5;
  const unreadOnly = options.unreadOnly ?? false;
  const [items, setItems] = useState<ApiNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!activeApiUserId) {
        setItems([]);
        setUnreadCount(0);
        setLastReadAt(null);
        setNextCursor(null);
        setHasMore(false);
        setError('');
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const response = await getUserNotifications(activeApiUserId, {
          cursor,
          limit,
          unreadOnly,
        });
        setItems((current) =>
          append ? [...current, ...response.items] : response.items,
        );
        setUnreadCount(response.unread_count);
        setLastReadAt(response.last_read_at);
        setNextCursor(response.next_cursor);
        setHasMore(response.has_more);
      } catch (loadError) {
        if (!append) {
          setItems([]);
          setUnreadCount(0);
          setNextCursor(null);
          setHasMore(false);
        }
        setError(getLoadErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    },
    [activeApiUserId, limit, unreadOnly],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    };

    window.addEventListener(NOTIFICATIONS_CHANGE_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGE_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [load]);

  const refresh = useCallback(() => load(), [load]);
  const loadMore = useCallback(() => {
    if (!nextCursor || isLoading) {
      return Promise.resolve();
    }
    return load(nextCursor, true);
  }, [isLoading, load, nextCursor]);

  const markAllRead = useCallback(async () => {
    if (!activeApiUserId) {
      return;
    }
    setIsMarkingRead(true);
    setError('');
    try {
      const state = await markNotificationsRead(activeApiUserId);
      setUnreadCount(state.unread_count);
      setLastReadAt(state.last_read_at);
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      dispatchNotificationsChange();
    } catch (markError) {
      setError(getLoadErrorMessage(markError));
    } finally {
      setIsMarkingRead(false);
    }
  }, [activeApiUserId]);

  return {
    activeApiUserId,
    items,
    unreadCount,
    lastReadAt,
    nextCursor,
    hasMore,
    isLoading,
    isMarkingRead,
    error,
    refresh,
    loadMore,
    markAllRead,
  };
}
