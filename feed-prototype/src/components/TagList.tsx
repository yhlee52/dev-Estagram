import type { KeyboardEvent, MouseEvent } from 'react';
import { Link } from 'react-router';

type TagListProps = {
  tags?: string[];
};

/** Build the browse link that applies a single tag filter (v0.1.1). */
function tagToHref(tag: string): string {
  const params = new URLSearchParams({ tag });
  return `/posts?${params.toString()}`;
}

export default function TagList({ tags }: TagListProps) {
  const visibleTags = tags?.filter((tag) => tag.trim()) ?? [];

  if (visibleTags.length === 0) {
    return null;
  }

  // TagList can sit inside a clickable card (FeedCard), so stop the tag click
  // from bubbling up and triggering the card's own navigation.
  const stopBubbling = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <ul className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag) => (
        <li key={tag} className="max-w-full">
          <Link
            to={tagToHref(tag)}
            onClick={stopBubbling}
            onKeyDown={stopBubbling}
            className="inline-block max-w-full break-words rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
