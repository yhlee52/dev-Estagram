import { useEffect, useState } from 'react';
import { getMessageUnreadCount } from '../api/messagesApi';
import { useActiveApiUser } from '../auth/apiActiveUser';

export const MESSAGE_UNREAD_CHANGE_EVENT = 'feed-prototype-message-unread-change';

export function notifyMessageUnreadChange() {
  window.dispatchEvent(new Event(MESSAGE_UNREAD_CHANGE_EVENT));
}

export function useMessageUnread(): number {
  const { activeApiUserId } = useActiveApiUser();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!activeApiUserId) return;
    let live = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void getMessageUnreadCount().then((response) => {
        if (live) setUnreadCount(response.unread_count);
      }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener(MESSAGE_UNREAD_CHANGE_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener(MESSAGE_UNREAD_CHANGE_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activeApiUserId]);

  return activeApiUserId ? unreadCount : 0;
}
