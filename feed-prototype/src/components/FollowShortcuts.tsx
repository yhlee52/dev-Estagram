import { useEffect } from 'react';
import { Link } from 'react-router';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { isApiMode } from '../config/dataSource';
import { useAccountDirectory } from '../hooks/useAccountDirectory';
import { API_FOLLOWS_CHANGE_EVENT, useApiFollows } from '../hooks/useApiFollows';
import { useFollowState } from '../hooks/useFollowState';
import type { Account } from '../types/feed';

const isApiDataSource = isApiMode();
const MAX_SHORTCUTS = 8;

function avatarInitial(account: Account): string {
  return (
    account.displayName.trim().charAt(0).toUpperCase() ||
    account.handle.trim().charAt(0).toUpperCase() ||
    '?'
  );
}

/**
 * Shared presentation: resolve followed account ids to account details via the
 * already-loaded directory (no extra fetch) and render quick links. Ids that no
 * longer resolve are skipped silently.
 */
function FollowShortcutList({ accountIds }: { accountIds: string[] }) {
  const { resolveId } = useAccountDirectory();

  const accounts = accountIds
    .map((id) => resolveId(id))
    .filter((account): account is Account => account !== undefined)
    .slice(0, MAX_SHORTCUTS);

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-neutral-400">
        Following
      </h2>
      {accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3 text-xs font-semibold leading-5 text-neutral-500">
          Follow accounts to pin quick links here.
        </p>
      ) : (
        <ul className="space-y-1">
          {accounts.map((account) => (
            <li key={account.id}>
              <Link
                to={`/accounts/${account.id}`}
                className="flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition hover:border-neutral-200 hover:bg-white"
              >
                {account.avatarUrl ? (
                  <img
                    src={account.avatarUrl}
                    alt=""
                    className="size-7 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
                  />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
                    {avatarInitial(account)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-neutral-950">
                    {account.displayName}
                  </span>
                  <span className="block truncate text-xs font-medium text-neutral-500">
                    @{account.handle}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MockFollowShortcuts() {
  const { followingIds } = useFollowState();
  return <FollowShortcutList accountIds={followingIds} />;
}

function ApiFollowShortcuts() {
  const { activeApiUserId } = useActiveApiUser();
  const { followingIds, refreshFollows } = useApiFollows(activeApiUserId);

  // Keep the rail in sync when follows change elsewhere (e.g. the Accounts page).
  useEffect(() => {
    const handleChange = () => {
      void refreshFollows();
    };

    window.addEventListener(API_FOLLOWS_CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener(API_FOLLOWS_CHANGE_EVENT, handleChange);
    };
  }, [refreshFollows]);

  return <FollowShortcutList accountIds={followingIds} />;
}

export default function FollowShortcuts() {
  return isApiDataSource ? <ApiFollowShortcuts /> : <MockFollowShortcuts />;
}
