import { apiDelete, apiGet, apiPost } from "./client";
import type {
  ApiFeedItem,
  ApiPost,
  ApiPostCreatePayload,
  ApiPostWithAssets,
} from "./types";

export const getPosts = (): Promise<ApiPost[]> => apiGet<ApiPost[]>("/api/posts");

export const getPost = (postId: string): Promise<ApiPostWithAssets> =>
  apiGet<ApiPostWithAssets>(`/api/posts/${encodeURIComponent(postId)}`);

export const createPost = (
  payload: ApiPostCreatePayload,
): Promise<ApiFeedItem> => apiPost<ApiFeedItem>("/api/posts", payload);

export const deletePost = (postId: string, userId: string): Promise<void> => {
  const searchParams = new URLSearchParams({ user_id: userId });

  return apiDelete<void>(
    `/api/posts/${encodeURIComponent(postId)}?${searchParams.toString()}`,
  );
};
