/**
 * Split post text into plain-text and `@mention` segments (v0.1.3).
 *
 * Post text uses `@handle` to refer to an account. This parser only finds the
 * candidate handles; whether a handle actually exists (and should become a
 * link) is decided by the caller against the account directory. Unknown handles
 * stay as plain text — see `MentionText`.
 *
 * Handle shape mirrors the handles we store (e.g. `mina.notes`,
 * `cafe.route.bot`): a run of word characters with single `.`/`-` separators
 * between runs. Because separators must sit between word characters, a trailing
 * `.`/`-` (sentence punctuation like "ask @mina.notes.") is left out of the
 * handle. An `@` glued to the end of a word (e.g. an email's `user@host`) is not
 * treated as a mention.
 */

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; handle: string; raw: string };

const MENTION_PATTERN = /@([a-zA-Z0-9_]+(?:[.-][a-zA-Z0-9_]+)*)/g;
const WORD_CHAR = /[a-zA-Z0-9_]/;

export function parseMentionSegments(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const matchStart = match.index ?? 0;
    const precedingChar = matchStart > 0 ? text[matchStart - 1] : '';

    // An `@` preceded by a word character is part of a token (e.g. an email
    // address), not a mention. Skip it; it stays inside the next text segment.
    if (WORD_CHAR.test(precedingChar)) {
      continue;
    }

    if (matchStart > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, matchStart) });
    }

    segments.push({ type: 'mention', handle: match[1], raw: match[0] });
    lastIndex = matchStart + match[0].length;
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
