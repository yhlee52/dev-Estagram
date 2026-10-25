import { useState } from 'react';
import { Link } from 'react-router';
import type { ApiNotificationItem } from '../api/types';
import EmptyState from '../components/EmptyState';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime } from '../utils/format';

const PAGE_LIMIT = 20;

const reasonLabels: Record<string, string> = {
  followed_post: '팔로잉',
  own_post_comment: '댓글',
  mention: '언급',
};

function getReasonLabel(reason: string): string {
  return reasonLabels[reason] ?? reason;
}

function getNotificationTitle(item: ApiNotificationItem): string {
  if (item.reasons.includes('own_post_comment')) {
    return `${item.comment_author?.display_name ?? '누군가'}님이 내 게시글에 댓글을 남겼습니다`;
  }
  if (item.reasons.includes('mention')) {
    return item.source_type === 'comment'
      ? `${item.comment_author?.display_name ?? '누군가'}님이 댓글에서 나를 언급했습니다`
      : `${item.account.display_name}님이 게시글에서 나를 언급했습니다`;
  }
  return `${item.account.display_name}님이 게시글을 올렸습니다`;
}

function getExcerpt(item: ApiNotificationItem): string {
  const text = item.comment?.text ?? item.post.text;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function NotificationRow({ item }: { item: ApiNotificationItem }) {
  return (
    <Link
      to={`/posts/${item.post.id}${item.source_type === 'comment' ? '#comments' : ''}`}
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
        title: '읽지 않은 알림이 없습니다',
        description: '전체 알림에서 이전 활동을 볼 수 있습니다.',
      }
    : {
        title: '아직 알림이 없습니다',
        description: '계정을 팔로우하거나 댓글을 남기면 활동이 표시됩니다.',
      };

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="로그인이 필요합니다"
        description="로그인한 뒤 알림을 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-neutral-400">
              알림
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-950">
              {unreadCount > 0
                ? `읽지 않은 알림 ${unreadCount}개`
                : '모든 알림을 확인했습니다'}
            </h1>
          </div>
          <button
            type="button"
            className="h-9 shrink-0 rounded-md bg-neutral-950 px-3 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={isLoading || isMarkingRead || unreadCount === 0}
            onClick={markAllRead}
          >
            {isMarkingRead ? '처리하는 중...' : '모두 읽음'}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 rounded-md border border-neutral-200 bg-neutral-100 p-1">
          {[
            { label: '전체', value: false },
            { label: '읽지 않음', value: true },
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
          알림을 불러오는 중...
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
              {isLoading ? '불러오는 중...' : '더 보기'}
            </button>
          ) : null}
        </div>
      ) : (
        <EmptyState title={emptyState.title} description={emptyState.description} />
      )}
    </div>
  );
}
