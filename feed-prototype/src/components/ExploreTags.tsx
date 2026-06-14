import { Link } from 'react-router';
import type { ApiTagCount } from '../api/types';

type ExploreTagsProps = {
  /** Most-used tags (highest count first). */
  popularTags: ApiTagCount[];
  /** Tags from the most recent posts, newest first, already deduped. */
  recentTags: string[];
};

/** Build the browse link that applies a single tag filter (matches TagList). */
function tagToHref(tag: string): string {
  const params = new URLSearchParams({ tag });
  return `/posts?${params.toString()}`;
}

function TagChip({ tag, count }: { tag: string; count?: number }) {
  return (
    <li className="max-w-full">
      <Link
        to={tagToHref(tag)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      >
        <span className="truncate">#{tag}</span>
        {count !== undefined ? (
          <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 text-xs font-bold text-neutral-500">
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * Explore landing for the Posts tab (v0.2.2): popular and recent tag clusters
 * plus an entry point into the Accounts directory. Tags route to the existing
 * `/posts?tag=<tag>` filter, so picking one swaps this section for results.
 */
export default function ExploreTags({
  popularTags,
  recentTags,
}: ExploreTagsProps) {
  const hasPopular = popularTags.length > 0;
  const hasRecent = recentTags.length > 0;

  return (
    <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-100 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-950">Discover</h2>
          <p className="text-xs font-semibold text-neutral-500">
            Jump in by tag, or browse accounts.
          </p>
        </div>
        <Link
          to="/accounts"
          className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-950"
        >
          Browse accounts →
        </Link>
      </div>

      {hasPopular ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Popular tags
          </h3>
          <ul className="flex flex-wrap gap-2">
            {popularTags.map((item) => (
              <TagChip key={item.tag} tag={item.tag} count={item.count} />
            ))}
          </ul>
        </div>
      ) : null}

      {hasRecent ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Recent tags
          </h3>
          <ul className="flex flex-wrap gap-2">
            {recentTags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </ul>
        </div>
      ) : null}

      {!hasPopular && !hasRecent ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3 text-xs font-semibold leading-5 text-neutral-500">
          No tags yet. Tags will appear here as posts are added.
        </p>
      ) : null}
    </section>
  );
}
