import type { KeyboardEvent, MouseEvent } from 'react';
import { useBookmarks } from '../hooks/useBookmarks';

type BookmarkButtonProps = {
  postId: string;
  className?: string;
};

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6L8 11.1 3.5 13.6V3a.5.5 0 0 1 .5-.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Compact bookmark toggle for post cards (v0.5.1). Hidden when no API user is
 * selected. Stops click/key events from bubbling so a tap inside a clickable
 * `FeedCard` does not also open the post.
 */
export default function BookmarkButton({ postId, className }: BookmarkButtonProps) {
  const { activeApiUserId, isBookmarked, toggleBookmark, pendingPostId } =
    useBookmarks();

  if (!activeApiUserId) {
    return null;
  }

  const bookmarked = isBookmarked(postId);
  const isPending = pendingPostId === postId;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void toggleBookmark(postId);
  };

  return (
    <button
      type="button"
      aria-pressed={bookmarked}
      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      disabled={isPending}
      onClick={handleClick}
      onKeyDown={(event: KeyboardEvent) => event.stopPropagation()}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
        bookmarked
          ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
        className ?? '',
      ].join(' ')}
    >
      <BookmarkIcon filled={bookmarked} />
      {bookmarked ? 'Saved' : 'Save'}
    </button>
  );
}
