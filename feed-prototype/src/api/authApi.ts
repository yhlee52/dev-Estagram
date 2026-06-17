import { apiGet, apiPatch, apiPost } from "./client";
import type { ApiAuthSession, ApiPasswordChangePayload } from "./types";

export const getAuthSession = (): Promise<ApiAuthSession> =>
  apiGet<ApiAuthSession>("/api/auth/session");

export const login = (
  loginValue: string,
  password: string,
): Promise<ApiAuthSession> =>
  apiPost<ApiAuthSession>("/api/auth/login", {
    login: loginValue,
    password,
  });

export const logout = (): Promise<null> => apiPost<null>("/api/auth/logout");

export const changePassword = (
  payload: ApiPasswordChangePayload,
): Promise<ApiAuthSession> =>
  apiPatch<ApiAuthSession>("/api/auth/password", payload);
