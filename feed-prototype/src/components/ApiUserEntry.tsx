import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { login } from '../api/authApi';
import { ApiClientError, ApiNetworkError } from '../api/client';
import type { ApiUser, ApiUserRegistrationResponse } from '../api/types';
import { getUsers, registerApiUser } from '../api/usersApi';
import { setActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';

type ApiUserEntryMode = 'entry' | 'registration';

interface RegistrationFormState {
  handle: string;
  password: string;
  displayName: string;
  bio: string;
}

const API_HANDLE_PATTERN = /^[a-z0-9_-]{3,32}$/;
const API_HANDLE_REQUIREMENTS =
  'Use 3-32 lowercase letters, numbers, underscores, or hyphens.';

function getUserEntryErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  return 'Could not load backend users. Check the API server and try again.';
}

function normalizeApiHandleCandidate(input: string): string {
  return input.trim().toLowerCase();
}

function getApiHandleValidationError(handle: string): string {
  if (!handle) {
    return 'Handle is required.';
  }

  if (!API_HANDLE_PATTERN.test(handle)) {
    return 'Handle must be 3-32 characters and use only lowercase letters, numbers, underscores, or hyphens.';
  }

  return '';
}

function getDisplayNameFromHandle(handle: string): string {
  const words = handle
    .split(/[_-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return handle;
  }

  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function getRegistrationErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    return error.message;
  }

  return 'Could not register this API user. Check the API server and try again.';
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) {
    return `Cannot connect to the backend API at ${getApiBaseUrl()}. Start the FastAPI server and try again.`;
  }

  if (error instanceof ApiClientError) {
    return error.message;
  }

  return 'Could not log in. Check the API server and try again.';
}

export default function ApiUserEntry() {
  const navigate = useNavigate();
  const [entryValue, setEntryValue] = useState('');
  const [password, setPassword] = useState('');
  const [entryMode, setEntryMode] = useState<ApiUserEntryMode>('entry');
  const [registrationForm, setRegistrationForm] =
    useState<RegistrationFormState>({
      handle: '',
      password: '',
      displayName: '',
      bio: '',
    });
  const [registrationResult, setRegistrationResult] =
    useState<ApiUserRegistrationResponse | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [registrationError, setRegistrationError] = useState('');

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

    if (isSubmitting) {
      return;
    }

    const trimmedValue = entryValue.trim();

    setError('');

    if (!trimmedValue) {
      setError('Enter a backend user id or handle.');
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await login(trimmedValue, password);
      setActiveApiUser(session.user);
      navigate('/');
    } catch (lookupError) {
      setError(getLoginErrorMessage(lookupError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRegistration = () => {
    const handleCandidate = normalizeApiHandleCandidate(entryValue);
    setRegistrationForm({
      handle: handleCandidate,
      password: '',
      displayName: getDisplayNameFromHandle(handleCandidate),
      bio: '',
    });
    setRegistrationResult(null);
    setRegistrationError('');
    setEntryMode('registration');
    setError('');
  };

  const handleBackToEntry = () => {
    setEntryMode('entry');
    setRegistrationResult(null);
    setRegistrationError('');
    setIsRegistering(false);
    setError('');
  };

  const handleRegistrationChange = (
    field: keyof RegistrationFormState,
    value: string,
  ) => {
    setRegistrationForm((currentForm) => ({
      ...currentForm,
      [field]: field === 'handle' ? normalizeApiHandleCandidate(value) : value,
    }));
    setRegistrationError('');
  };

  const handleRegistrationSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isRegistering) {
      return;
    }

    const handle = normalizeApiHandleCandidate(registrationForm.handle);
    const password = registrationForm.password;
    const displayName = registrationForm.displayName.trim() || handle;
    const bio = registrationForm.bio.trim();
    const handleValidationError = getApiHandleValidationError(handle);

    setRegistrationError('');
    setRegistrationResult(null);

    if (handleValidationError) {
      setRegistrationError(handleValidationError);
      return;
    }

    if (password.length < 4) {
      setRegistrationError('Password must be at least 4 characters.');
      return;
    }

    setIsRegistering(true);

    try {
      const result = await registerApiUser({
        handle,
        password,
        display_name: displayName,
        bio: bio || null,
      });

      setRegistrationForm({
        handle: result.user.handle,
        password: '',
        displayName: result.user.display_name,
        bio: result.user.bio ?? '',
      });
      setRegistrationResult(result);
      const session = await login(result.user.handle, password);
      setActiveApiUser(session.user);
      navigate('/');
    } catch (registrationErrorValue) {
      setRegistrationError(getRegistrationErrorMessage(registrationErrorValue));
    } finally {
      setIsRegistering(false);
    }
  };

  if (entryMode === 'registration') {
    const normalizedRegistrationHandle = normalizeApiHandleCandidate(
      registrationForm.handle,
    );
    const registrationHandleError = getApiHandleValidationError(
      normalizedRegistrationHandle,
    );
    const isRegistrationSubmitDisabled =
      isRegistering || Boolean(registrationHandleError);

    return (
      <div className="min-h-screen bg-neutral-200 text-neutral-950">
        <main className="mx-auto flex min-h-screen max-w-[430px] items-center bg-neutral-50 px-5 py-8 shadow-sm">
          <section className="w-full rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-neutral-400">
                API Local Registration
              </p>
              <h1 className="text-2xl font-bold leading-8 text-neutral-950">
                Register API user
              </h1>
              <p className="text-sm leading-6 text-neutral-600">
                Create a backend user, matching account, and password for API mode.
              </p>
            </div>

            <form className="mt-5 space-y-3" onSubmit={handleRegistrationSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-neutral-700">Handle</span>
                <input
                  className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                  value={registrationForm.handle}
                  placeholder="new_user"
                  autoComplete="off"
                  disabled={isRegistering || Boolean(registrationResult)}
                  onChange={(event) =>
                    handleRegistrationChange('handle', event.target.value)
                  }
                />
              </label>

              <p
                className={`text-xs font-medium ${
                  registrationHandleError
                    ? 'text-red-600'
                    : 'text-neutral-500'
                }`}
              >
                {registrationHandleError || API_HANDLE_REQUIREMENTS}
              </p>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-neutral-700">Password</span>
                <input
                  className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                  value={registrationForm.password}
                  type="password"
                  autoComplete="new-password"
                  disabled={isRegistering || Boolean(registrationResult)}
                  onChange={(event) =>
                    handleRegistrationChange('password', event.target.value)
                  }
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-neutral-700">
                  Display name
                </span>
                <input
                  className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                  value={registrationForm.displayName}
                  placeholder={normalizedRegistrationHandle || 'Display name'}
                  autoComplete="off"
                  disabled={isRegistering || Boolean(registrationResult)}
                  onChange={(event) =>
                    handleRegistrationChange('displayName', event.target.value)
                  }
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-neutral-700">
                  Bio optional
                </span>
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium leading-6 text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                  value={registrationForm.bio}
                  placeholder="Short profile note"
                  disabled={isRegistering || Boolean(registrationResult)}
                  onChange={(event) =>
                    handleRegistrationChange('bio', event.target.value)
                  }
                />
              </label>

              {registrationError ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {registrationError}
                </p>
              ) : null}

              {registrationResult ? (
                <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  Created @{registrationResult.user.handle} and matching account.
                </div>
              ) : null}

              <button
                type="submit"
                className="h-11 w-full rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                disabled={isRegistrationSubmitDisabled || Boolean(registrationResult)}
              >
                {isRegistering ? 'Registering...' : 'Register API user'}
              </button>
            </form>

            <button
              type="button"
              className="mt-4 h-11 w-full rounded-md border border-neutral-200 bg-neutral-50 px-4 text-sm font-bold text-neutral-800 transition hover:bg-neutral-100"
              onClick={handleBackToEntry}
            >
              Back to user entry
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <main className="mx-auto flex min-h-screen max-w-[430px] items-center bg-neutral-50 px-5 py-8 shadow-sm">
        <section className="w-full rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-neutral-400">
              API Login
            </p>
            <h1 className="text-2xl font-bold leading-8 text-neutral-950">
              Log in
            </h1>
            <p className="text-sm leading-6 text-neutral-600">
              Enter a backend user id or handle and password. Seed users use their handle as the initial password.
            </p>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-neutral-700">User id or handle</span>
              <input
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                value={entryValue}
                placeholder="demo-user-ari or ari"
                autoComplete="username"
                disabled={isSubmitting}
                onChange={(event) => {
                  setEntryValue(event.target.value);
                  setError('');
                }}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-neutral-700">Password</span>
              <input
                className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-500 disabled:bg-neutral-100"
                value={password}
                type="password"
                placeholder="ari"
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
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

          <button
            type="button"
            className="mt-3 h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 px-4 text-sm font-bold text-neutral-800 transition hover:bg-neutral-100"
            onClick={handleStartRegistration}
          >
            Register new API user
          </button>

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
                    onClick={() => {
                      setEntryValue(user.handle);
                      setError('');
                    }}
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
