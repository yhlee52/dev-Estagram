import { apiDelete, apiGet, apiPost } from './client';

export interface LikeSummary {
  post_id: string;
  count: number;
  liked_by_me: boolean;
}

const path = (postId: string) => `/api/posts/${encodeURIComponent(postId)}/likes`;

export const getLikes = (postId: string) => apiGet<LikeSummary>(path(postId));
export const addLike = (postId: string) => apiPost<LikeSummary>(path(postId));
export const removeLike = (postId: string) => apiDelete<LikeSummary>(path(postId));
