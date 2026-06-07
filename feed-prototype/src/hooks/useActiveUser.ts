import { useCallback, useEffect, useMemo, useState } from 'react';
import usersData from '../data/users.json';
import type { User } from '../types/feed';

const STORAGE_KEY = 'local-feed-active-user-id';
const ACTIVE_USER_EVENT = 'local-feed-active-user-change';

const users = usersData as unknown as User[];
const defaultUserId = users[0]?.id ?? '';

function isKnownUserId(userId: string): boolean {
  return users.some((user) => user.id === userId);
}

function readActiveUserId(): string {
  if (typeof window === 'undefined') {
    return defaultUserId;
  }

  const storedUserId = window.localStorage.getItem(STORAGE_KEY);

  if (storedUserId && isKnownUserId(storedUserId)) {
    return storedUserId;
  }

  return defaultUserId;
}

function writeActiveUserId(userId: string) {
  if (typeof window === 'undefined' || !isKnownUserId(userId)) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, userId);
  window.dispatchEvent(new Event(ACTIVE_USER_EVENT));
}

export function useActiveUser() {
  const [activeUserId, setActiveUserIdState] = useState<string>(readActiveUserId);

  useEffect(() => {
    const syncActiveUserId = () => {
      setActiveUserIdState(readActiveUserId());
    };

    window.addEventListener('storage', syncActiveUserId);
    window.addEventListener(ACTIVE_USER_EVENT, syncActiveUserId);

    return () => {
      window.removeEventListener('storage', syncActiveUserId);
      window.removeEventListener(ACTIVE_USER_EVENT, syncActiveUserId);
    };
  }, []);

  const setActiveUserId = useCallback((userId: string) => {
    if (!isKnownUserId(userId)) {
      return;
    }

    setActiveUserIdState(userId);
    writeActiveUserId(userId);
  }, []);

  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId) ?? users[0],
    [activeUserId],
  );

  return {
    users,
    activeUser,
    activeUserId,
    setActiveUserId,
  };
}
