import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  followAccount as followAccountApi,
  getUserFollows,
  unfollowAccount as unfollowAccountApi,
} from '../api/followsApi';

export const API_FOLLOWS_CHANGE_EVENT = 'feed-prototype-api-follows-change';

const dispatchApiFollowsChange = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(API_FOLLOWS_CHANGE_EVENT));
};

type LoadFollowsOptions = {
  broadcastChange?: boolean;
};

export function useApiFollows(activeApiUserId: string) {
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(activeApiUserId));
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAccountId, setPendingAccountId] = useState('');
  const [error, setError] = useState('');

  const loadFollows = useCallback(async (options: LoadFollowsOptions = {}) => {
    if (!activeApiUserId) {
      setFollowingIds([]);
      setIsLoading(false);
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await getUserFollows(activeApiUserId);
      setFollowingIds(response.following_account_ids);

      if (options.broadcastChange) {
        dispatchApiFollowsChange();
      }
    } catch {
      setFollowingIds([]);
      setError('Could not load API follow state.');
    } finally {
      setIsLoading(false);
    }
  }, [activeApiUserId]);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      if (!activeApiUserId) {
        setFollowingIds([]);
        setIsLoading(false);
        setError('');
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const response = await getUserFollows(activeApiUserId);

        if (isActive) {
          setFollowingIds(response.following_account_ids);
        }
      } catch {
        if (isActive) {
          setFollowingIds([]);
          setError('Could not load API follow state.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [activeApiUserId]);

  const followingIdSet = useMemo(() => new Set(followingIds), [followingIds]);

  const isFollowing = useCallback(
    (accountId: string) => followingIdSet.has(accountId),
    [followingIdSet],
  );

  const follow = useCallback(
    async (accountId: string) => {
      if (!activeApiUserId) {
        setError('Select an API user before changing follow state.');
        return;
      }

      setIsMutating(true);
      setPendingAccountId(accountId);
      setError('');

      try {
        await followAccountApi(activeApiUserId, accountId);
        await loadFollows({ broadcastChange: true });
      } catch {
        setError('Could not follow this account.');
      } finally {
        setIsMutating(false);
        setPendingAccountId('');
      }
    },
    [activeApiUserId, loadFollows],
  );

  const unfollow = useCallback(
    async (accountId: string) => {
      if (!activeApiUserId) {
        setError('Select an API user before changing follow state.');
        return;
      }

      setIsMutating(true);
      setPendingAccountId(accountId);
      setError('');

      try {
        await unfollowAccountApi(activeApiUserId, accountId);
        await loadFollows({ broadcastChange: true });
      } catch {
        setError('Could not unfollow this account.');
      } finally {
        setIsMutating(false);
        setPendingAccountId('');
      }
    },
    [activeApiUserId, loadFollows],
  );

  const toggleFollow = useCallback(
    async (accountId: string) => {
      if (followingIdSet.has(accountId)) {
        await unfollow(accountId);
      } else {
        await follow(accountId);
      }
    },
    [follow, followingIdSet, unfollow],
  );

  return {
    activeApiUserId,
    followingIds,
    isFollowing,
    isLoading,
    isMutating,
    pendingAccountId,
    error,
    refreshFollows: loadFollows,
    follow,
    unfollow,
    toggleFollow,
  };
}
