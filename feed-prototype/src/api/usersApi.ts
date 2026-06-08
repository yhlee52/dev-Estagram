import { apiGet } from "./client";
import type { ApiUser } from "./types";

export const getUsers = (): Promise<ApiUser[]> => apiGet<ApiUser[]>("/api/users");

export const getUser = (userId: string): Promise<ApiUser> =>
  apiGet<ApiUser>(`/api/users/${encodeURIComponent(userId)}`);

export const findUserByIdOrHandle = async (
  input: string,
): Promise<ApiUser | undefined> => {
  const normalizedInput = input.trim().toLowerCase();

  if (!normalizedInput) {
    return undefined;
  }

  const users = await getUsers();

  return users.find(
    (user) =>
      user.id.toLowerCase() === normalizedInput ||
      user.handle.toLowerCase() === normalizedInput,
  );
};
