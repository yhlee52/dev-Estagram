import { Fragment, type KeyboardEvent, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useAccountDirectory } from '../hooks/useAccountDirectory';
import { parseRichTextSegments } from '../utils/mentions';

type MentionTextProps = {
  text: string;
  className?: string;
};

/** Build the browse link that applies a single tag filter (mirrors `TagList`). */
function tagToHref(tag: string): string {
  const params = new URLSearchParams({ tag });
  return `/posts?${params.toString()}`;
}

/**
 * Render post/comment text with linked `@handle` mentions (v0.1.3) and `#tag`
 * hashtags (v0.5.0).
 *
 * Handles that match a known account become a link to the account profile;
 * unknown handles stay as plain text. Hashtags always link to the tag filter
 * (`/posts?tag=...`), matching `TagList`. Like `TagList`, links stop click / key
 * events from bubbling so a token inside a clickable `FeedCard` does not also
 * trigger the card's own navigation.
 */
export default function MentionText({ text, className }: MentionTextProps) {
  const { resolveHandle } = useAccountDirectory();
  const segments = parseRichTextSegments(text);

  const stopBubbling = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <p className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Fragment key={index}>{segment.value}</Fragment>;
        }

        if (segment.type === 'hashtag') {
          return (
            <Link
              key={index}
              to={tagToHref(segment.tag)}
              onClick={stopBubbling}
              onKeyDown={stopBubbling}
              className="font-semibold text-neutral-900 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              {segment.raw}
            </Link>
          );
        }

        const account = resolveHandle(segment.handle);

        if (!account) {
          return <Fragment key={index}>{segment.raw}</Fragment>;
        }

        return (
          <Link
            key={index}
            to={`/accounts/${account.id}`}
            onClick={stopBubbling}
            onKeyDown={stopBubbling}
            className="font-semibold text-neutral-900 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            {segment.raw}
          </Link>
        );
      })}
    </p>
  );
}
