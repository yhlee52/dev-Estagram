import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { usePinnedMetadataKeys } from '../hooks/usePinnedMetadataKeys';
import type { FeedItem } from '../types/feed';
import { formatDateTime } from '../utils/format';
import AssetRenderer from './AssetRenderer';
import AssetGallery from './AssetGallery';
import MentionText from './MentionText';
import MetadataSummary from './MetadataSummary';
import PinnedMetadataChips from './PinnedMetadataChips';
import PostBadges from './PostBadges';
import TagList from './TagList';
import { getSortedVisualAssets, isVisualAsset } from '../utils/assetUtils';

type FeedCardProps = {
  item: FeedItem;
};

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
  const { pinnedKeys } = usePinnedMetadataKeys();
  const { account, post } = item;
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

  const goToPost = () => {
    navigate(`/posts/${post.id}`);
  };

  const goToAccount = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/accounts/${account.id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
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

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-neutral-400">
            <time dateTime={postCreatedAt}>
              Created: {formatDateTime(postCreatedAt)}
            </time>
            {shouldShowUpdatedAt ? (
              <time dateTime={postUpdatedAt}>
                Updated: {formatDateTime(postUpdatedAt)}
              </time>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
