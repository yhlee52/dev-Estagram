import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ApiTagCount } from '../api/types';

type TagSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Apply a single tag filter for the chosen suggestion. */
  onSelectTag: (tag: string) => void;
  suggestions: ApiTagCount[];
  maxSuggestions?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * Keyword search box with `#` tag autocomplete (v0.1.2).
 *
 * When the value starts with `#`, popular tags whose name starts with the text
 * after `#` are offered in a combobox listbox. Picking one applies that tag
 * filter via `onSelectTag`. Without a leading `#` it behaves like a plain
 * keyword input and shows no dropdown.
 */
export default function TagSearchInput({
  value,
  onChange,
  onSelectTag,
  suggestions,
  maxSuggestions = 8,
  placeholder,
  ariaLabel,
  className,
}: TagSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listboxId = useId();

  const trimmed = value.trim();
  const isHashtag = trimmed.startsWith('#');

  const matches = useMemo(() => {
    if (!isHashtag) {
      return [];
    }

    const prefix = trimmed.slice(1).toLowerCase();
    return suggestions
      .filter((suggestion) => suggestion.tag.toLowerCase().startsWith(prefix))
      .slice(0, maxSuggestions);
  }, [isHashtag, trimmed, suggestions, maxSuggestions]);

  const showDropdown = isOpen && matches.length > 0;
  // Keep the highlight in range as matches change while typing.
  const activeIndex =
    highlightedIndex >= 0 && highlightedIndex < matches.length
      ? highlightedIndex
      : -1;

  const selectTag = (tag: string) => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelectTag(tag);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && matches.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) =>
        current + 1 >= matches.length ? 0 : current + 1,
      );
      return;
    }

    if (event.key === 'ArrowUp' && matches.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) =>
        current <= 0 ? matches.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === 'Enter') {
      // Only intercept Enter to pick a highlighted suggestion; otherwise let the
      // form submit (Apply), where `#`-routing turns `#tag` into a tag filter.
      if (showDropdown && activeIndex >= 0) {
        event.preventDefault();
        selectTag(matches[activeIndex].tag);
      }
      return;
    }

    if (event.key === 'Escape' && showDropdown) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        // Delay close so an option's click/mousedown can register first.
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {matches.map((match, index) => (
            <li
              key={match.tag}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // Use mousedown so selection runs before the input's blur closes
              // the list; preventDefault keeps focus on the input.
              onMouseDown={(event) => {
                event.preventDefault();
                selectTag(match.tag);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={[
                'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm',
                index === activeIndex
                  ? 'bg-neutral-100 text-neutral-950'
                  : 'text-neutral-700',
              ].join(' ')}
            >
              <span className="truncate font-semibold">#{match.tag}</span>
              <span className="shrink-0 text-xs font-semibold text-neutral-400">
                {match.count}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
