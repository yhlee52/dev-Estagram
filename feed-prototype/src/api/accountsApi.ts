import { apiGet } from "./client";
import type { ApiAccount, ApiPost } from "./types";

export const getAccounts = (): Promise<ApiAccount[]> =>
  apiGet<ApiAccount[]>("/api/accounts");

export const getAccount = (accountId: string): Promise<ApiAccount> =>
  apiGet<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`);

export const getAccountPosts = (accountId: string): Promise<ApiPost[]> =>
  apiGet<ApiPost[]>(`/api/accounts/${encodeURIComponent(accountId)}/posts`);
