import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useActiveUser } from '../hooks/useActiveUser';
import {
  findUserByIdOrHandle,
  normalizeLocalHandle,
  registerLocalUser,
} from '../utils/localData';

function getDisplayNameFromHandle(handle: string): string {
  const words = handle
    .split(/[._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'Local User';
  }

  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export default function LocalUserEntry() {
  const navigate = useNavigate();
  const { setActiveUserId } = useActiveUser();
  const [entryValue, setEntryValue] = useState('');
  const [pendingHandle, setPendingHandle] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const normalizedHandle = useMemo(
    () => normalizeLocalHandle(entryValue),
    [entryValue],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedValue = entryValue.trim();
    const normalizedValue = normalizeLocalHandle(trimmedValue);

    setError('');
    setMessage('');
    setPendingHandle('');

    if (!trimmedValue || !normalizedValue) {
      setError('Enter a local user id or handle.');
      return;
    }

    const existingUser = findUserByIdOrHandle(trimmedValue);

    if (existingUser) {
      setActiveUserId(existingUser.id);
      navigate('/');
      return;
    }

    setPendingHandle(normalizedValue);
    setMessage('등록되지 않은 local user입니다.');
  };

  const handleRegister = () => {
    if (!pendingHandle) {
      return;
    }

    setError('');

    try {
      const { user } = registerLocalUser({
        handle: pendingHandle,
        displayName: getDisplayNameFromHandle(pendingHandle),
        accountDisplayName: `${getDisplayNameFromHandle(pendingHandle)} Account`,
      });

      setActiveUserId(user.id);
      navigate('/me');
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : 'Could not create this local user.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <main className="mx-auto flex min-h-screen max-w-[430px] items-center bg-neutral-50 px-5 py-8 shadow-sm">
        <section className="w-full rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-neutral-400">
              Local User Entry
            </p>
            <h1 className="text-2xl font-bold leading-8 text-neutral-950">
              Enter your local id
            </h1>
            <p className="text-sm leading-6 text-neutral-600">
              Use an existing user id or handle, or create a local user for this browser.
            </p>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-neutral-700">User id or handle</span>
              <input
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500"
                value={entryValue}
                placeholder="mina or user_mina"
                autoComplete="off"
                onChange={(event) => setEntryValue(event.target.value)}
              />
            </label>

            {normalizedHandle ? (
              <p className="text-xs font-medium text-neutral-500">
                Normalized handle: @{normalizedHandle}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              className="h-11 w-full rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              Continue
            </button>
          </form>

          {pendingHandle ? (
            <div className="mt-3">
              <button
                type="button"
                className="h-11 w-full rounded-md border border-neutral-200 bg-neutral-50 px-4 text-sm font-bold text-neutral-800 transition hover:bg-neutral-100"
                onClick={handleRegister}
              >
                Register @{pendingHandle} locally
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
