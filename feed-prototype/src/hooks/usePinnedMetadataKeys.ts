import { useCallback, useEffect, useState } from 'react';

/**
 * Pinned metadata keys (v0.4.1): metadata keys the user chose to surface as
 * chips on feed cards. A personal display preference, persisted to
 * localStorage so it survives navigation/sessions. URL sync is intentionally
 * out of scope (not a shareable filter).
 *
 * Mirrors the active-api-user pattern: a custom event syncs other components in
 * the same tab, and the `storage` event syncs across tabs.
 */
export const PINNED_METADATA_KEYS_STORAGE_KEY = 'feed-prototype:pinned-metadata-keys';
const PINNED_METADATA_KEYS_EVENT = 'feed-prototype-pinned-metadata-keys-change';

const readPinnedKeys = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PINNED_METADATA_KEYS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string')
      : [];
  } catch {
    return [];
  }
};

const writePinnedKeys = (keys: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PINNED_METADATA_KEYS_STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new Event(PINNED_METADATA_KEYS_EVENT));
};

export const usePinnedMetadataKeys = () => {
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(readPinnedKeys);

  useEffect(() => {
    const sync = () => setPinnedKeys(readPinnedKeys());

    window.addEventListener('storage', sync);
    window.addEventListener(PINNED_METADATA_KEYS_EVENT, sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(PINNED_METADATA_KEYS_EVENT, sync);
    };
  }, []);

  const togglePinnedKey = useCallback((key: string) => {
    const current = readPinnedKeys();
    const next = current.includes(key)
      ? current.filter((existing) => existing !== key)
      : [...current, key];
    writePinnedKeys(next);
  }, []);

  return { pinnedKeys, togglePinnedKey };
};
