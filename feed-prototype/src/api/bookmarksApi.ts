import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import { buildPostFilterQuery } from "./postFilterQuery";
import type {
  ApiBookmark,
  ApiPaginatedBookmarks,
  ApiUserBookmarkIdsResponse,
} from "./types";
import type { PostFilters } from "../types/filters";

const bookmarkPath = (userId: string, postId: string): string =>
  `/api/users/${encodeURIComponent(userId)}/bookmarks/${encodeURIComponent(postId)}`;

export type BookmarkPageOptions = {
  cursor?: string;
  limit?: number;
};

export const getUserBookmarkIds = (
  userId: string,
): Promise<ApiUserBookmarkIdsResponse> =>
  apiGet<ApiUserBookmarkIdsResponse>(
    `/api/users/${encodeURIComponent(userId)}/bookmark-ids`,
  );

export const getUserBookmarks = (
  userId: string,
  filters?: PostFilters,
  options: BookmarkPageOptions = {},
): Promise<ApiPaginatedBookmarks> => {
  const searchParams = buildPostFilterQuery(filters, {
    userId,
    cursor: options.cursor,
    limit: options.limit,
  });
  const queryString = searchParams.toString();

  return apiGet<ApiPaginatedBookmarks>(
    `/api/users/${encodeURIComponent(userId)}/bookmarks${
      queryString ? `?${queryString}` : ""
    }`,
  );
};

export const getBookmark = (
  userId: string,
  postId: string,
): Promise<ApiBookmark> => apiGet<ApiBookmark>(bookmarkPath(userId, postId));

export const addBookmark = (
  userId: string,
  postId: string,
  note?: string | null,
): Promise<ApiBookmark> =>
  apiPost<ApiBookmark>(
    bookmarkPath(userId, postId),
    note === undefined ? {} : { note },
  );

export const updateBookmarkNote = (
  userId: string,
  postId: string,
  note: string | null,
): Promise<ApiBookmark> =>
  apiPatch<ApiBookmark>(bookmarkPath(userId, postId), { note });

export const removeBookmark = (
  userId: string,
  postId: string,
): Promise<void> => apiDelete<void>(bookmarkPath(userId, postId));
