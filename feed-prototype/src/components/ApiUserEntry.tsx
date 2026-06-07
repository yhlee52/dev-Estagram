import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiNetworkError } from '../api/client';
import type { ApiUser } from '../api/types';
import { findUserByIdOrHandle, getUsers } from '../api/usersApi';
import { setActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';

function getUserEntryErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  return 'Could not load backend users. Check the API server and try again.';
}

export default function ApiUserEntry() {
  const navigate = useNavigate();
  const [entryValue, setEntryValue] = useState('');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setError('');

      try {
        const apiUsers = await getUsers();

        if (isMounted) {
          setUsers(apiUsers);
        }
      } catch (loadError) {
        if (isMounted) {
          setUsers([]);
          setError(getUserEntryErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    };

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedValue = entryValue.trim();

    setError('');

    if (!trimmedValue) {
      setError('Enter a backend user id or handle.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await findUserByIdOrHandle(trimmedValue);

      if (!user) {
        setError(
          'User not found. API mode can only use users already seeded in the backend database.',
        );
        return;
      }

      setActiveApiUser(user);
      navigate('/');
    } catch (lookupError) {
      setError(getUserEntryErrorMessage(lookupError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <main className="mx-auto flex min-h-screen max-w-[430px] items-center bg-neutral-50 px-5 py-8 shadow-sm">
        <section className="w-full rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-neutral-400">
              API User Entry
            </p>
            <h1 className="text-2xl font-bold leading-8 text-neutral-950">
              Select a backend user
            </h1>
            <p className="text-sm leading-6 text-neutral-600">
              Choose a seeded backend user by id or handle. This is local user selection, not login.
            </p>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-neutral-700">User id or handle</span>
              <input
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                value={entryValue}
                placeholder="demo-user-ari or ari"
                autoComplete="off"
                disabled={isSubmitting}
                onChange={(event) => setEntryValue(event.target.value)}
              />
            </label>

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="h-11 w-full rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={isSubmitting || isLoadingUsers}
            >
              {isSubmitting ? 'Checking...' : isLoadingUsers ? 'Loading users...' : 'Continue'}
            </button>
          </form>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-bold uppercase text-neutral-400">
              Available backend users
            </p>

            {isLoadingUsers ? (
              <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-600">
                Loading backend users...
              </p>
            ) : null}

            {!isLoadingUsers && !error && users.length === 0 ? (
              <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-600">
                No seeded backend users are available.
              </p>
            ) : null}

            {users.length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition hover:bg-neutral-100"
                    onClick={() => setEntryValue(user.handle)}
                  >
                    <p className="truncate text-sm font-bold text-neutral-950">
                      {user.display_name}
                    </p>
                    <p className="truncate text-xs font-medium text-neutral-500">
                      @{user.handle} / {user.id}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
