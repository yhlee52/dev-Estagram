import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import { getAccount } from '../api/accountsApi';
import { deletePost, getPost } from '../api/postsApi';
import { useActiveApiUser } from '../auth/apiActiveUser';
import AssetRenderer from '../components/AssetRenderer';
import AssetGallery from '../components/AssetGallery';
import BookmarkPanel from '../components/BookmarkPanel';
import CommentsSection from '../components/CommentsSection';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import MentionText from '../components/MentionText';
import MetadataTable from '../components/MetadataTable';
import PostBadges from '../components/PostBadges';
import TagList from '../components/TagList';
import postsData from '../data/posts.json';
import {
  mapApiAccountToAccount,
  mapApiPostToPost,
} from '../data/apiFeedRepository';
import { getApiBaseUrl } from '../config/apiConfig';
import { getDataSourceMode } from '../config/dataSource';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import type { Account, Post } from '../types/feed';
import { isVisualAsset } from '../utils/assetUtils';
import { formatDateTime } from '../utils/format';

const posts = postsData as unknown as Post[];
const isApiDataSource = getDataSourceMode() === 'api';

function getPostDetailErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError && error.status === 404) {
    return 'This post or account was not found in the backend database.';
  }

  return 'Could not load this API post. Check the backend server and try again.';
}

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

function AccountAvatar({ account }: { account: Account }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = account.displayName.trim().charAt(0).toUpperCase() || 'A';

  if (!account.avatarUrl || hasImageError) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-bold text-neutral-600 ring-1 ring-neutral-200">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={account.avatarUrl}
      alt={`${account.displayName} avatar`}
      className="size-12 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
      onError={() => setHasImageError(true)}
    />
  );
}

function getAccountUserId(account: Account): string {
  const userId = account.metadata?.user_id;

  return typeof userId === 'string' ? userId : '';
}

export default function PostDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { postId } = useParams();
  const accounts = useEffectiveAccounts();
  const { activeApiUserId } = useActiveApiUser();
  const [apiPost, setApiPost] = useState<Post | undefined>();
  const [apiAccount, setApiAccount] = useState<Account | undefined>();
  const [isLoading, setIsLoading] = useState(isApiDataSource);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!isApiDataSource || !postId) {
      return;
    }

    let isMounted = true;

    const loadPostDetail = async () => {
      setIsLoading(true);
      setError('');

      try {
        const postResponse = await getPost(postId);
        const accountResponse = await getAccount(postResponse.account_id);

        if (isMounted) {
          setApiPost(mapApiPostToPost(postResponse, postResponse.assets));
          setApiAccount(mapApiAccountToAccount(accountResponse));
        }
      } catch (loadError) {
        if (isMounted) {
          setApiPost(undefined);
          setApiAccount(undefined);
          setError(getPostDetailErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPostDetail();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const mockPost = posts.find((postItem) => postItem.id === postId);
  const mockAccount = mockPost
    ? accounts.find((accountItem) => accountItem.id === mockPost.accountId)
    : undefined;
  const post = isApiDataSource ? apiPost : mockPost;
  const account = isApiDataSource ? apiAccount : mockAccount;
  const postAssets = post?.assets ?? [];
  const nonVisualAssets = postAssets.filter((asset) => !isVisualAsset(asset));
  const postTags = post?.tags ?? [];
  const postCreatedAt = post?.createdAt ?? post?.created_at ?? '';
  const postUpdatedAt = post?.updatedAt ?? post?.updated_at ?? '';
  const postImportedAt = post?.importedAt ?? post?.imported_at ?? '';
  const shouldShowUpdatedAt =
    postUpdatedAt && postCreatedAt && postUpdatedAt !== postCreatedAt;
  const isOwnApiPost =
    isApiDataSource && account ? getAccountUserId(account) === activeApiUserId : false;

  useEffect(() => {
    if (isLoading || location.hash !== '#comments') {
      return;
    }

    document.getElementById('comments')?.scrollIntoView({ block: 'start' });
  }, [isLoading, location.hash, post?.id]);

  const handleConfirmDelete = async () => {
    if (!postId || !account || !activeApiUserId || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      await deletePost(postId);
      navigate(`/accounts/${account.id}`, { replace: true });
    } catch (deletePostError) {
      setDeleteError(getDeletePostErrorMessage(deletePostError));
      setIsConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

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
        <nav className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          <Link className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white" to="/">
            Home
          </Link>
        </nav>
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (!post || !account) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          <Link className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white" to="/">
            Home
          </Link>
        </nav>
        <EmptyState
          title="Post not found"
          description={
            postId
              ? `We could not find a post for ${postId}.`
              : 'Choose a post from the home feed.'
          }
        />
      </div>
    );
  }

  return (
    <article className="space-y-5">
      <nav className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          {isOwnApiPost ? (
            <>
              <Link
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
                to={`/posts/${post.id}/edit`}
              >
                Edit
              </Link>
              <button
                type="button"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:text-red-300"
                disabled={isDeleting}
                onClick={() => setIsConfirmOpen(true)}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : null}
          <Link
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
            to={`/accounts/${account.id}`}
          >
            Account
          </Link>
          {isApiDataSource ? (
            <Link
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
              to="#comments"
            >
              Comments
            </Link>
          ) : null}
          <Link className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white" to="/">
            Home
          </Link>
        </div>
      </nav>

      {deleteError ? (
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {deleteError}
        </p>
      ) : null}

      {isConfirmOpen ? (
        <ConfirmDialog
          title="Delete post?"
          description="This post will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          danger
          isConfirming={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setIsConfirmOpen(false)}
        />
      ) : null}

      <Link
        to={`/accounts/${account.id}`}
        className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300"
      >
        <AccountAvatar account={account} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-950">
            {account.displayName}
          </p>
          <p className="truncate text-xs text-neutral-500">@{account.handle}</p>
          {account.bio ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
              {account.bio}
            </p>
          ) : null}
        </div>
      </Link>

      <header className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase text-neutral-400">
            Data source: {isApiDataSource ? 'API' : 'Mock'}
          </p>
          {isApiDataSource ? (
            <p className="text-right text-xs font-semibold text-neutral-500">
              {isOwnApiPost ? 'Your post' : 'API post'}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <PostBadges post={post} />
          <h1 className="text-2xl font-bold leading-8 text-neutral-950">{post.title}</h1>
        </div>

        {post.caption ? (
          <MentionText
            text={post.caption}
            className="whitespace-pre-wrap text-base leading-7 text-neutral-700"
          />
        ) : null}

        <div className="rounded-md bg-neutral-50 px-3 py-2">
          <p className="text-xs font-bold uppercase text-neutral-400">Created</p>
          <time className="mt-1 block text-sm font-semibold text-neutral-700" dateTime={postCreatedAt}>
            {formatDateTime(postCreatedAt)}
          </time>
        </div>

        {shouldShowUpdatedAt ? (
          <div className="rounded-md bg-neutral-50 px-3 py-2">
            <p className="text-xs font-bold uppercase text-neutral-400">Updated</p>
            <time
              className="mt-1 block text-sm font-semibold text-neutral-700"
              dateTime={postUpdatedAt}
            >
              {formatDateTime(postUpdatedAt)}
            </time>
          </div>
        ) : null}

        {postImportedAt ? (
          <div className="rounded-md bg-neutral-50 px-3 py-2">
            <p className="text-xs font-bold uppercase text-neutral-400">Imported</p>
            <time
              className="mt-1 block text-sm font-semibold text-neutral-700"
              dateTime={postImportedAt}
            >
              {formatDateTime(postImportedAt)}
            </time>
          </div>
        ) : null}

        <TagList tags={postTags} />
      </header>

      {postAssets.length > 0 ? (
        <section className="space-y-3">
          <AssetGallery assets={postAssets} variant="full" />

          {nonVisualAssets.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between px-1">
                <h2 className="text-sm font-bold text-neutral-950">Other assets</h2>
                <span className="text-xs font-medium text-neutral-400">
                  {nonVisualAssets.length} item
                  {nonVisualAssets.length === 1 ? '' : 's'}
                </span>
              </div>

              {nonVisualAssets.map((asset, index) => (
                <section
                  key={asset.id ?? `${post.id}-asset-${index}`}
                  className="space-y-2 rounded-md border border-neutral-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 px-1">
                    <h3 className="min-w-0 truncate text-sm font-bold text-neutral-950">
                      {asset.title ?? `${asset.type} asset`}
                    </h3>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold uppercase text-neutral-500">
                      {asset.type}
                    </span>
                  </div>
                  <AssetRenderer asset={asset} variant="full" />
                </section>
              ))}
            </section>
          ) : null}
        </section>
      ) : null}

      {post.metadata ? <MetadataTable metadata={post.metadata} /> : null}

      {isApiDataSource ? <BookmarkPanel postId={post.id} /> : null}

      {isApiDataSource ? <CommentsSection postId={post.id} /> : null}
    </article>
  );
}
