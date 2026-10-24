import { apiGet, apiPost } from './client';
import type { ApiAccount } from './types';

export interface DirectMessage {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  text: string;
  created_at: string;
}

export interface Conversation {
  account: ApiAccount;
  last_message: DirectMessage;
}

const threadPath = (accountId: string) => `/api/messages/with/${encodeURIComponent(accountId)}`;

export const getConversations = () => apiGet<Conversation[]>('/api/messages/conversations');
export const getThread = (accountId: string) => apiGet<DirectMessage[]>(threadPath(accountId));
export const sendMessage = (accountId: string, text: string) =>
  apiPost<DirectMessage>(threadPath(accountId), { text });
