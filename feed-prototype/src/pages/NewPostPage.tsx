import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { createPost } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import EmptyState from '../components/EmptyState';

function getCreatePostErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not create this post. Check the backend server and try again.';
}

export default function NewPostPage() {
  const navigate = useNavigate();
  const { activeApiUserId } = useActiveApiUser();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isApiMode()) {
    return (
      <EmptyState
        title="API mode only"
        description="Post creation is available only when the app is using the backend API data source."
      />
    );
  }

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="Select an API user"
        description="Choose or register an API user before writing a post."
      />
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const normalizedText = text.trim();

    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const createdItem = await createPost({
        user_id: activeApiUserId,
        title: trimmedTitle,
        text: normalizedText,
        metadata_json: {
          source: 'manual',
        },
      });

      navigate(`/posts/${createdItem.post.id}`);
    } catch (createError) {
      setError(getCreatePostErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between gap-3">
        <Link
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          to="/"
        >
          Cancel
        </Link>
        <p className="text-xs font-bold uppercase text-neutral-400">
          API post
        </p>
      </nav>

      <form
        className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="space-y-1.5">
          <label
            className="block text-xs font-bold uppercase text-neutral-400"
            htmlFor="post-title"
          >
            Title
          </label>
          <input
            id="post-title"
            className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-400"
            maxLength={200}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label
            className="block text-xs font-bold uppercase text-neutral-400"
            htmlFor="post-text"
          >
            Text
          </label>
          <textarea
            id="post-text"
            className="min-h-40 w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-950 outline-none transition focus:border-neutral-400"
            maxLength={5000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="h-11 w-full rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Publishing...' : 'Publish Post'}
        </button>
      </form>
    </div>
  );
}
