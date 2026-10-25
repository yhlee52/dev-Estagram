import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Account } from '../types/feed';
import { formatRelativeTime } from '../utils/format';

type AccountCardProps = {
  account: Account;
  postCount: number;
  isFollowing: boolean;
  onToggleFollow: (accountId: string) => void | Promise<void>;
  isFollowReadOnly?: boolean;
  isFollowDisabled?: boolean;
  followButtonLabel?: string;
  /**
   * Activity signals (v0.2.2). Optional so other callers keep the plain
   * post-count footer; only rendered when `recentPostCount` is provided.
   */
  recentPostCount?: number;
  recentWindowDays?: number;
  lastActiveAt?: string | null;
};

function Avatar({ src, name }: { src?: string; name: string }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || 'A';

  if (!src || hasImageError) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-bold text-neutral-600">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className="size-12 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
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
  isFollowReadOnly = false,
  isFollowDisabled = false,
  followButtonLabel,
  recentPostCount,
  recentWindowDays = 7,
  lastActiveAt,
}: AccountCardProps) {
  const navigate = useNavigate();
  const showActivity = recentPostCount !== undefined || lastActiveAt !== undefined;

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

    if (isFollowReadOnly || isFollowDisabled) {
      return;
    }

    void onToggleFollow(account.id);
  };

  const isButtonDisabled = isFollowReadOnly || isFollowDisabled;
  const buttonLabel =
    followButtonLabel ??
    (isFollowReadOnly ? '보기 전용' : isFollowing ? '팔로잉' : '팔로우');

  return (
    <article
      tabIndex={0}
      role="link"
      aria-label={`${account.displayName} 프로필 보기`}
      className="cursor-pointer rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      onClick={goToAccount}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        <Avatar src={account.avatarUrl} name={account.displayName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <h2 className="break-words text-base font-bold text-neutral-950">
                {account.displayName}
              </h2>
              <p className="truncate text-xs text-neutral-500">@{account.handle}</p>
            </div>

            <button
              type="button"
              className={[
                'shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition-colors',
                isButtonDisabled
                  ? 'cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400'
                  : isFollowing
                  ? 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                  : 'bg-neutral-950 text-white hover:bg-neutral-800',
              ].join(' ')}
              disabled={isButtonDisabled}
              onClick={handleFollowClick}
            >
              {buttonLabel}
            </button>
          </div>

          {account.bio ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-600">{account.bio}</p>
          ) : null}

          {showActivity ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-neutral-500">
              <span className="uppercase text-neutral-400">
                게시글 {postCount.toLocaleString('ko-KR')}개
              </span>
              {recentPostCount !== undefined ? <span
                className={recentPostCount > 0 ? 'text-neutral-700' : 'text-neutral-400'}
              >
                최근 {recentWindowDays}일 {recentPostCount}개
              </span> : null}
              <span className="text-neutral-400">
                {lastActiveAt
                  ? `최근 활동 ${formatRelativeTime(lastActiveAt)}`
                  : '아직 활동 없음'}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold uppercase text-neutral-400">
              게시글 {postCount.toLocaleString('ko-KR')}개
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
