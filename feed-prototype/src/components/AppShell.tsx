import { Outlet } from 'react-router';
import { useActiveUser } from '../hooks/useActiveUser';
import BottomNav from './BottomNav';
import LocalUserEntry from './LocalUserEntry';

export default function AppShell() {
  const { users, activeUser, activeUserId, setActiveUserId } = useActiveUser();

  if (!activeUser) {
    return <LocalUserEntry />;
  }

  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-neutral-50 shadow-sm">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-normal">Local Feed</h1>
              {activeUser ? (
                <p className="truncate text-xs font-medium text-neutral-500">
                  @{activeUser.handle}
                </p>
              ) : null}
            </div>

            <label className="min-w-0 shrink-0">
              <span className="sr-only">Active user</span>
              <select
                className="h-9 max-w-40 rounded-md border border-neutral-200 bg-white px-2 text-sm font-semibold text-neutral-800 shadow-sm"
                value={activeUserId}
                onChange={(event) => setActiveUserId(event.target.value)}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                  </option>
                ))}
              </select>
            </label>
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
