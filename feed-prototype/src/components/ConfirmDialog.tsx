import { useEffect, useRef } from 'react';

type ConfirmDialogProps = {
  /** Heading shown at the top of the dialog. */
  title: string;
  /** Optional supporting text below the title. */
  description?: string;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Style the confirm action as destructive (red). Defaults to false. */
  danger?: boolean;
  /** Disable the buttons and show a busy confirm label while the action runs. */
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * App-styled confirmation modal (v0.3.4) replacing browser `window.confirm`,
 * which clashed with the app tone and gave no control over styling or focus.
 *
 * Controlled by the parent: render it only while a confirmation is pending. It
 * mirrors `AssetLightbox`'s overlay conventions (fixed overlay, Escape to
 * dismiss, backdrop click, focus on mount, `role="dialog"`).
 */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirming, onCancel]);

  return (
    <div
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2 px-5 pb-4 pt-5">
          <h2
            id="confirm-dialog-title"
            className="text-base font-bold text-neutral-950"
          >
            {title}
          </h2>
          {description ? (
            <p
              id="confirm-dialog-description"
              className="text-sm leading-6 text-neutral-600"
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
            disabled={isConfirming}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={[
              'rounded-md px-4 py-2 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed',
              danger
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                : 'bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-400',
            ].join(' ')}
            disabled={isConfirming}
            onClick={onConfirm}
          >
            {isConfirming ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
