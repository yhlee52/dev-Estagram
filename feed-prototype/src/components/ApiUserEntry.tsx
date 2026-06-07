import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { findUserByIdOrHandle, getUsers } from '../api/usersApi';
import type { ApiUser } from '../api/types';
import { setActiveApiUser } from '../auth/apiActiveUser';

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
      } catch {
        if (isMounted) {
          setError('Could not load backend users. Check that the API server is running.');
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
          '해당 사용자를 찾을 수 없습니다. API mode에서는 backend DB에 seed된 사용자만 사용할 수 있습니다.',
        );
        return;
      }

      setActiveApiUser(user);
      navigate('/');
    } catch {
      setError('Could not check backend users. Check that the API server is running.');
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
              Enter an id or handle from the backend seed data. API mode does not create new users.
            </p>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-neutral-700">User id or handle</span>
              <input
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500"
                value={entryValue}
                placeholder="demo-user-ari or ari"
                autoComplete="off"
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Checking...' : 'Continue'}
            </button>
          </form>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-bold uppercase text-neutral-400">
              Available backend users
            </p>

            {isLoadingUsers ? (
              <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-600">
                Loading users...
              </p>
            ) : null}

            {!isLoadingUsers && users.length === 0 ? (
              <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-600">
                No backend users are available.
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
                      @{user.handle} · {user.id}
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
