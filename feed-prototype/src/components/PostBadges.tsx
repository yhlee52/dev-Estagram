import type { MetadataValue, Post } from '../types/feed';

type PostBadgesProps = {
  post: Post;
};

function formatBadgeLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusValue(value: MetadataValue | undefined): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const status = String(value).trim();
    return status.length > 0 ? status : undefined;
  }

  return undefined;
}

function getStatusClasses(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === 'normal' || normalizedStatus === 'stable') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalizedStatus === 'watch') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalizedStatus === 'warning') {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }

  if (normalizedStatus === 'critical') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-neutral-200 bg-neutral-100 text-neutral-600';
}

function Badge({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <span
      className={[
        'inline-flex h-6 max-w-full items-center rounded-full border px-2.5 text-xs font-bold',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export default function PostBadges({ post }: PostBadgesProps) {
  const status = getStatusValue(post.metadata?.status);
  const representativeAssetType = post.assets?.[0]?.type;

  if (!status && !representativeAssetType) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status ? (
        <Badge className={getStatusClasses(status)}>
          {formatBadgeLabel(status)}
        </Badge>
      ) : null}
      {representativeAssetType ? (
        <Badge className="border-neutral-200 bg-neutral-100 text-neutral-600">
          {formatBadgeLabel(representativeAssetType)}
        </Badge>
      ) : null}
    </div>
  );
}
