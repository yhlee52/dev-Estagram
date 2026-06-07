import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import AssetRenderer from '../components/AssetRenderer';
import EmptyState from '../components/EmptyState';
import MetadataTable from '../components/MetadataTable';
import PostBadges from '../components/PostBadges';
import TagList from '../components/TagList';
import postsData from '../data/posts.json';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import type { Account, Post } from '../types/feed';
import { formatDateTime } from '../utils/format';

const posts = postsData as unknown as Post[];

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

export default function PostDetail() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const accounts = useEffectiveAccounts();
  const post = posts.find((postItem) => postItem.id === postId);
  const account = post
    ? accounts.find((accountItem) => accountItem.id === post.accountId)
    : undefined;

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
          <Link
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
            to={`/accounts/${account.id}`}
          >
            Account
          </Link>
          <Link className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-bold text-white" to="/">
            Home
          </Link>
        </div>
      </nav>

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
        <div className="space-y-3">
          <PostBadges post={post} />
          <h1 className="text-2xl font-bold leading-8 text-neutral-950">{post.title}</h1>
        </div>

        {post.caption ? (
          <p className="whitespace-pre-wrap text-base leading-7 text-neutral-700">
            {post.caption}
          </p>
        ) : null}

        <div className="rounded-md bg-neutral-50 px-3 py-2">
          <p className="text-xs font-bold uppercase text-neutral-400">Created</p>
          <time className="mt-1 block text-sm font-semibold text-neutral-700" dateTime={post.createdAt}>
            {formatDateTime(post.createdAt)}
          </time>
        </div>

        {post.tags.length > 0 ? <TagList tags={post.tags} /> : null}
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-sm font-bold text-neutral-950">Assets</h2>
          <span className="text-xs font-medium text-neutral-400">
            {post.assets.length} item{post.assets.length === 1 ? '' : 's'}
          </span>
        </div>

        {post.assets.length > 0 ? (
          post.assets.map((asset) => (
            <section
              key={asset.id}
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
          ))
        ) : (
          <EmptyState
            title="No assets"
            description="Assets attached to this post will appear here."
          />
        )}
      </section>

      {post.metadata ? <MetadataTable metadata={post.metadata} /> : null}
    </article>
  );
}
