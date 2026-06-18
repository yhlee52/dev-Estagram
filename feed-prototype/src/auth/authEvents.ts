// Shared auth event names (v0.6.3). Kept in its own import-free module so the
// API client and the active-user hook can both reference them without creating
// a circular import (client -> apiActiveUser -> authApi -> client).

/**
 * Dispatched on `window` when an authenticated API call returns 401 (session
 * expired or revoked). `useActiveApiUser` listens and clears the active user so
 * the AppShell login gate takes over. `/api/auth/*` 401s are excluded by the
 * client (those are normal pre-login responses).
 */
export const UNAUTHORIZED_EVENT = 'feed-prototype-unauthorized';
