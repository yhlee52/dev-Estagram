import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getAccount } from '../api/accountsApi';
import { getPost, updatePost } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import EmptyState from '../components/EmptyState';
import PostEditor, { type PostEditorValues } from '../components/PostEditor';
import { getApiBaseUrl } from '../config/apiConfig';
import { isApiMode } from '../config/dataSource';
import {
  mapApiAccountToAccount,
  mapApiPostToPost,
} from '../data/apiFeedRepository';
import type { Account, Post } from '../types/feed';

function getEditPostErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return 'Only the account that wrote this post can edit it.';
    }

    if (error.status === 404) {
      return 'This post or account was not found in the backend database.';
    }

    return `The backend API returned ${error.status}. ${error.message}`;
  }

  return 'Could not save this post. Check the backend server and try again.';
}

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

export default function EditPostPage() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const { activeApiUserId } = useActiveApiUser();
  const [post, setPost] = useState<Post | undefined>();
  const [account, setAccount] = useState<Account | undefined>();
  const [isLoading, setIsLoading] = useState(isApiMode());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isApiMode() || !postId) {
      return;
    }

    let isMounted = true;

    const loadPost = async () => {
      setIsLoading(true);
      setError('');

      try {
        const postResponse = await getPost(postId);
        const accountResponse = await getAccount(postResponse.account_id);

        if (isMounted) {
          setPost(mapApiPostToPost(postResponse, postResponse.assets));
          setAccount(mapApiAccountToAccount(accountResponse));
        }
      } catch (loadError) {
        if (isMounted) {
          setPost(undefined);
          setAccount(undefined);
          setError(getEditPostErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPost();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  if (!isApiMode()) {
    return (
      <EmptyState
        title="API mode only"
        description="Post editing is available only when the app is using the backend API data source."
      />
    );
  }

  if (!activeApiUserId) {
    return (
      <EmptyState
        title="Select an API user"
        description="Choose or register an API user before editing a post."
      />
    );
  }

  if (isLoading) {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
        Loading API post...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
        <Link className="block text-sm font-semibold text-neutral-950" to="/">
          Home
        </Link>
      </div>
    );
  }

  if (!post || !account || !postId) {
    return (
      <EmptyState
        title="Post not found"
        description="Choose a post from the home feed before editing."
      />
    );
  }

  const isOwnApiPost = getAccountUserId(account) === activeApiUserId;

  if (!isOwnApiPost) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Edit unavailable"
          description="Only the account that wrote this post can edit it."
        />
        <Link
          className="block rounded-md bg-neutral-950 px-3 py-2 text-center text-sm font-bold text-white"
          to={`/posts/${postId}`}
        >
          Back to Post
        </Link>
      </div>
    );
  }

  const handleSubmit = async (values: PostEditorValues) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const updatedPost = await updatePost(postId, {
        user_id: activeApiUserId,
        title: values.title,
        text: values.text,
        tags: values.tags,
        metadata_json: values.metadata_json,
        assets: values.assets,
      });
      setPost(mapApiPostToPost(updatedPost, updatedPost.assets));
      navigate(`/posts/${postId}`);
    } catch (updateError) {
      setSubmitError(getEditPostErrorMessage(updateError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between gap-3">
        <Link
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          to={`/posts/${postId}`}
        >
          Back
        </Link>
        <p className="text-xs font-bold uppercase text-neutral-400">Edit post</p>
      </nav>

      <PostEditor
        mode="edit"
        initialPost={post}
        isSubmitting={isSubmitting}
        error={submitError}
        onCancel={() => navigate(`/posts/${postId}`)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
