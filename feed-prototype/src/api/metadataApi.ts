import { apiGet } from "./client";
import type {
  ApiMetadataKeyCount,
  ApiMetadataKeyListResponse,
  ApiMetadataValueCount,
  ApiMetadataValueListResponse,
} from "./types";

/**
 * Fetch the most-used top-level metadata keys (highest count first) for facet
 * selection (v0.4.0). Keys are derived from the data, not a fixed schema.
 */
export const getMetadataKeys = async (
  limit?: number,
): Promise<ApiMetadataKeyCount[]> => {
  const searchParams = new URLSearchParams();
  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }

  const queryString = searchParams.toString();
  const response = await apiGet<ApiMetadataKeyListResponse>(
    queryString ? `/api/metadata/keys?${queryString}` : "/api/metadata/keys",
  );

  return response.items;
};

/**
 * Fetch the most-used distinct values for one metadata key (highest count
 * first). The list is a frequency-ordered "top N", not an exhaustive set.
 */
export const getMetadataValues = async (
  key: string,
  limit?: number,
): Promise<ApiMetadataValueCount[]> => {
  const searchParams = new URLSearchParams();
  searchParams.set("key", key);
  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }

  const response = await apiGet<ApiMetadataValueListResponse>(
    `/api/metadata/values?${searchParams.toString()}`,
  );

  return response.items;
};
