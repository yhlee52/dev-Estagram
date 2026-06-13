import { createContext, useContext } from 'react';
import type { Account } from '../types/feed';

/**
 * App-wide directory that resolves an `@handle` to an account (v0.1.3).
 *
 * The context value and hook live here (a non-component module) so the
 * `AccountDirectoryProvider` component file can stay component-only and keep
 * React Fast Refresh working. See `AccountDirectoryProvider` for how the
 * directory is loaded.
 */
export type AccountDirectory = {
  resolveHandle: (handle: string) => Account | undefined;
  resolveId: (id: string) => Account | undefined;
};

export const AccountDirectoryContext = createContext<AccountDirectory>({
  resolveHandle: () => undefined,
  resolveId: () => undefined,
});

export function useAccountDirectory(): AccountDirectory {
  return useContext(AccountDirectoryContext);
}
