import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, ApiNetworkError } from '../api/client';
import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
  type CommentSort,
} from '../api/commentsApi';
import type { ApiCommentWithAuthor } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';
import { formatDateTime } from '../utils/format';
import ConfirmDialog from './ConfirmDialog';
import MentionText from './MentionText';

type CommentsSectionProps = {
  postId: string;
};

const MAX_COMMENT_LENGTH = 2000;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return 'Only the author can change this comment.';
    }

    return error.message;
  }

  return fallback;
}

function CommentAvatar({ name, src }: { name: string; src?: string | null }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || 'A';

  if (!src || hasImageError) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className="size-8 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
      onError={() => setHasImageError(true)}
    />
  );
}

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const { activeApiUserId } = useActiveApiUser();
  const [comments, setComments] = useState<ApiCommentWithAuthor[]>([]);
  const [sort, setSort] = useState<CommentSort>('oldest');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let isMounted = true;

    const loadComments = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await getComments(postId, sort);
        if (isMounted) {
          setComments(response.items);
        }
      } catch (error) {
        if (isMounted) {
          setComments([]);
          setLoadError(getErrorMessage(error, 'Could not load comments.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadComments();

    return () => {
      isMounted = false;
    };
  }, [postId, sort, reloadKey]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!activeApiUserId || !text || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await createComment(postId, { text });
      setDraft('');
      reload();
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not post your comment.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: ApiCommentWithAuthor) => {
    setEditingId(item.comment.id);
    setEditDraft(item.comment.text);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
    setEditError('');
  };

  const handleSaveEdit = async (commentId: string) => {
    const text = editDraft.trim();
    if (!activeApiUserId || !text || isSavingEdit) {
      return;
    }

    setIsSavingEdit(true);
    setEditError('');

    try {
      await updateComment(commentId, { text });
      cancelEdit();
      reload();
    } catch (error) {
      setEditError(getErrorMessage(error, 'Could not save your changes.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!activeApiUserId || !pendingDeleteId || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setActionError('');

    try {
      await deleteComment(pendingDeleteId);
      setPendingDeleteId(null);
      reload();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not delete the comment.'));
      setPendingDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      id="comments"
      className="scroll-mt-4 space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-neutral-950">
          Comments
          {comments.length > 0 ? (
            <span className="ml-1 text-neutral-400">({comments.length})</span>
          ) : null}
        </h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
          Sort
          <select
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-700"
            value={sort}
            onChange={(event) => setSort(event.target.value as CommentSort)}
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {activeApiUserId ? (
        <form className="space-y-2" onSubmit={handleSubmit}>
          <textarea
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950"
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Add a comment..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {submitError ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {submitError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              disabled={isSubmitting || !draft.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-500">
          Select an active API user to write comments.
        </p>
      )}

      {actionError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {actionError}
        </p>
      ) : null}

      {isLoading ? (
        <p className="px-1 py-4 text-center text-sm font-semibold text-neutral-500">
          Loading comments...
        </p>
      ) : loadError ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm font-medium text-neutral-400">
          No comments yet. Be the first to add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((item) => {
            const { comment, author } = item;
            const isOwn = comment.author_user_id === activeApiUserId;
            const isEditing = editingId === comment.id;
            const wasEdited = comment.updated_at !== comment.created_at;

            return (
              <li
                key={comment.id}
                className="space-y-2 rounded-md border border-neutral-100 bg-neutral-50 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <CommentAvatar name={author.display_name} src={author.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate text-sm font-bold text-neutral-950">
                        {author.display_name}
                      </span>
                      <span className="truncate text-xs text-neutral-500">
                        @{author.handle}
                      </span>
                      <time
                        className="text-xs text-neutral-400"
                        dateTime={comment.created_at}
                      >
                        {formatDateTime(comment.created_at)}
                        {wasEdited ? ' (edited)' : ''}
                      </time>
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950"
                          rows={3}
                          maxLength={MAX_COMMENT_LENGTH}
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                        />
                        {editError ? (
                          <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                            {editError}
                          </p>
                        ) : null}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-700"
                            onClick={cancelEdit}
                            disabled={isSavingEdit}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                            onClick={() => handleSaveEdit(comment.id)}
                            disabled={isSavingEdit || !editDraft.trim()}
                          >
                            {isSavingEdit ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <MentionText
                        text={comment.text}
                        className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700"
                      />
                    )}
                  </div>
                </div>

                {isOwn && !isEditing ? (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100"
                      onClick={() => setPendingDeleteId(comment.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {pendingDeleteId ? (
        <ConfirmDialog
          title="Delete comment?"
          description="This comment will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          danger
          isConfirming={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      ) : null}
    </section>
  );
}
