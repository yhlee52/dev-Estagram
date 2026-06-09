type TagListProps = {
  tags?: string[];
};

export default function TagList({ tags }: TagListProps) {
  const visibleTags = tags?.filter((tag) => tag.trim()) ?? [];

  if (visibleTags.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag) => (
        <li
          key={tag}
          className="max-w-full break-words rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600"
        >
          #{tag}
        </li>
      ))}
    </ul>
  );
}
