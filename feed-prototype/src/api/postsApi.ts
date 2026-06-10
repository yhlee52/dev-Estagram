import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import { getActiveApiUserId } from "../auth/apiActiveUser";
import type {
  ApiFeedItem,
  ApiPostCreatePayload,
  ApiPostUpdatePayload,
  ApiPostWithAssets,
} from "./types";
import type { PostFilters } from "../types/filters";

export const getPosts = (
  filters?: PostFilters,
  activeUserId = getActiveApiUserId() ?? undefined,
): Promise<ApiPostWithAssets[]> => {
  const searchParams = buildPostFilterQuery(filters, { userId: activeUserId });
  const queryString = searchParams.toString();

  return apiGet<ApiPostWithAssets[]>(
    queryString ? `/api/posts?${queryString}` : "/api/posts",
  );
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

export const deletePost = (postId: string, userId: string): Promise<void> => {
  const searchParams = new URLSearchParams({ user_id: userId });

  return apiDelete<void>(
    `/api/posts/${encodeURIComponent(postId)}?${searchParams.toString()}`,
  );
};
