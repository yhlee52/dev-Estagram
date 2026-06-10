import { apiGet } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import { getActiveApiUserId } from "../auth/apiActiveUser";
import type { ApiAccount, ApiPostWithAssets } from "./types";
import type { PostFilters } from "../types/filters";

export const getAccounts = (): Promise<ApiAccount[]> =>
  apiGet<ApiAccount[]>("/api/accounts");

export const getAccount = (accountId: string): Promise<ApiAccount> =>
  apiGet<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`);

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
