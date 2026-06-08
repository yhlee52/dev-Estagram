import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClientError, ApiNetworkError } from '../api/client';
import {
  followAccount as followAccountApi,
  getUserFollows,
  unfollowAccount as unfollowAccountApi,
} from '../api/followsApi';
import { getApiBaseUrl } from '../config/apiConfig';

export const API_FOLLOWS_CHANGE_EVENT = 'feed-prototype-api-follows-change';

const dispatchApiFollowsChange = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(API_FOLLOWS_CHANGE_EVENT));
};

function getLoadFollowsErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return 'The selected API user was not found in the backend database. Switch user and choose an existing backend user.';
    }

    return `Could not load API follow state. The backend returned ${error.status}.`;
  }

  return 'Could not load API follow state.';
}

function getFollowActionErrorMessage(
  action: 'follow' | 'unfollow',
  error: unknown,
): string {
  const actionLabel = action === 'follow' ? 'follow' : 'unfollow';

  if (error instanceof ApiNetworkError) {
    return `Could not ${actionLabel} this account because the backend API is unreachable at ${getApiBaseUrl()}.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 404) {
      return `Could not ${actionLabel} this account because the selected API user or account was not found in the backend database.`;
    }

    return `Could not ${actionLabel} this account. The backend returned ${error.status}.`;
  }

  return `Could not ${actionLabel} this account.`;
}

export function useApiFollows(activeApiUserId: string) {
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(activeApiUserId));
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAccountId, setPendingAccountId] = useState('');
  const [error, setError] = useState('');

  const loadFollows = useCallback(async (): Promise<boolean> => {
    if (!activeApiUserId) {
      setFollowingIds([]);
      setIsLoading(false);
      setError('');
      return true;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await getUserFollows(activeApiUserId);
      setFollowingIds(response.following_account_ids);
      return true;
    } catch (loadError) {
      setFollowingIds([]);
      setError(getLoadFollowsErrorMessage(loadError));
      return false;
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
      } catch (loadError) {
        if (isActive) {
          setFollowingIds([]);
          setError(getLoadFollowsErrorMessage(loadError));
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
        dispatchApiFollowsChange();
        await loadFollows();
      } catch (followError) {
        setError(getFollowActionErrorMessage('follow', followError));
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
        dispatchApiFollowsChange();
        await loadFollows();
      } catch (unfollowError) {
        setError(getFollowActionErrorMessage('unfollow', unfollowError));
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
