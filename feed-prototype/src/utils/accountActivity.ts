/**
 * Client-side activity signals for the Accounts tab (v0.2.2).
 *
 * Both data modes already load the full post set on the Accounts page
 * (`getAllPosts` in API mode, `posts.json` in mock mode), so per-account
 * activity is derived here instead of adding a backend endpoint. Inputs are
 * normalized to `{ accountId, createdAt }` by the caller.
 */

export const RECENT_ACTIVITY_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PostActivityEntry = {
  accountId: string;
  createdAt: string;
};

export type AccountActivity = {
  postCount: number;
  recentPostCount: number;
  /** ISO timestamp of the account's most recent post, or null if none. */
  lastActiveAt: string | null;
};

export type AccountSort = "recent" | "posts" | "name";

const EMPTY_ACTIVITY: AccountActivity = {
  postCount: 0,
  recentPostCount: 0,
  lastActiveAt: null,
};

/**
 * Aggregate posts into a per-account activity map. Entries with an unparseable
 * `createdAt` still count toward `postCount` but are ignored for the recent
 * window and last-active timestamp.
 */
export function buildAccountActivity(
  entries: PostActivityEntry[],
  now: number = Date.now(),
  windowDays: number = RECENT_ACTIVITY_DAYS,
): Map<string, AccountActivity> {
  const recentThreshold = now - windowDays * MS_PER_DAY;
  const activityById = new Map<string, AccountActivity>();

  for (const entry of entries) {
    const current = activityById.get(entry.accountId) ?? { ...EMPTY_ACTIVITY };
    current.postCount += 1;

    const createdMs = new Date(entry.createdAt).getTime();
    if (!Number.isNaN(createdMs)) {
      if (createdMs >= recentThreshold) {
        current.recentPostCount += 1;
      }
      if (
        current.lastActiveAt === null ||
        createdMs > new Date(current.lastActiveAt).getTime()
      ) {
        current.lastActiveAt = entry.createdAt;
      }
    }

    activityById.set(entry.accountId, current);
  }

  return activityById;
}

export function getAccountActivity(
  activityById: Map<string, AccountActivity>,
  accountId: string,
): AccountActivity {
  return activityById.get(accountId) ?? EMPTY_ACTIVITY;
}

type SortableAccount = {
  id: string;
  displayName: string;
};

/**
 * Return a new array sorted by the chosen key. `recent` orders by last-active
 * timestamp (most recent first; accounts with no posts sink to the bottom),
 * `posts` by total post count, `name` alphabetically. Ties fall back to name so
 * ordering is stable and predictable.
 */
export function sortAccounts<T extends SortableAccount>(
  accounts: T[],
  activityById: Map<string, AccountActivity>,
  sort: AccountSort,
): T[] {
  const byName = (a: T, b: T) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });

  const sorted = [...accounts];

  if (sort === "name") {
    sorted.sort(byName);
    return sorted;
  }

  if (sort === "posts") {
    sorted.sort((a, b) => {
      const diff =
        getAccountActivity(activityById, b.id).postCount -
        getAccountActivity(activityById, a.id).postCount;
      return diff !== 0 ? diff : byName(a, b);
    });
    return sorted;
  }

  // recent: most recent last-active first; null timestamps last.
  sorted.sort((a, b) => {
    const aTime = lastActiveMs(getAccountActivity(activityById, a.id));
    const bTime = lastActiveMs(getAccountActivity(activityById, b.id));
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return byName(a, b);
  });
  return sorted;
}

function lastActiveMs(activity: AccountActivity): number {
  if (activity.lastActiveAt === null) {
    return Number.NEGATIVE_INFINITY;
  }
  const ms = new Date(activity.lastActiveAt).getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}
