import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { createPost } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import EmptyState from '../components/EmptyState';
import PostEditor, { type PostEditorValues } from '../components/PostEditor';

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

  const handleSubmit = async (values: PostEditorValues) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const createdItem = await createPost({
        user_id: activeApiUserId,
        title: values.title,
        text: values.text,
        tags: values.tags,
        metadata_json: values.metadata_json,
        assets: values.assets,
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

      <PostEditor
        mode="create"
        isSubmitting={isSubmitting}
        error={error}
        onCancel={() => navigate('/')}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
