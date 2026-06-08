import { apiDelete, apiGet, apiPost } from "./client";
import type { ApiUserFollowsResponse } from "./types";

const userFollowsPath = (userId: string): string =>
  `/api/users/${encodeURIComponent(userId)}/follows`;

const accountFollowPath = (userId: string, accountId: string): string =>
  `${userFollowsPath(userId)}/${encodeURIComponent(accountId)}`;

export const getUserFollows = (
  userId: string,
): Promise<ApiUserFollowsResponse> =>
  apiGet<ApiUserFollowsResponse>(userFollowsPath(userId));

export const followAccount = (
  userId: string,
  accountId: string,
): Promise<ApiUserFollowsResponse> =>
  apiPost<ApiUserFollowsResponse>(accountFollowPath(userId, accountId));

export const unfollowAccount = (
  userId: string,
  accountId: string,
): Promise<ApiUserFollowsResponse> =>
  apiDelete<ApiUserFollowsResponse>(accountFollowPath(userId, accountId));

export const getFollowingAccountIds = (
  response: ApiUserFollowsResponse,
): string[] => response.following_account_ids;
