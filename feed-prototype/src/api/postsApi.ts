import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  ApiFeedItem,
  ApiPostCreatePayload,
  ApiPostUpdatePayload,
  ApiPostWithAssets,
} from "./types";

export const getPosts = (): Promise<ApiPostWithAssets[]> =>
  apiGet<ApiPostWithAssets[]>("/api/posts");

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
