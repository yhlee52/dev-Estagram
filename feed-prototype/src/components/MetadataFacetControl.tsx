import { useRef, useState } from 'react';
import { getMetadataValues } from '../api/metadataApi';
import type { ApiMetadataKeyCount, ApiMetadataValueCount } from '../api/types';

const FACET_VALUE_LIMIT = 50;

type MetadataFacetControlProps = {
  keySuggestions: ApiMetadataKeyCount[];
  onSelectFacet: (key: string, value: string) => void;
};

/**
 * Facet selection for metadata (v0.4.0): a key dropdown built from
 * data-derived `GET /api/metadata/keys`, and a value dropdown loaded on demand
 * from `GET /api/metadata/values?key=...`. Picking a value calls `onSelectFacet`,
 * which fills the free-input metadata fields with an exact match. The free
 * inputs (ILIKE) stay available; this control only helps fill them.
 *
 * Renders nothing when there are no known keys (mock mode or empty data), which
 * keeps the facet UI API-mode only without an explicit mode flag.
 *
 * Values are fetched in the key-change handler (not an effect) so a stale
 * response from a quickly-changed key can be discarded via `latestKeyRef`.
 */
export default function MetadataFacetControl({
  keySuggestions,
  onSelectFacet,
}: MetadataFacetControlProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const [values, setValues] = useState<ApiMetadataValueCount[]>([]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const latestKeyRef = useRef('');

  const handleKeyChange = (key: string) => {
    setSelectedKey(key);
    latestKeyRef.current = key;

    if (!key) {
      setValues([]);
      setIsLoadingValues(false);
      return;
    }

    setIsLoadingValues(true);
    void getMetadataValues(key, FACET_VALUE_LIMIT)
      .then((items) => {
        if (latestKeyRef.current === key) {
          setValues(items);
        }
      })
      .catch(() => {
        if (latestKeyRef.current === key) {
          setValues([]);
        }
      })
      .finally(() => {
        if (latestKeyRef.current === key) {
          setIsLoadingValues(false);
        }
      });
  };

  if (keySuggestions.length === 0) {
    return null;
  }

  const selectClass =
    'h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400';

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <select
        aria-label="Metadata facet key"
        value={selectedKey}
        onChange={(event) => handleKeyChange(event.target.value)}
        className={selectClass}
      >
        <option value="">Pick metadata key…</option>
        {keySuggestions.map((item) => (
          <option key={item.key} value={item.key}>
            {item.key} ({item.count})
          </option>
        ))}
      </select>
      <select
        aria-label="Metadata facet value"
        value=""
        disabled={!selectedKey || isLoadingValues}
        onChange={(event) => {
          if (event.target.value) {
            onSelectFacet(selectedKey, event.target.value);
          }
        }}
        className={selectClass}
      >
        <option value="">
          {isLoadingValues
            ? 'Loading values…'
            : selectedKey
              ? values.length > 0
                ? 'Pick value…'
                : 'No values'
              : 'Pick a key first'}
        </option>
        {values.map((item) => (
          <option key={item.value} value={item.value}>
            {item.value} ({item.count})
          </option>
        ))}
      </select>
    </div>
  );
}
