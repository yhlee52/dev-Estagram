import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getUserNotifications } from '../api/notificationsApi';
import type { ApiNotificationItem } from '../api/types';
import { getApiBaseUrl } from '../config/apiConfig';
import { formatRelativeTime } from '../utils/format';
import EmptyState from './EmptyState';

type MeMentionsSectionProps = {
  userId: string;
};

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}.`;
  }
  if (error instanceof ApiClientError) {
    return `Could not load mentions. The backend returned ${error.status}.`;
  }
  return 'Could not load mentions.';
}

export default function MeMentionsSection({ userId }: MeMentionsSectionProps) {
  const [mentions, setMentions] = useState<ApiNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadMentions = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await getUserNotifications(userId, { limit: 50 });
        if (isMounted) {
          setMentions(
            response.items
              .filter((item) => item.reasons.includes('mention'))
              .slice(0, 5),
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setMentions([]);
          setError(getLoadErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadMentions();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <h2 className="text-sm font-bold text-neutral-950">Mentions</h2>
        <Link
          to="/notifications"
          className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
        >
          All notifications
        </Link>
      </div>

      {isLoading ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          Loading mentions...
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : mentions.length > 0 ? (
        <ul className="space-y-2">
          {mentions.map((item) => (
            <li key={item.id}>
              <Link
                to={`/posts/${item.post.id}`}
                className="block rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-950">
                      {item.post.title}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-neutral-500">
                      {item.source_type === 'comment'
                        ? item.comment_author?.display_name ?? 'Comment'
                        : item.account.display_name}
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
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No mentions yet"
          description="Posts and comments that mention your handle will appear here."
        />
      )}
    </section>
  );
}
