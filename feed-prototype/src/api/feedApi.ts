import { apiGet } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import type { ApiFeedResponse } from "./types";
import type { PostFilters } from "../types/filters";

export const getFeed = (
  userId: string,
  filters?: PostFilters,
): Promise<ApiFeedResponse> => {
  const searchParams = buildPostFilterQuery(filters, { userId });
  searchParams.set("user_id", userId);

  return apiGet<ApiFeedResponse>(`/api/feed?${searchParams.toString()}`);
};
