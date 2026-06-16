import { useState } from 'react';
import { Link } from 'react-router';
import type { ApiNotificationItem } from '../api/types';
import EmptyState from '../components/EmptyState';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime } from '../utils/format';

const PAGE_LIMIT = 20;

const reasonLabels: Record<string, string> = {
  followed_post: 'Following',
  own_post_comment: 'Comment',
  mention: 'Mention',
};

function getReasonLabel(reason: string): string {
  return reasonLabels[reason] ?? reason;
}

function getNotificationTitle(item: ApiNotificationItem): string {
  if (item.reasons.includes('own_post_comment')) {
    return `${item.comment_author?.display_name ?? 'Someone'} commented on your post`;
  }
  if (item.reasons.includes('mention')) {
    return item.source_type === 'comment'
      ? `${item.comment_author?.display_name ?? 'Someone'} mentioned you in a comment`
      : `${item.account.display_name} mentioned you in a post`;
  }
  return `${item.account.display_name} posted`;
}

function getExcerpt(item: ApiNotificationItem): string {
  const text = item.comment?.text ?? item.post.text;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function NotificationRow({ item }: { item: ApiNotificationItem }) {
  return (
    <Link
      to={`/posts/${item.post.id}`}
      className={[
        'block rounded-md border bg-white p-3 shadow-sm transition hover:border-neutral-300',
        item.is_read ? 'border-neutral-200' : 'border-neutral-950',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {item.reasons.map((reason) => (
              <span
                key={reason}
                className={[
                  'rounded px-1.5 py-0.5 text-[11px] font-bold uppercase leading-4',
                  item.is_read
                    ? 'bg-neutral-100 text-neutral-500'
                    : 'bg-neutral-950 text-white',
                ].join(' ')}
              >
                {getReasonLabel(reason)}
              </span>
            ))}
          </div>
          <p className="truncate text-sm font-bold text-neutral-950">
            {getNotificationTitle(item)}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-neutral-500">
            {item.post.title}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
            {getExcerpt(item)}
          </p>
        </div>
        <time
          dateTime={item.created_at}
          className="shrink-0 text-xs font-semibold text-neutral-400"
        >
          {formatRelativeTime(item.created_at)}
        </time>
      </div>
    </Link>
  );
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const {
    activeApiUserId,
    items,
    unreadCount,
    hasMore,
    isLoading,
    isMarkingRead,
    error,
    loadMore,
    markAllRead,
  } = useNotifications({ limit: PAGE_LIMIT, unreadOnly });
  const emptyState = unreadOnly
    ? {
        title: 'No unread notifications',
        description: "You're caught up. Switch to All to review earlier updates.",
      }
    : {
        title: 'No notifications yet',
        description: 'Follow accounts, comment, and mention people to see updates here.',
      };

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="Select an API user"
        description="Choose a backend seed user before viewing notifications."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-neutral-400">
              Notifications
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-950">
              {unreadCount > 0
                ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
                : 'All caught up'}
            </h1>
          </div>
          <button
            type="button"
            className="h-9 shrink-0 rounded-md bg-neutral-950 px-3 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={isLoading || isMarkingRead || unreadCount === 0}
            onClick={markAllRead}
          >
            {isMarkingRead ? 'Marking...' : 'Mark all read'}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 rounded-md border border-neutral-200 bg-neutral-100 p-1">
          {[
            { label: 'All', value: false },
            { label: 'Unread', value: true },
          ].map((option) => {
            const selected = unreadOnly === option.value;

            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                className={[
                  'h-8 rounded text-sm font-bold transition',
                  selected
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-950',
                ].join(' ')}
                onClick={() => setUnreadOnly(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {isLoading && items.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          Loading notifications...
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} />
          ))}

          {hasMore ? (
            <button
              type="button"
              className="h-10 w-full rounded-md border border-neutral-200 bg-white text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
              disabled={isLoading}
              onClick={() => void loadMore()}
            >
              {isLoading ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </div>
      ) : (
        <EmptyState title={emptyState.title} description={emptyState.description} />
      )}
    </div>
  );
}
