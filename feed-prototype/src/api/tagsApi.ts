import { apiGet } from "./client";
import type { ApiTagCount, ApiTagListResponse } from "./types";

/**
 * Fetch the most-used post tags (highest count first) for search autocomplete.
 *
 * The backend groups tags case-insensitively, mirroring the `tag` filter, so the
 * returned tags are lowercase. `limit` caps how many tags come back.
 */
export const getTags = async (limit?: number): Promise<ApiTagCount[]> => {
  const searchParams = new URLSearchParams();
  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }

  const queryString = searchParams.toString();
  const response = await apiGet<ApiTagListResponse>(
    queryString ? `/api/tags?${queryString}` : "/api/tags",
  );

  return response.items;
};
