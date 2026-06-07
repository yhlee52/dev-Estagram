import { useEffect, useState } from 'react';
import type { Account, User } from '../types/feed';
import {
  getEffectiveAccounts,
  getEffectiveUsers,
  LOCAL_DATA_EVENT,
} from '../utils/localData';

export function useEffectiveUsers(): User[] {
  const [users, setUsers] = useState<User[]>(getEffectiveUsers);

  useEffect(() => {
    const syncUsers = () => {
      setUsers(getEffectiveUsers());
    };

    window.addEventListener('storage', syncUsers);
    window.addEventListener(LOCAL_DATA_EVENT, syncUsers);

    return () => {
      window.removeEventListener('storage', syncUsers);
      window.removeEventListener(LOCAL_DATA_EVENT, syncUsers);
    };
  }, []);

  return users;
}

export function useEffectiveAccounts(): Account[] {
  const [accounts, setAccounts] = useState<Account[]>(getEffectiveAccounts);

  useEffect(() => {
    const syncAccounts = () => {
      setAccounts(getEffectiveAccounts());
    };

    window.addEventListener('storage', syncAccounts);
    window.addEventListener(LOCAL_DATA_EVENT, syncAccounts);

    return () => {
      window.removeEventListener('storage', syncAccounts);
      window.removeEventListener(LOCAL_DATA_EVENT, syncAccounts);
    };
  }, []);

  return accounts;
}
