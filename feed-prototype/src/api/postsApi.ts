import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import { getActiveApiUserId } from "../auth/apiActiveUser";
import type {
  ApiFeedItem,
  ApiPaginatedPosts,
  ApiPostCreatePayload,
  ApiPostUpdatePayload,
  ApiPostWithAssets,
} from "./types";
import type { PostFilters } from "../types/filters";

export type PostPageOptions = {
  cursor?: string;
  limit?: number;
  activeUserId?: string;
};

export const getPosts = (
  filters?: PostFilters,
  options: PostPageOptions = {},
): Promise<ApiPaginatedPosts> => {
  const activeUserId = options.activeUserId ?? getActiveApiUserId() ?? undefined;
  const searchParams = buildPostFilterQuery(filters, {
    userId: activeUserId,
    cursor: options.cursor,
    limit: options.limit,
  });
  const queryString = searchParams.toString();

  return apiGet<ApiPaginatedPosts>(
    queryString ? `/api/posts?${queryString}` : "/api/posts",
  );
};

/**
 * Fetch every post matching the filters by following cursor pages.
 *
 * Use only for aggregate needs (e.g. per-account counts) where the full set is
 * required; paged views should call `getPosts` directly.
 */
export const getAllPosts = async (
  filters?: PostFilters,
  activeUserId = getActiveApiUserId() ?? undefined,
): Promise<ApiPostWithAssets[]> => {
  const all: ApiPostWithAssets[] = [];
  let cursor: string | undefined;

  // Safety cap to avoid an unbounded loop if the backend keeps signalling more.
  for (let page = 0; page < 1000; page += 1) {
    const response = await getPosts(filters, { cursor, limit: 100, activeUserId });
    all.push(...response.items);

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    cursor = response.next_cursor;
  }

  return all;
};

export const getPost = (postId: string): Promise<ApiPostWithAssets> =>
  apiGet<ApiPostWithAssets>(`/api/posts/${encodeURIComponent(postId)}`);

export const createPost = (
  payload: ApiPostCreatePayload,
): Promise<ApiFeedItem> => apiPost<ApiFeedItem>("/api/posts", payload);

export const updatePost = (
  postId: string,
  payload: ApiPostUpdatePayload,
): Promise<ApiPostWithAssets> =>
  apiPatch<ApiPostWithAssets>(`/api/posts/${encodeURIComponent(postId)}`, payload);

export const deletePost = (postId: string): Promise<void> =>
  apiDelete<void>(`/api/posts/${encodeURIComponent(postId)}`);
