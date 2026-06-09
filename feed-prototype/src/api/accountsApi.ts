import { apiGet } from "./client";
import type { ApiAccount, ApiPostWithAssets } from "./types";

export const getAccounts = (): Promise<ApiAccount[]> =>
  apiGet<ApiAccount[]>("/api/accounts");

export const getAccount = (accountId: string): Promise<ApiAccount> =>
  apiGet<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`);

export const getAccountPosts = (accountId: string): Promise<ApiPostWithAssets[]> =>
  apiGet<ApiPostWithAssets[]>(
    `/api/accounts/${encodeURIComponent(accountId)}/posts`,
  );
