import { apiGet, apiPatch, apiPost } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import { getActiveApiUserId } from "../auth/apiActiveUser";
import type {
  ApiAccount,
  ApiAccountDeactivatePayload,
  ApiAccountProfileUpdatePayload,
  ApiPostWithAssets,
} from "./types";
import type { PostFilters } from "../types/filters";

export const getAccounts = (): Promise<ApiAccount[]> =>
  apiGet<ApiAccount[]>("/api/accounts");

export const getAccount = (accountId: string): Promise<ApiAccount> =>
  apiGet<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`);

export const updateAccountProfile = (
  accountId: string,
  payload: ApiAccountProfileUpdatePayload,
): Promise<ApiAccount> =>
  apiPatch<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`, payload);

export const deactivateAccount = (
  accountId: string,
  payload: ApiAccountDeactivatePayload,
): Promise<ApiAccount> =>
  apiPost<ApiAccount>(
    `/api/accounts/${encodeURIComponent(accountId)}/deactivate`,
    payload,
  );

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
