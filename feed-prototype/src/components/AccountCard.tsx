import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Account } from '../types/feed';

type AccountCardProps = {
  account: Account;
  postCount: number;
  isFollowing: boolean;
  onToggleFollow: (accountId: string) => void;
};

function Avatar({ src, name }: { src?: string; name: string }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || 'A';

  if (!src || hasImageError) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-semibold text-neutral-600">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className="size-12 shrink-0 rounded-full bg-neutral-200 object-cover"
      loading="lazy"
      onError={() => setHasImageError(true)}
    />
  );
}

export default function AccountCard({
  account,
  postCount,
  isFollowing,
  onToggleFollow,
}: AccountCardProps) {
  const navigate = useNavigate();

  const goToAccount = () => {
    navigate(`/accounts/${account.id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToAccount();
    }
  };

  const handleFollowClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFollow(account.id);
  };

  return (
    <article
      tabIndex={0}
      role="link"
      aria-label={`Open ${account.displayName}`}
      className="cursor-pointer rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      onClick={goToAccount}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        <Avatar src={account.avatarUrl} name={account.displayName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-neutral-950">
                {account.displayName}
              </h2>
              <p className="truncate text-xs text-neutral-500">@{account.handle}</p>
            </div>

            <button
              type="button"
              className={[
                'shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold',
                isFollowing
                  ? 'border border-neutral-200 bg-white text-neutral-700'
                  : 'bg-neutral-950 text-white',
              ].join(' ')}
              onClick={handleFollowClick}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>

          {account.bio ? (
            <p className="mt-2 text-sm leading-6 text-neutral-600">{account.bio}</p>
          ) : null}

          <p className="mt-3 text-xs font-medium text-neutral-400">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </p>
        </div>
      </div>
    </article>
  );
}
