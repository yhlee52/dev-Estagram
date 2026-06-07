import { useCallback, useEffect, useMemo, useState } from 'react';
import followsData from '../data/follows.json';
import type { FollowState } from '../types/feed';
import { useActiveUser } from './useActiveUser';

const STORAGE_KEY = 'local-feed-following-by-user';
const FOLLOW_STATE_EVENT = 'local-feed-following-change';

const initialFollows = followsData as unknown as FollowState[];

function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

function getInitialFollowingByUser(): Record<string, string[]> {
  return initialFollows.reduce<Record<string, string[]>>((result, followState) => {
    result[followState.user_id] = normalizeIds(followState.following_account_ids);
    return result;
  }, {});
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
  const initialFollowingByUser = getInitialFollowingByUser();

  if (typeof window === 'undefined') {
    return initialFollowingByUser;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return initialFollowingByUser;
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return initialFollowingByUser;
    }

    const storedFollowingByUser = Object.entries(parsedValue).reduce<
      Record<string, string[]>
    >((result, [userId, accountIds]) => {
      if (!Array.isArray(accountIds)) {
        return result;
      }

      result[userId] = accountIds.filter(
        (accountId): accountId is string => typeof accountId === 'string',
      );
      return result;
    }, {});

    return normalizeFollowingByUser(
      { ...initialFollowingByUser, ...storedFollowingByUser },
    );
  } catch {
    return initialFollowingByUser;
  }
}

function writeFollowingByUser(followingByUser: Record<string, string[]>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizeFollowingByUser(followingByUser)),
  );
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

    return () => {
      window.removeEventListener('storage', syncFollowingByUser);
      window.removeEventListener(FOLLOW_STATE_EVENT, syncFollowingByUser);
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
