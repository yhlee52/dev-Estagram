import { Fragment, type KeyboardEvent, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useAccountDirectory } from '../hooks/useAccountDirectory';
import { parseMentionSegments } from '../utils/mentions';

type MentionTextProps = {
  text: string;
  className?: string;
};

/**
 * Render post text with `@handle` mentions linked to their account (v0.1.3).
 *
 * Handles that match a known account become a link to the account profile;
 * unknown handles stay as plain text. Like `TagList`, the link stops click /
 * key events from bubbling so a mention inside a clickable `FeedCard` does not
 * also trigger the card's own navigation.
 */
export default function MentionText({ text, className }: MentionTextProps) {
  const { resolveHandle } = useAccountDirectory();
  const segments = parseMentionSegments(text);

  const stopBubbling = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <p className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Fragment key={index}>{segment.value}</Fragment>;
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
