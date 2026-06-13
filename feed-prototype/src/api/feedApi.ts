import { apiGet } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import type { ApiFeedResponse } from "./types";
import type { PostFilters } from "../types/filters";

export type FeedPageOptions = {
  cursor?: string;
  limit?: number;
};

export const getFeed = (
  userId: string,
  filters?: PostFilters,
  options: FeedPageOptions = {},
): Promise<ApiFeedResponse> => {
  const searchParams = buildPostFilterQuery(filters, {
    userId,
    cursor: options.cursor,
    limit: options.limit,
  });
  searchParams.set("user_id", userId);

  return apiGet<ApiFeedResponse>(`/api/feed?${searchParams.toString()}`);
};
