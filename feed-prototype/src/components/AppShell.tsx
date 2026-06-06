import { Outlet } from 'react-router';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-neutral-50 shadow-sm">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur">
          <h1 className="text-lg font-bold tracking-normal">Local Feed</h1>
        </header>

        <main className="flex-1 px-3 py-4 pb-24">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
