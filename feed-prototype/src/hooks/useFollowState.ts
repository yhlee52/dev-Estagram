import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LOCAL_DATA_EVENT,
  readFollowingByUserOverlay,
  writeFollowingByUserOverlay,
} from '../utils/localData';
import { useActiveUser } from './useActiveUser';

const FOLLOW_STATE_EVENT = 'local-feed-following-change';

function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

function normalizeFollowingByUser(
  value: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(value).map(([userId, accountIds]) => [
      userId,
      normalizeIds(accountIds),
    ]),
  );
}

function readFollowingByUser(): Record<string, string[]> {
  return normalizeFollowingByUser(readFollowingByUserOverlay());
}

function writeFollowingByUser(followingByUser: Record<string, string[]>) {
  if (typeof window === 'undefined') {
    return;
  }

  writeFollowingByUserOverlay(normalizeFollowingByUser(followingByUser));
  window.dispatchEvent(new Event(FOLLOW_STATE_EVENT));
}

export function useFollowState() {
  const { activeUserId } = useActiveUser();
  const [followingByUser, setFollowingByUser] = useState<Record<string, string[]>>(
    readFollowingByUser,
  );

  useEffect(() => {
    const syncFollowingByUser = () => {
      setFollowingByUser(readFollowingByUser());
    };

    window.addEventListener('storage', syncFollowingByUser);
    window.addEventListener(FOLLOW_STATE_EVENT, syncFollowingByUser);
    window.addEventListener(LOCAL_DATA_EVENT, syncFollowingByUser);

    return () => {
      window.removeEventListener('storage', syncFollowingByUser);
      window.removeEventListener(FOLLOW_STATE_EVENT, syncFollowingByUser);
      window.removeEventListener(LOCAL_DATA_EVENT, syncFollowingByUser);
    };
  }, []);

  const updateFollowingIds = useCallback((updater: (ids: string[]) => string[]) => {
    setFollowingByUser((currentFollowingByUser) => {
      const currentIds = currentFollowingByUser[activeUserId] ?? [];
      const nextFollowingByUser = {
        ...currentFollowingByUser,
        [activeUserId]: normalizeIds(updater(currentIds)),
      };

      writeFollowingByUser(nextFollowingByUser);
      return nextFollowingByUser;
    });
  }, [activeUserId]);

  const followingIds = useMemo(
    () => followingByUser[activeUserId] ?? [],
    [activeUserId, followingByUser],
  );

  const followingIdSet = useMemo(() => new Set(followingIds), [followingIds]);

  const isFollowing = useCallback(
    (accountId: string) => followingIdSet.has(accountId),
    [followingIdSet],
  );

  const follow = useCallback(
    (accountId: string) => {
      updateFollowingIds((currentIds) => [...currentIds, accountId]);
    },
    [updateFollowingIds],
  );

  const unfollow = useCallback(
    (accountId: string) => {
      updateFollowingIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== accountId),
      );
    },
    [updateFollowingIds],
  );

  const toggleFollow = useCallback(
    (accountId: string) => {
      updateFollowingIds((currentIds) =>
        currentIds.includes(accountId)
          ? currentIds.filter((currentId) => currentId !== accountId)
          : [...currentIds, accountId],
      );
    },
    [updateFollowingIds],
  );

  return {
    activeUserId,
    followingIds,
    isFollowing,
    follow,
    unfollow,
    toggleFollow,
  };
}
