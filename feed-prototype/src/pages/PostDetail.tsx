import { Link, useNavigate, useParams } from 'react-router';
import EmptyState from '../components/EmptyState';
import MetadataTable from '../components/MetadataTable';
import PostAssetPreview from '../components/PostAssetPreview';
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
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <EmptyState
          title="Post not found"
          description={postId ? `No post exists for ${postId}.` : 'No post was selected.'}
        />
        <Link className="block text-sm font-semibold text-neutral-950" to="/">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <Link className="text-sm font-semibold text-neutral-950" to="/">
          Home
        </Link>
      </div>

      <Link
        to={`/accounts/${account.id}`}
        className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-4"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600">
          {account.displayName.trim().charAt(0).toUpperCase() || 'A'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-950">
            {account.displayName}
          </p>
          <p className="truncate text-xs text-neutral-500">@{account.handle}</p>
        </div>
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold leading-8 text-neutral-950">{post.title}</h1>
        {post.caption ? (
          <p className="text-sm leading-6 text-neutral-700">{post.caption}</p>
        ) : null}
        <time className="block text-xs text-neutral-400" dateTime={post.createdAt}>
          {formatDateTime(post.createdAt)}
        </time>
      </header>

      {post.assets.length > 0 ? (
        <section className="space-y-4">
          {post.assets.map((asset) => (
            <div key={asset.id} className="space-y-2">
              {asset.title ? (
                <h2 className="text-sm font-semibold text-neutral-950">{asset.title}</h2>
              ) : null}
              <PostAssetPreview asset={asset} variant="full" />
            </div>
          ))}
        </section>
      ) : null}

      <TagList tags={post.tags} />

      {post.metadata ? <MetadataTable metadata={post.metadata} /> : null}
    </article>
  );
}
