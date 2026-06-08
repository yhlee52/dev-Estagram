import { apiGet } from "./client";
import type { ApiPost, ApiPostWithAssets } from "./types";

export const getPosts = (): Promise<ApiPost[]> => apiGet<ApiPost[]>("/api/posts");

export const getPost = (postId: string): Promise<ApiPostWithAssets> =>
  apiGet<ApiPostWithAssets>(`/api/posts/${encodeURIComponent(postId)}`);
