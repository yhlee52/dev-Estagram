import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { APP_RELEASE_LABEL } from '../config/appVersion';
import { isApiMode } from '../config/dataSource';
import { useActiveUser } from '../hooks/useActiveUser';
import ApiUserEntry from './ApiUserEntry';
import LocalUserEntry from './LocalUserEntry';
import RightRail from './RightRail';
import SideNav from './SideNav';

type DesktopShellProps = {
  subtitle: string;
  /** User identity card shown in the header (mode-specific content). */
  userCard: ReactNode;
  /** Clears the active user (Switch user / Logout share this in v0.2.0). */
  onClear: () => void;
};

/**
 * Desktop 3-column shell (v0.2.0): full-width header, a left navigation rail,
 * the center feed (`<Outlet />`), and a right contextual rail. Both modes share
 * this frame; only the header identity card and the auth guard differ.
 *
 * This prototype targets PC browsers, so the rails are desktop-only (`lg+`).
 * Below `lg` the layout collapses to the center column with a horizontal nav in
 * the header — a graceful fallback, not a designed mobile experience.
 */
function DesktopShell({ subtitle, userCard, onClear }: DesktopShellProps) {
  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col bg-neutral-50 shadow-sm">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-normal">Local Feed</h1>
              <p className="truncate text-xs font-medium text-neutral-500">
                {subtitle}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              {userCard}
              <button
                type="button"
                className="h-8 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
                onClick={onClear}
              >
                Switch user
              </button>
              <button
                type="button"
                className="h-8 shrink-0 rounded-md bg-neutral-950 px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800"
                onClick={onClear}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Narrow-width fallback nav (no left rail below lg). */}
          <div className="border-t border-neutral-200 px-3 py-2 lg:hidden">
            <SideNav orientation="horizontal" />
          </div>
        </header>

        <div className="flex-1 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)_18rem]">
          <aside className="hidden border-r border-neutral-200 px-3 py-4 lg:block">
            <div className="sticky top-20">
              <SideNav />
            </div>
          </aside>

          <main className="min-w-0 px-3 py-4 lg:px-6 lg:py-5">
            <Outlet />
          </main>

          <aside className="hidden border-l border-neutral-200 px-3 py-4 lg:block">
            <div className="sticky top-20">
              <RightRail />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ApiModeAppShell() {
  const { activeApiUser, clearActiveApiUser } = useActiveApiUser();

  if (!activeApiUser) {
    return <ApiUserEntry />;
  }

  const avatarInitial =
    activeApiUser.handle.trim().charAt(0).toUpperCase() || 'U';

  return (
    <DesktopShell
      subtitle={`API mode - ${APP_RELEASE_LABEL}`}
      onClear={clearActiveApiUser}
      userCard={
        <div className="hidden min-w-0 items-center gap-2.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm sm:flex">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 ring-1 ring-neutral-200">
            {avatarInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-950">
              @{activeApiUser.handle}
            </p>
            <p className="truncate text-xs font-medium text-neutral-500">
              {activeApiUser.id}
            </p>
          </div>
        </div>
      }
    />
  );
}

function MockModeAppShell() {
  const { activeUser, clearActiveUser } = useActiveUser();

  if (!activeUser) {
    return <LocalUserEntry />;
  }

  const avatarInitial =
    activeUser.display_name.trim().charAt(0).toUpperCase() ||
    activeUser.handle.trim().charAt(0).toUpperCase() ||
    'U';

  return (
    <DesktopShell
      subtitle={`Local user - ${APP_RELEASE_LABEL}`}
      onClear={clearActiveUser}
      userCard={
        <div className="hidden min-w-0 items-center gap-2.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm sm:flex">
          {activeUser.avatar ? (
            <img
              src={activeUser.avatar}
              alt={`${activeUser.display_name} avatar`}
              className="size-9 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
            />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 ring-1 ring-neutral-200">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-950">
              {activeUser.display_name}
            </p>
            <p className="truncate text-xs font-medium text-neutral-500">
              @{activeUser.handle}
            </p>
          </div>
        </div>
      }
    />
  );
}

export default function AppShell() {
  return isApiMode() ? <ApiModeAppShell /> : <MockModeAppShell />;
}
