type TagListProps = {
  tags: string[];
};

export default function TagList({ tags }: TagListProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600"
        >
          #{tag}
        </li>
      ))}
    </ul>
  );
}
