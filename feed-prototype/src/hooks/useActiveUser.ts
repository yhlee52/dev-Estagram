import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEffectiveUsers } from './useEffectiveData';
import {
  ACTIVE_USER_STORAGE_KEY,
  getEffectiveUsers,
  LOCAL_DATA_EVENT,
} from '../utils/localData';

const ACTIVE_USER_EVENT = 'local-feed-active-user-change';

function getDefaultUserId(): string {
  return getEffectiveUsers()[0]?.id ?? '';
}

function isKnownUserId(userId: string, users = getEffectiveUsers()): boolean {
  return users.some((user) => user.id === userId);
}

function readActiveUserId(): string {
  if (typeof window === 'undefined') {
    return getDefaultUserId();
  }

  const storedUserId = window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);

  if (storedUserId && isKnownUserId(storedUserId)) {
    return storedUserId;
  }

  return getDefaultUserId();
}

function writeActiveUserId(userId: string) {
  if (typeof window === 'undefined' || !isKnownUserId(userId)) {
    return;
  }

  window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
  window.dispatchEvent(new Event(ACTIVE_USER_EVENT));
}

export function useActiveUser() {
  const users = useEffectiveUsers();
  const [activeUserId, setActiveUserIdState] = useState<string>(readActiveUserId);

  useEffect(() => {
    const syncActiveUserId = () => {
      setActiveUserIdState(readActiveUserId());
    };

    window.addEventListener('storage', syncActiveUserId);
    window.addEventListener(ACTIVE_USER_EVENT, syncActiveUserId);
    window.addEventListener(LOCAL_DATA_EVENT, syncActiveUserId);

    return () => {
      window.removeEventListener('storage', syncActiveUserId);
      window.removeEventListener(ACTIVE_USER_EVENT, syncActiveUserId);
      window.removeEventListener(LOCAL_DATA_EVENT, syncActiveUserId);
    };
  }, []);

  const setActiveUserId = useCallback((userId: string) => {
    if (!isKnownUserId(userId, users)) {
      return;
    }

    setActiveUserIdState(userId);
    writeActiveUserId(userId);
  }, [users]);

  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId) ?? users[0],
    [activeUserId, users],
  );

  return {
    users,
    activeUser,
    activeUserId,
    setActiveUserId,
  };
}
