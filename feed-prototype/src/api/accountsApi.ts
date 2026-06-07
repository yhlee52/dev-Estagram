import { apiGet } from "./client";
import type { ApiAccount } from "./types";

export const getAccounts = (): Promise<ApiAccount[]> =>
  apiGet<ApiAccount[]>("/api/accounts");

export const getAccount = (accountId: string): Promise<ApiAccount> =>
  apiGet<ApiAccount>(`/api/accounts/${encodeURIComponent(accountId)}`);
