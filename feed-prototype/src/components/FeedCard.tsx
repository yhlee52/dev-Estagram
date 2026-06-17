import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { createComment, getComments } from '../api/commentsApi';
import type { ApiCommentWithAuthor } from '../api/types';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { isApiMode } from '../config/dataSource';
import { usePinnedMetadataKeys } from '../hooks/usePinnedMetadataKeys';
import type { FeedItem } from '../types/feed';
import { formatDateTime } from '../utils/format';
import AssetRenderer from './AssetRenderer';
import AssetGallery from './AssetGallery';
import BookmarkButton from './BookmarkButton';
import MentionText from './MentionText';
import MetadataSummary from './MetadataSummary';
import PinnedMetadataChips from './PinnedMetadataChips';
import PostBadges from './PostBadges';
import TagList from './TagList';
import { getSortedVisualAssets, isVisualAsset } from '../utils/assetUtils';

type FeedCardProps = {
  item: FeedItem;
};

const MAX_INLINE_COMMENT_LENGTH = 2000;
const COMMENT_PREVIEW_LIMIT = 3;
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea';

function Avatar({ src, name }: { src?: string; name: string }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || 'A';

  if (!src || hasImageError) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className="size-10 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
      onError={() => setHasImageError(true)}
    />
  );
}

export default function FeedCard({ item }: FeedCardProps) {
  const navigate = useNavigate();
  const { activeApiUserId } = useActiveApiUser();
  const { pinnedKeys } = usePinnedMetadataKeys();
  const { account, post } = item;
  const isApiDataSource = isApiMode();
  const postAssets = post.assets ?? [];
  const visualAssets = getSortedVisualAssets(postAssets);
  const nonVisualAssets = postAssets.filter((asset) => !isVisualAsset(asset));
  const postTags = post.tags ?? [];
  const previewAssets =
    visualAssets.length > 0 ? nonVisualAssets.slice(0, 1) : postAssets.slice(0, 2);
  const hiddenAssetCount =
    postAssets.length - visualAssets.length - previewAssets.length;
  const postCreatedAt = post.createdAt ?? post.created_at ?? '';
  const postUpdatedAt = post.updatedAt ?? post.updated_at ?? '';
  const shouldShowUpdatedAt =
    postUpdatedAt && postCreatedAt && postUpdatedAt !== postCreatedAt;
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [isCommentComposerOpen, setIsCommentComposerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [previewComments, setPreviewComments] = useState<ApiCommentWithAuthor[]>([]);
  const [commentsLoadError, setCommentsLoadError] = useState('');
  const [areAllCommentsShown, setAreAllCommentsShown] = useState(false);

  useEffect(() => {
    setCommentCount(post.commentCount ?? 0);
    setIsCommentComposerOpen(false);
    setCommentDraft('');
    setCommentError('');
    setPreviewComments([]);
    setCommentsLoadError('');
    setAreAllCommentsShown(false);
  }, [post.id, post.commentCount]);

  useEffect(() => {
    if (!isApiDataSource || commentCount === 0) {
      setPreviewComments([]);
      return;
    }

    let isMounted = true;

    const loadPreviewComments = async () => {
      setCommentsLoadError('');

      try {
        const response = await getComments(post.id, 'newest');
        if (isMounted) {
          setPreviewComments(response.items);
        }
      } catch {
        if (isMounted) {
          setPreviewComments([]);
          setCommentsLoadError('Could not load comments.');
        }
      }
    };

    void loadPreviewComments();

    return () => {
      isMounted = false;
    };
  }, [commentCount, isApiDataSource, post.id]);

  const goToPost = () => {
    navigate(`/posts/${post.id}`);
  };

  const goToAccount = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/accounts/${account.id}`);
  };

  const toggleCommentComposer = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsCommentComposerOpen((isOpen) => !isOpen);
    setCommentError('');
  };

  const goToComments = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/posts/${post.id}#comments`);
  };

  const handleCommentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const text = commentDraft.trim();
    if (!activeApiUserId || !text || isSubmittingComment) {
      return;
    }

    setIsSubmittingComment(true);
    setCommentError('');

    try {
      const created = await createComment(post.id, { user_id: activeApiUserId, text });
      setCommentDraft('');
      setCommentCount((count) => count + 1);
      setPreviewComments((items) => [created, ...items]);
      setAreAllCommentsShown(false);
    } catch {
      setCommentError('Could not post your comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const visibleComments = areAllCommentsShown
    ? previewComments
    : previewComments.slice(0, COMMENT_PREVIEW_LIMIT);
  const hiddenCommentCount = Math.max(
    0,
    commentCount - Math.min(previewComments.length, COMMENT_PREVIEW_LIMIT),
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(INTERACTIVE_SELECTOR)
    ) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToPost();
    }
  };

  return (
    <article
      tabIndex={0}
      role="link"
      aria-label={`Open ${post.title}`}
      className="cursor-pointer overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      onClick={goToPost}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-2 pr-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
          onClick={goToAccount}
        >
          <Avatar src={account.avatarUrl} name={account.displayName} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-950">
              {account.displayName}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              @{account.handle}
            </span>
          </span>
        </button>
        {isApiDataSource ? <BookmarkButton postId={post.id} /> : null}
      </div>

      <div className="space-y-4 px-4 pb-4">
        {postAssets.length > 0 ? (
          <div className="space-y-2">
            <AssetGallery assets={postAssets} variant="compact" />
            {previewAssets.map((asset, index) => (
              <AssetRenderer
                key={asset.id ?? `${post.id}-asset-${index}`}
                asset={asset}
              />
            ))}
            {hiddenAssetCount > 0 ? (
              <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-500">
                +{hiddenAssetCount} more asset
                {hiddenAssetCount === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <PostBadges post={post} />
            <h2 className="text-base font-bold leading-6 text-neutral-950">
              {post.title}
            </h2>
            {post.caption ? (
              <MentionText
                text={post.caption}
                className="text-sm leading-6 text-neutral-600"
              />
            ) : null}
          </div>

          <PinnedMetadataChips metadata={post.metadata} pinnedKeys={pinnedKeys} />

          <TagList tags={postTags} />

          <MetadataSummary metadata={post.metadata} excludeKeys={pinnedKeys} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-neutral-400">
            <time dateTime={postCreatedAt}>
              Created: {formatDateTime(postCreatedAt)}
            </time>
            {shouldShowUpdatedAt ? (
              <time dateTime={postUpdatedAt}>
                Updated: {formatDateTime(postUpdatedAt)}
              </time>
            ) : null}
            {isApiDataSource ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950"
                aria-expanded={isCommentComposerOpen}
                aria-label={`${commentCount} comment${commentCount === 1 ? '' : 's'}. Add a comment.`}
                onClick={toggleCommentComposer}
              >
                <span aria-hidden="true">💬</span>
                {commentCount}
                <span className="sr-only">Add a comment</span>
              </button>
            ) : null}
          </div>

          {isApiDataSource && commentCount > 0 ? (
            <div className="space-y-2 rounded-md bg-neutral-50 px-3 py-2">
              {commentsLoadError ? (
                <p className="text-xs font-semibold text-red-700">
                  {commentsLoadError}
                </p>
              ) : visibleComments.length > 0 ? (
                <ul className="space-y-1.5">
                  {visibleComments.map(({ comment, author }) => (
                    <li key={comment.id} className="text-sm leading-6 text-neutral-700">
                      <span className="font-bold text-neutral-950">
                        {author.display_name}
                      </span>{' '}
                      <MentionText text={comment.text} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-semibold text-neutral-400">
                  Loading comments...
                </p>
              )}

              {!areAllCommentsShown && hiddenCommentCount > 0 ? (
                <button
                  type="button"
                  className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAreAllCommentsShown(true);
                  }}
                >
                  Show {hiddenCommentCount} more comment
                  {hiddenCommentCount === 1 ? '' : 's'}
                </button>
              ) : null}
            </div>
          ) : null}

          {isApiDataSource && isCommentComposerOpen ? (
            <div
              className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {activeApiUserId ? (
                <form className="space-y-2" onSubmit={handleCommentSubmit}>
                  <textarea
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-950"
                    rows={2}
                    maxLength={MAX_INLINE_COMMENT_LENGTH}
                    placeholder="Add a comment..."
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                  />
                  {commentError ? (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {commentError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100"
                      onClick={goToComments}
                    >
                      View thread
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                      disabled={isSubmittingComment || !commentDraft.trim()}
                    >
                      {isSubmittingComment ? 'Posting...' : 'Post comment'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs font-semibold text-neutral-500">
                  Select an active API user to write comments.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
