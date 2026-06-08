import { apiGet } from "./client";
import type { ApiFeedResponse } from "./types";

export const getFeed = (userId: string): Promise<ApiFeedResponse> => {
  const searchParams = new URLSearchParams({ user_id: userId });

  return apiGet<ApiFeedResponse>(`/api/feed?${searchParams.toString()}`);
};
