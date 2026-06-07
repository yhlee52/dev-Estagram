import accountsData from '../data/accounts.json';
import followsData from '../data/follows.json';
import usersData from '../data/users.json';
import type { Account, FollowState, User } from '../types/feed';

export const ACTIVE_USER_STORAGE_KEY = 'local-feed-active-user-id';
export const LOCAL_USERS_STORAGE_KEY = 'local-feed-local-users';
export const LOCAL_ACCOUNTS_STORAGE_KEY = 'local-feed-local-accounts';
export const FOLLOWING_BY_USER_STORAGE_KEY = 'local-feed-following-by-user';
export const LOCAL_DATA_EVENT = 'local-feed-local-data-change';

const staticUsers = usersData as unknown as User[];
const staticAccounts = accountsData as unknown as Account[];
const staticFollows = followsData as unknown as FollowState[];

export interface RegisterLocalUserInput {
  id?: string;
  handle: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  accountId?: string;
  accountHandle?: string;
  accountDisplayName?: string;
  accountAvatarUrl?: string;
  accountBio?: string;
}

export interface RegisterLocalUserResult {
  user: User;
  account: Account;
}

function readJsonArray<T>(storageKey: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const storedValue = window.localStorage.getItem(storageKey);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? (parsedValue as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(storageKey: string, value: T[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function dispatchLocalDataChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(LOCAL_DATA_EVENT));
}

function normalizeLookupValue(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function slugify(value: string): string {
  return normalizeLookupValue(value)
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Partial<User>;
  return (
    typeof user.id === 'string' &&
    typeof user.display_name === 'string' &&
    typeof user.handle === 'string' &&
    typeof user.account_id === 'string'
  );
}

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const account = value as Partial<Account>;
  return (
    typeof account.id === 'string' &&
    typeof account.handle === 'string' &&
    typeof account.displayName === 'string'
  );
}

function mergeByIdAndHandle<T extends { id: string; handle: string }>(
  staticItems: T[],
  localItems: T[],
): T[] {
  const usedIds = new Set(staticItems.map((item) => item.id));
  const usedHandles = new Set(
    staticItems.map((item) => normalizeLookupValue(item.handle)),
  );
  const mergedItems = [...staticItems];

  localItems.forEach((item) => {
    const normalizedHandle = normalizeLookupValue(item.handle);

    if (
      !item.id ||
      !normalizedHandle ||
      usedIds.has(item.id) ||
      usedHandles.has(normalizedHandle)
    ) {
      return;
    }

    usedIds.add(item.id);
    usedHandles.add(normalizedHandle);
    mergedItems.push(item);
  });

  return mergedItems;
}

export function getLocalUsers(): User[] {
  return readJsonArray<unknown>(LOCAL_USERS_STORAGE_KEY).filter(isUser);
}

export function getLocalAccounts(): Account[] {
  return readJsonArray<unknown>(LOCAL_ACCOUNTS_STORAGE_KEY).filter(isAccount);
}

export function getEffectiveAccounts(): Account[] {
  return mergeByIdAndHandle(staticAccounts, getLocalAccounts());
}

export function getEffectiveUsers(): User[] {
  const effectiveAccountIds = new Set(getEffectiveAccounts().map((account) => account.id));
  const validLocalUsers = getLocalUsers().filter((user) =>
    user.account_id ? effectiveAccountIds.has(user.account_id) : false,
  );

  return mergeByIdAndHandle(staticUsers, validLocalUsers);
}

export function findUserByIdOrHandle(value: string): User | undefined {
  const normalizedValue = normalizeLookupValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return getEffectiveUsers().find(
    (user) =>
      normalizeLookupValue(user.id) === normalizedValue ||
      normalizeLookupValue(user.handle) === normalizedValue,
  );
}

function getInitialFollowingByUser(): Record<string, string[]> {
  return staticFollows.reduce<Record<string, string[]>>((result, followState) => {
    result[followState.user_id] = followState.following_account_ids;
    return result;
  }, {});
}

export function readFollowingByUserOverlay(): Record<string, string[]> {
  if (typeof window === 'undefined') {
    return getInitialFollowingByUser();
  }

  const storedValue = window.localStorage.getItem(FOLLOWING_BY_USER_STORAGE_KEY);

  if (!storedValue) {
    return getInitialFollowingByUser();
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return getInitialFollowingByUser();
    }

    return Object.entries(parsedValue).reduce<Record<string, string[]>>(
      (result, [userId, accountIds]) => {
        if (Array.isArray(accountIds)) {
          result[userId] = accountIds.filter(
            (accountId): accountId is string => typeof accountId === 'string',
          );
        }

        return result;
      },
      getInitialFollowingByUser(),
    );
  } catch {
    return getInitialFollowingByUser();
  }
}

export function writeFollowingByUserOverlay(followingByUser: Record<string, string[]>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    FOLLOWING_BY_USER_STORAGE_KEY,
    JSON.stringify(followingByUser),
  );
}

export function initializeFollowingForUser(userId: string) {
  const followingByUser = readFollowingByUserOverlay();

  if (followingByUser[userId]) {
    return;
  }

  writeFollowingByUserOverlay({
    ...followingByUser,
    [userId]: [],
  });
}

export function registerLocalUser(
  input: RegisterLocalUserInput,
): RegisterLocalUserResult {
  const handle = slugify(input.handle);
  const displayName = input.displayName.trim();

  if (!handle || !displayName) {
    throw new Error('Local user registration requires a handle and display name.');
  }

  const userId = input.id?.trim() || `user_${handle}`;
  const accountId = input.accountId?.trim() || `acct_${handle}`;
  const accountHandle = slugify(input.accountHandle ?? `${handle}.local`) || `${handle}.local`;

  if (findUserByIdOrHandle(userId) || findUserByIdOrHandle(handle)) {
    throw new Error('A user with this id or handle already exists.');
  }

  const existingAccount = getEffectiveAccounts().find(
    (account) =>
      account.id === accountId ||
      normalizeLookupValue(account.handle) === normalizeLookupValue(accountHandle),
  );

  if (existingAccount) {
    throw new Error('An account with this id or handle already exists.');
  }

  const account: Account = {
    id: accountId,
    handle: accountHandle,
    displayName: input.accountDisplayName?.trim() || displayName,
    avatarUrl: input.accountAvatarUrl ?? input.avatar,
    bio: input.accountBio ?? input.bio,
    kind: 'person',
    metadata: {
      local: true,
      user_id: userId,
    },
  };
  const user: User = {
    id: userId,
    display_name: displayName,
    handle,
    avatar: input.avatar,
    bio: input.bio,
    account_id: account.id,
    metadata: {
      local: true,
      account_id: account.id,
    },
  };

  writeJsonArray(LOCAL_ACCOUNTS_STORAGE_KEY, [...getLocalAccounts(), account]);
  writeJsonArray(LOCAL_USERS_STORAGE_KEY, [...getLocalUsers(), user]);
  initializeFollowingForUser(user.id);
  dispatchLocalDataChange();

  return { user, account };
}
