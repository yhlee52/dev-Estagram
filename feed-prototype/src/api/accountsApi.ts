import { apiGet, apiPatch, apiPost, apiPut } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import { getActiveApiUserId } from "../auth/apiActiveUser";
import type {
  ApiAccount,
  ApiAccountSearchPage,
  ApiAccountSummary,
  ApiAccountRelationPage,
  ApiAccountProfileUpdatePayload,
  ApiPostWithAssets,
} from "./types";
import type { PostFilters } from "../types/filters";

export const getAccounts = (includeDeactivated = false): Promise<ApiAccount[]> =>
  apiGet<ApiAccount[]>(includeDeactivated ? "/api/accounts?include_deactivated=true" : "/api/accounts");

export const searchAccounts = (options: { keyword?: string; sort?: 'handle' | 'recent' | 'post_count'; cursor?: string; limit?: number } = {}): Promise<ApiAccountSearchPage> => {
  const params = new URLSearchParams();
  if (options.keyword?.trim()) params.set('keyword', options.keyword.trim().normalize('NFC'));
  params.set('sort', options.sort ?? 'handle');
  if (options.cursor) params.set('cursor', options.cursor);
  params.set('limit', String(options.limit ?? 20));
  return apiGet<ApiAccountSearchPage>(`/api/accounts/search?${params}`);
};

export const getAccount = (accountId: string): Promise<ApiAccount> =>
  apiGet<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`);

const accountPath = (accountId: string) => `/api/accounts/${encodeURIComponent(accountId)}`;
export const getAccountSummary = (accountId: string): Promise<ApiAccountSummary> =>
  apiGet<ApiAccountSummary>(`${accountPath(accountId)}/summary`);
export const getAccountRelations = (accountId: string, kind: 'followers' | 'following', cursor?: string): Promise<ApiAccountRelationPage> => {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return apiGet<ApiAccountRelationPage>(`${accountPath(accountId)}/${kind}?${params}`);
};
export const getPinnedPosts = (accountId: string): Promise<ApiPostWithAssets[]> =>
  apiGet<ApiPostWithAssets[]>(`${accountPath(accountId)}/pinned-posts`);
export const replacePinnedPosts = (accountId: string, postIds: string[]): Promise<ApiPostWithAssets[]> =>
  apiPut<ApiPostWithAssets[]>(`${accountPath(accountId)}/pinned-posts`, { post_ids: postIds });

export const updateAccountProfile = (
  accountId: string,
  payload: ApiAccountProfileUpdatePayload,
): Promise<ApiAccount> =>
  apiPatch<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`, payload);

export const deactivateAccount = (accountId: string): Promise<ApiAccount> =>
  apiPost<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}/deactivate`);

export const getAccountPosts = (
  accountId: string,
  filters?: PostFilters,
  activeUserId = getActiveApiUserId() ?? undefined,
): Promise<ApiPostWithAssets[]> => {
  const searchParams = buildPostFilterQuery(filters, { userId: activeUserId });
  const queryString = searchParams.toString();

  return apiGet<ApiPostWithAssets[]>(
    `/api/accounts/${encodeURIComponent(accountId)}/posts${
      queryString ? `?${queryString}` : ""
    }`,
  );
};
