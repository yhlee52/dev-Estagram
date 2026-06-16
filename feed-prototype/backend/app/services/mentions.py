from __future__ import annotations

import re


MENTION_PATTERN = r"@([a-zA-Z0-9_]+(?:[.-][a-zA-Z0-9_]+)*)"
HASHTAG_PATTERN = r"#([a-zA-Z][a-zA-Z0-9_]*(?:[.-][a-zA-Z0-9_]+)*)"
TOKEN_RE = re.compile(rf"(?:{MENTION_PATTERN})|(?:{HASHTAG_PATTERN})")
WORD_CHAR_RE = re.compile(r"[a-zA-Z0-9_]")


def normalize_mention_handle(handle: str) -> str:
    return handle.strip().removeprefix("@").lower()


def find_mentioned_handles(text: str) -> set[str]:
    """Return normalized `@handle` mentions using the frontend token rules.

    This mirrors ``src/utils/mentions.ts``: handles allow ``.``/``-`` separators,
    and a token preceded by a word character (email/user@host, embedded words) is
    ignored. Hashtags are recognized only so the shared regex can skip over them.
    """
    handles: set[str] = set()

    for match in TOKEN_RE.finditer(text):
        preceding = text[match.start() - 1] if match.start() > 0 else ""
        if preceding and WORD_CHAR_RE.fullmatch(preceding):
            continue

        raw = match.group(0)
        if raw.startswith("@"):
            handles.add(normalize_mention_handle(match.group(1)))

    return handles


def mentions_handle(text: str, handle: str) -> bool:
    return normalize_mention_handle(handle) in find_mentioned_handles(text)
