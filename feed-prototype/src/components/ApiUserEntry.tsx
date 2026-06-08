import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiClientError, ApiNetworkError } from '../api/client';
import type { ApiUser, ApiUserRegistrationResponse } from '../api/types';
import {
  findUserByIdOrHandle,
  getUsers,
  registerApiUser,
} from '../api/usersApi';
import { setActiveApiUser } from '../auth/apiActiveUser';
import { getApiBaseUrl } from '../config/apiConfig';

type ApiUserEntryMode = 'entry' | 'registration';

interface MissingUserPrompt {
  inputValue: string;
  handleCandidate: string;
}

interface RegistrationFormState {
  handle: string;
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

export default function ApiUserEntry() {
  const navigate = useNavigate();
  const [entryValue, setEntryValue] = useState('');
  const [entryMode, setEntryMode] = useState<ApiUserEntryMode>('entry');
  const [missingUserPrompt, setMissingUserPrompt] =
    useState<MissingUserPrompt | null>(null);
  const [registrationForm, setRegistrationForm] =
    useState<RegistrationFormState>({
      handle: '',
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
    setMissingUserPrompt(null);

    if (!trimmedValue) {
      setError('Enter a backend user id or handle.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await findUserByIdOrHandle(trimmedValue);

      if (!user) {
        setMissingUserPrompt({
          inputValue: trimmedValue,
          handleCandidate: normalizeApiHandleCandidate(trimmedValue),
        });
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

  const handleStartRegistration = () => {
    const handleCandidate =
      missingUserPrompt?.handleCandidate ?? normalizeApiHandleCandidate(entryValue);
    setRegistrationForm({
      handle: handleCandidate,
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
    setMissingUserPrompt(null);
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
    const displayName = registrationForm.displayName.trim() || handle;
    const bio = registrationForm.bio.trim();
    const handleValidationError = getApiHandleValidationError(handle);

    setRegistrationError('');
    setRegistrationResult(null);

    if (handleValidationError) {
      setRegistrationError(handleValidationError);
      return;
    }

    setIsRegistering(true);

    try {
      const result = await registerApiUser({
        handle,
        display_name: displayName,
        bio: bio || null,
      });

      setRegistrationForm({
        handle: result.user.handle,
        displayName: result.user.display_name,
        bio: result.user.bio ?? '',
      });
      setRegistrationResult(result);
      setActiveApiUser(result.user);
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
                Create a backend user and matching account for API mode. This is local API user registration, not login.
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
                onChange={(event) => {
                  setEntryValue(event.target.value);
                  setMissingUserPrompt(null);
                  setError('');
                }}
              />
            </label>

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            {missingUserPrompt ? (
              <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-900">
                    User not found.
                  </p>
                  <p className="text-sm font-semibold leading-6 text-neutral-700">
                    Register "{missingUserPrompt.handleCandidate}" as a new API user?
                  </p>
                  <p className="text-xs font-medium leading-5 text-neutral-500">
                    Entered value: {missingUserPrompt.inputValue}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-md bg-neutral-950 px-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                    onClick={handleStartRegistration}
                  >
                    Register user
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
                    onClick={handleBackToEntry}
                  >
                    Try again
                  </button>
                </div>
              </div>
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
                    onClick={() => {
                      setEntryValue(user.handle);
                      setMissingUserPrompt(null);
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
