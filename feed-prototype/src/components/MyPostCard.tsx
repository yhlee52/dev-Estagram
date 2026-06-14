import { useState } from 'react';
import { Link } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { deletePost } from '../api/postsApi';
import { getApiBaseUrl } from '../config/apiConfig';
import type { FeedItem } from '../types/feed';
import FeedCard from './FeedCard';

type MyPostCardProps = {
  item: FeedItem;
  /** Active API user id, required by the backend to authorize the delete. */
  userId: string;
  /** Called after a successful delete so the parent can drop it from the list. */
  onDeleted: (postId: string) => void;
};

function getDeletePostErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return 'Only the account that wrote this post can delete it.';
    }

    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not delete this post. Check the backend server and try again.';
}

/**
 * A "my post" row for the Me tab (v0.2.3): the normal `FeedCard` plus an inline
 * management strip (Edit / Delete). Deleting removes the post from the list in
 * place instead of navigating away, which fits managing several posts at once.
 */
export default function MyPostCard({ item, userId, onDeleted }: MyPostCardProps) {
  const { post } = item;
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${post.title}"?`);
    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await deletePost(post.id, userId);
      onDeleted(post.id);
    } catch (deleteError) {
      setError(getDeletePostErrorMessage(deleteError));
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <FeedCard item={item} />

      <div className="flex items-center justify-end gap-2">
        <Link
          to={`/posts/${post.id}/edit`}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
        >
          Edit
        </Link>
        <button
          type="button"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:text-red-300"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
