import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAccounts } from '../api/accountsApi';
import { isApiMode } from '../config/dataSource';
import { mapApiAccountToAccount } from '../data/apiFeedRepository';
import {
  AccountDirectoryContext,
  type AccountDirectory,
} from '../hooks/useAccountDirectory';
import { useEffectiveAccounts } from '../hooks/useEffectiveData';
import type { Account } from '../types/feed';
import { normalizeMentionHandle } from '../utils/mentions';

/**
 * Load the account directory once and provide it to the app (v0.1.3).
 *
 * `@mention` rendering needs to know which handles exist so unknown handles can
 * fall back to plain text. Resolving per render would re-fetch accounts for
 * every card in API mode, so the directory is loaded once here: mock mode reads
 * the effective local accounts; API mode fetches `/api/accounts` once. A load
 * failure is non-fatal — the directory stays empty and every mention renders as
 * plain text.
 */
const isApiDataSource = isApiMode();

function buildHandleMap(accounts: Account[]): Map<string, Account> {
  const handleMap = new Map<string, Account>();

  accounts.forEach((account) => {
    const key = normalizeMentionHandle(account.handle);
    // First account wins on duplicate handles, matching the merge order used
    // elsewhere (static before local).
    if (key && !handleMap.has(key)) {
      handleMap.set(key, account);
    }
  });

  return handleMap;
}

function buildIdMap(accounts: Account[]): Map<string, Account> {
  const idMap = new Map<string, Account>();

  accounts.forEach((account) => {
    if (account.id && !idMap.has(account.id)) {
      idMap.set(account.id, account);
    }
  });

  return idMap;
}

export function AccountDirectoryProvider({ children }: { children: ReactNode }) {
  const mockAccounts = useEffectiveAccounts();
  const [apiAccounts, setApiAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!isApiDataSource) {
      return;
    }

    let isMounted = true;

    void getAccounts()
      .then((accounts) => {
        if (isMounted) {
          setApiAccounts(accounts.map(mapApiAccountToAccount));
        }
      })
      .catch(() => {
        /* mention linking is an enhancement; ignore load errors */
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const accounts = isApiDataSource ? apiAccounts : mockAccounts;
  const handleMap = useMemo(() => buildHandleMap(accounts), [accounts]);
  const idMap = useMemo(() => buildIdMap(accounts), [accounts]);

  const value = useMemo<AccountDirectory>(
    () => ({
      resolveHandle: (handle: string) =>
        handleMap.get(normalizeMentionHandle(handle)),
      resolveId: (id: string) => idMap.get(id),
    }),
    [handleMap, idMap],
  );

  return (
    <AccountDirectoryContext.Provider value={value}>
      {children}
    </AccountDirectoryContext.Provider>
  );
}
