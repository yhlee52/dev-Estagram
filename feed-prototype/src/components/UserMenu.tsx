import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type UserMenuMeta = {
  label: string;
  value: string;
};

type UserMenuProps = {
  /** Avatar node, reused as the trigger and inside the open panel. */
  avatar: ReactNode;
  /** Primary identity line (display name in mock mode, handle in API mode). */
  primaryLabel: string;
  /** Secondary identity line (handle / mode hint). */
  secondaryLabel: string;
  /**
   * Debug-ish detail rows (user id, mode, version) that used to clutter the
   * header. They live inside the dropdown now (v0.2.1).
   */
  meta: UserMenuMeta[];
  /** Clears the active user. Single action — Switch user and Logout were the
   *  same `onClear` before, so v0.2.1 keeps just one entry. */
  onClear: () => void;
};

/**
 * Header account control (v0.2.1). The compressed one-line header shows only an
 * avatar button; identity details, debug info, and the single Switch user
 * action move into this dropdown. Closes on outside click or Escape.
 */
export default function UserMenu({
  avatar,
  primaryLabel,
  secondaryLabel,
  meta,
  onClear,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-200 bg-white py-0.5 pl-0.5 pr-2 shadow-sm transition hover:bg-neutral-100"
      >
        {avatar}
        <span className="hidden max-w-[9rem] truncate text-sm font-bold text-neutral-950 sm:block">
          {primaryLabel}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={[
            'size-4 shrink-0 text-neutral-400 transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-neutral-950">
                {primaryLabel}
              </p>
              <p className="truncate text-xs font-medium text-neutral-500">
                {secondaryLabel}
              </p>
            </div>
          </div>

          {meta.length > 0 ? (
            <dl className="space-y-1.5 border-t border-neutral-100 px-3 py-2.5">
              {meta.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2"
                >
                  <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    {row.label}
                  </dt>
                  <dd className="truncate text-xs font-medium text-neutral-600">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="border-t border-neutral-100 p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onClear();
              }}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
            >
              Switch user
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
