import { useCallback, useEffect, useState } from 'react';
import { getAuthSession, logout } from '../api/authApi';
import type { ApiUser } from '../api/types';

export const ACTIVE_API_USER_ID_STORAGE_KEY =
  'feed-prototype:active-api-user-id';
export const ACTIVE_API_USER_HANDLE_STORAGE_KEY =
  'feed-prototype:active-api-user-handle';

const ACTIVE_API_USER_EVENT = 'feed-prototype-active-api-user-change';

export interface ActiveApiUser {
  id: string;
  handle: string;
}

const dispatchActiveApiUserChange = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACTIVE_API_USER_EVENT));
};

export const getActiveApiUser = (): ActiveApiUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const id = window.localStorage.getItem(ACTIVE_API_USER_ID_STORAGE_KEY);
  const handle = window.localStorage.getItem(ACTIVE_API_USER_HANDLE_STORAGE_KEY);

  if (!id || !handle) {
    return null;
  }

  return { id, handle };
};

export const getActiveApiUserId = (): string => getActiveApiUser()?.id ?? '';

export const setActiveApiUser = (user: ApiUser) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACTIVE_API_USER_ID_STORAGE_KEY, user.id);
  window.localStorage.setItem(ACTIVE_API_USER_HANDLE_STORAGE_KEY, user.handle);
  dispatchActiveApiUserChange();
};

export const clearActiveApiUser = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACTIVE_API_USER_ID_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_API_USER_HANDLE_STORAGE_KEY);
  dispatchActiveApiUserChange();
};

export const useActiveApiUser = () => {
  const [activeApiUser, setActiveApiUserState] = useState<ActiveApiUser | null>(
    getActiveApiUser,
  );
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const session = await getAuthSession();
        setActiveApiUser(session.user);
      } catch {
        clearActiveApiUser();
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const syncActiveApiUser = () => {
      setActiveApiUserState(getActiveApiUser());
    };

    window.addEventListener('storage', syncActiveApiUser);
    window.addEventListener(ACTIVE_API_USER_EVENT, syncActiveApiUser);

    return () => {
      window.removeEventListener('storage', syncActiveApiUser);
      window.removeEventListener(ACTIVE_API_USER_EVENT, syncActiveApiUser);
    };
  }, []);

  const clear = useCallback(() => {
    void logout().finally(() => {
      clearActiveApiUser();
    });
  }, []);

  return {
    activeApiUser,
    activeApiUserId: activeApiUser?.id ?? '',
    clearActiveApiUser: clear,
    isLoadingSession,
  };
};
