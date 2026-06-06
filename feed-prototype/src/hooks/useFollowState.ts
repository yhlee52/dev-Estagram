import { useCallback, useEffect, useMemo, useState } from 'react';
import followsData from '../data/follows.json';
import type { FollowState } from '../types/feed';

const STORAGE_KEY = 'local-feed-following';
const FOLLOW_STATE_EVENT = 'local-feed-following-change';

const initialFollows = followsData as unknown as FollowState[];
const initialFollowingIds = initialFollows
  .filter((followState) => followState.isFollowing)
  .map((followState) => followState.accountId);

function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

function readFollowingIds(): string[] {
  if (typeof window === 'undefined') {
    return normalizeIds(initialFollowingIds);
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return normalizeIds(initialFollowingIds);
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return normalizeIds(initialFollowingIds);
    }

    return normalizeIds(
      parsedValue.filter((value): value is string => typeof value === 'string'),
    );
  } catch {
    return normalizeIds(initialFollowingIds);
  }
}

function writeFollowingIds(ids: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeIds(ids)));
  window.dispatchEvent(new Event(FOLLOW_STATE_EVENT));
}

export function useFollowState() {
  const [followingIds, setFollowingIds] = useState<string[]>(readFollowingIds);

  useEffect(() => {
    const syncFollowingIds = () => {
      setFollowingIds(readFollowingIds());
    };

    window.addEventListener('storage', syncFollowingIds);
    window.addEventListener(FOLLOW_STATE_EVENT, syncFollowingIds);

    return () => {
      window.removeEventListener('storage', syncFollowingIds);
      window.removeEventListener(FOLLOW_STATE_EVENT, syncFollowingIds);
    };
  }, []);

  const updateFollowingIds = useCallback((updater: (ids: string[]) => string[]) => {
    setFollowingIds((currentIds) => {
      const nextIds = normalizeIds(updater(currentIds));
      writeFollowingIds(nextIds);
      return nextIds;
    });
  }, []);

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
    followingIds,
    isFollowing,
    follow,
    unfollow,
    toggleFollow,
  };
}
