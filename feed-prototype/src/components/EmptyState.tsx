import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  /**
   * Optional call-to-action shown below the description (e.g. a "Reset filters"
   * button or a link). Omit it and the empty state renders exactly as before.
   */
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-md border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
      <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-400">
        --
      </div>
      <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-neutral-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}
