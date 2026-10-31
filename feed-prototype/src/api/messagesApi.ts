import { apiDelete, apiGet, apiPost } from './client';
import { getApiBaseUrl } from '../config/apiConfig';
import type { ApiAccount } from './types';

export interface DirectMessage {
  id: string;
  room_id: string | null;
  sender_user_id: string;
  recipient_user_id: string | null;
  text: string;
  image_url: string | null;
  created_at: string;
}

export interface MessageRoom {
  id: string;
  kind: 'direct' | 'group';
  name: string | null;
  members: ApiAccount[];
  last_message: DirectMessage | null;
  unread_count: number;
  created_at: string;
}

export interface MessageUnreadCount {
  unread_count: number;
}

export interface RoomDetail {
  room: MessageRoom;
  messages: DirectMessage[];
}

const roomPath = (roomId: string) => `/api/messages/rooms/${encodeURIComponent(roomId)}`;

export const getRooms = () => apiGet<MessageRoom[]>('/api/messages/rooms');
export const getMessageUnreadCount = () => apiGet<MessageUnreadCount>('/api/messages/unread-count');
export const getRoom = (roomId: string) => apiGet<RoomDetail>(roomPath(roomId));
export const markRoomRead = (roomId: string, messageId: string) =>
  apiPost<MessageUnreadCount>(`${roomPath(roomId)}/read`, { message_id: messageId });
export const openDirectRoom = (accountId: string) =>
  apiPost<MessageRoom>(`/api/messages/direct/${encodeURIComponent(accountId)}`);
export const createRoom = (accountIds: string[], name: string) =>
  apiPost<MessageRoom>('/api/messages/rooms', { account_ids: accountIds, name: name.trim() || null });
export const inviteMembers = (roomId: string, accountIds: string[]) =>
  apiPost<MessageRoom>(`${roomPath(roomId)}/members`, { account_ids: accountIds });
export const leaveRoom = (roomId: string) => apiDelete<void>(`${roomPath(roomId)}/members/me`);
export const sendRoomMessage = (roomId: string, text: string) =>
  apiPost<DirectMessage>(`${roomPath(roomId)}/messages`, { text });
export const sendRoomImage = async (roomId: string, file: File, text: string) => {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return apiPost<DirectMessage>(`${roomPath(roomId)}/images`, { data_base64: dataBase64, text });
};
export const imageUrl = (path: string) => `${getApiBaseUrl().replace(/\/$/, '')}${path}`;
