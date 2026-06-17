import { apiGet, apiPost } from "./client";
import type {
  ApiNotificationReadState,
  ApiPaginatedNotifications,
} from "./types";

export type NotificationPageOptions = {
  cursor?: string | null;
  limit?: number;
  unreadOnly?: boolean;
};

const notificationsPath = (userId: string): string =>
  `/api/users/${encodeURIComponent(userId)}/notifications`;

export const getUserNotifications = (
  userId: string,
  options: NotificationPageOptions = {},
): Promise<ApiPaginatedNotifications> => {
  const searchParams = new URLSearchParams();
  if (options.cursor) {
    searchParams.set("cursor", options.cursor);
  }
  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit));
  }
  if (options.unreadOnly) {
    searchParams.set("unread_only", "true");
  }
  const query = searchParams.toString();

  return apiGet<ApiPaginatedNotifications>(
    `${notificationsPath(userId)}${query ? `?${query}` : ""}`,
  );
};

export const markNotificationsRead = (
  userId: string,
): Promise<ApiNotificationReadState> =>
  apiPost<ApiNotificationReadState>(`${notificationsPath(userId)}/read-all`);
