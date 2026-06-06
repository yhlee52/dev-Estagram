import { Link, useNavigate, useParams } from 'react-router';
import AssetRenderer from '../components/AssetRenderer';
import EmptyState from '../components/EmptyState';
import MetadataTable from '../components/MetadataTable';
import TagList from '../components/TagList';
import accountsData from '../data/accounts.json';
import postsData from '../data/posts.json';
import type { Account, Post } from '../types/feed';
import { formatDateTime } from '../utils/format';

const accounts = accountsData as unknown as Account[];
const posts = postsData as unknown as Post[];

export default function PostDetail() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const post = posts.find((postItem) => postItem.id === postId);
  const account = post
    ? accounts.find((accountItem) => accountItem.id === post.accountId)
    : undefined;

  if (!post || !account) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <EmptyState
          title="Post not found"
          description={
            postId
              ? `We could not find a post for ${postId}.`
              : 'Choose a post from the home feed.'
          }
        />
        <Link className="block text-sm font-semibold text-neutral-950" to="/">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <Link className="text-sm font-bold text-neutral-950" to="/">
          Home
        </Link>
      </div>

      <Link
        to={`/accounts/${account.id}`}
        className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 ring-1 ring-neutral-200">
          {account.displayName.trim().charAt(0).toUpperCase() || 'A'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-950">
            {account.displayName}
          </p>
          <p className="truncate text-xs text-neutral-500">@{account.handle}</p>
        </div>
      </Link>

      <header className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold leading-7 text-neutral-950">{post.title}</h1>
        {post.caption ? (
          <p className="mt-2 text-sm leading-6 text-neutral-700">{post.caption}</p>
        ) : null}
        <time className="mt-3 block text-xs font-medium text-neutral-400" dateTime={post.createdAt}>
          {formatDateTime(post.createdAt)}
        </time>
      </header>

      {post.assets.length > 0 ? (
        <section className="space-y-3.5">
          {post.assets.map((asset) => (
            <div key={asset.id} className="space-y-2">
              {asset.title ? (
                <h2 className="px-1 text-sm font-bold text-neutral-950">{asset.title}</h2>
              ) : null}
              <AssetRenderer asset={asset} variant="full" />
            </div>
          ))}
        </section>
      ) : null}

      <TagList tags={post.tags} />

      {post.metadata ? <MetadataTable metadata={post.metadata} /> : null}
    </article>
  );
}
