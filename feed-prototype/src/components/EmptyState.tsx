type EmptyStateProps = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
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
    </section>
  );
}
