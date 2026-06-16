/**
 * Split free text into plain-text, `@mention`, and `#hashtag` segments.
 *
 * Post and comment text use `@handle` to refer to an account (v0.1.3) and
 * `#tag` to refer to a tag (v0.5.0). This parser only finds the candidate
 * tokens; whether a handle exists (and should link) is decided by the caller
 * against the account directory, while a hashtag always links to the tag
 * filter. Unknown handles stay as plain text — see `MentionText`.
 *
 * Handle shape mirrors the handles we store (e.g. `mina.notes`,
 * `cafe.route.bot`): a run of word characters with single `.`/`-` separators
 * between runs. Hashtags follow the same shape but must start with a letter, so
 * issue-number noise like `#42` is left as text. Because a token glued to the
 * end of a word (an email's `user@host`, or `C#`) is not a reference, an `@`/`#`
 * preceded by a word character is not treated as a token.
 */

export type RichTextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; handle: string; raw: string }
  | { type: 'hashtag'; tag: string; raw: string };

const MENTION_PATTERN = '@([a-zA-Z0-9_]+(?:[.-][a-zA-Z0-9_]+)*)';
const HASHTAG_PATTERN = '#([a-zA-Z][a-zA-Z0-9_]*(?:[.-][a-zA-Z0-9_]+)*)';
const TOKEN_PATTERN = new RegExp(`(?:${MENTION_PATTERN})|(?:${HASHTAG_PATTERN})`, 'g');
const WORD_CHAR = /[a-zA-Z0-9_]/;

export function parseRichTextSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const matchStart = match.index ?? 0;
    const precedingChar = matchStart > 0 ? text[matchStart - 1] : '';

    // An `@`/`#` preceded by a word character is part of a token (e.g. an email
    // address or `C#`), not a reference. Skip it; it stays in the next segment.
    if (WORD_CHAR.test(precedingChar)) {
      continue;
    }

    if (matchStart > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, matchStart) });
    }

    const raw = match[0];
    if (raw[0] === '@') {
      segments.push({ type: 'mention', handle: match[1], raw });
    } else {
      segments.push({ type: 'hashtag', tag: match[2], raw });
    }

    lastIndex = matchStart + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

/** Normalize a handle for case-insensitive directory lookup (strips a leading `@`). */
export function normalizeMentionHandle(handle: string): string {
  return handle.trim().replace(/^@/, '').toLowerCase();
}
