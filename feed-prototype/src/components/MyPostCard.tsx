import { useState } from 'react';
import { Link } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { deletePost } from '../api/postsApi';
import { getApiBaseUrl } from '../config/apiConfig';
import type { FeedItem } from '../types/feed';
import ConfirmDialog from './ConfirmDialog';
import FeedCard from './FeedCard';

type MyPostCardProps = {
  item: FeedItem;
  /** Called after a successful delete so the parent can drop it from the list. */
  onDeleted: (postId: string) => void;
};

function getDeletePostErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `서버(${getApiBaseUrl()})에 연결할 수 없습니다.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return '내 게시글만 삭제할 수 있습니다.';
    }

    return `게시글을 삭제하지 못했습니다. (${error.status})`;
  }

  return '게시글을 삭제하지 못했습니다. 다시 시도해 주세요.';
}

/**
 * A "my post" row for the Me tab (v0.2.3): the normal `FeedCard` plus an inline
 * management strip (Edit / Delete). Deleting removes the post from the list in
 * place instead of navigating away, which fits managing several posts at once.
 */
export default function MyPostCard({ item, onDeleted }: MyPostCardProps) {
  const { post } = item;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await deletePost(post.id);
      onDeleted(post.id);
    } catch (deleteError) {
      setError(getDeletePostErrorMessage(deleteError));
      setIsDeleting(false);
      setIsConfirmOpen(false);
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
          수정
        </Link>
        <button
          type="button"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:text-red-300"
          disabled={isDeleting}
          onClick={() => setIsConfirmOpen(true)}
        >
          {isDeleting ? '삭제하는 중...' : '삭제'}
        </button>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {isConfirmOpen ? (
        <ConfirmDialog
          title="게시글을 삭제할까요?"
          description={`“${post.title}” 게시글이 영구 삭제됩니다.`}
          confirmLabel="삭제"
          danger
          isConfirming={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setIsConfirmOpen(false)}
        />
      ) : null}
    </div>
  );
}
