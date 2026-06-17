import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  ApiCommentCreatePayload,
  ApiCommentListResponse,
  ApiCommentUpdatePayload,
  ApiCommentWithAuthor,
} from "./types";

export type CommentSort = "oldest" | "newest";

export const getComments = (
  postId: string,
  sort: CommentSort = "oldest",
): Promise<ApiCommentListResponse> => {
  const searchParams = new URLSearchParams({ sort });

  return apiGet<ApiCommentListResponse>(
    `/api/posts/${encodeURIComponent(postId)}/comments?${searchParams.toString()}`,
  );
};

export const createComment = (
  postId: string,
  payload: ApiCommentCreatePayload,
): Promise<ApiCommentWithAuthor> =>
  apiPost<ApiCommentWithAuthor>(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    payload,
  );

export const updateComment = (
  commentId: string,
  payload: ApiCommentUpdatePayload,
): Promise<ApiCommentWithAuthor> =>
  apiPatch<ApiCommentWithAuthor>(
    `/api/comments/${encodeURIComponent(commentId)}`,
    payload,
  );

export const deleteComment = (
  commentId: string,
  userId: string,
): Promise<void> => {
  const searchParams = new URLSearchParams({ user_id: userId });

  return apiDelete<void>(
    `/api/comments/${encodeURIComponent(commentId)}?${searchParams.toString()}`,
  );
};
