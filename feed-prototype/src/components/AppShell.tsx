import { Outlet } from 'react-router';
import { useActiveApiUser } from '../auth/apiActiveUser';
import { APP_VERSION } from '../config/appVersion';
import { isApiMode } from '../config/dataSource';
import { useActiveUser } from '../hooks/useActiveUser';
import ApiUserEntry from './ApiUserEntry';
import BottomNav from './BottomNav';
import LocalUserEntry from './LocalUserEntry';

function ApiModeAppShell() {
  const { activeApiUser, clearActiveApiUser } = useActiveApiUser();

  if (!activeApiUser) {
    return <ApiUserEntry />;
  }

  const avatarInitial =
    activeApiUser.handle.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-neutral-50 shadow-sm">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-normal">Local Feed</h1>
                <p className="truncate text-xs font-medium text-neutral-500">
                  API mode - {APP_VERSION}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
                  onClick={clearActiveApiUser}
                >
                  Switch user
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md bg-neutral-950 px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800"
                  onClick={clearActiveApiUser}
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 ring-1 ring-neutral-200">
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
          </div>
        </header>

        <main className="flex-1 px-3 py-4 pb-24">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
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
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-neutral-50 shadow-sm">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-normal">Local Feed</h1>
                <p className="truncate text-xs font-medium text-neutral-500">
                  Local user - {APP_VERSION}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
                  onClick={clearActiveUser}
                >
                  Switch user
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md bg-neutral-950 px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800"
                  onClick={clearActiveUser}
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              {activeUser.avatar ? (
                <img
                  src={activeUser.avatar}
                  alt={`${activeUser.display_name} avatar`}
                  className="size-10 shrink-0 rounded-full bg-neutral-200 object-cover ring-1 ring-neutral-200"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 ring-1 ring-neutral-200">
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
          </div>
        </header>

        <main className="flex-1 px-3 py-4 pb-24">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

export default function AppShell() {
  return isApiMode() ? <ApiModeAppShell /> : <MockModeAppShell />;
}
