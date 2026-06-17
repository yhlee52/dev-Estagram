import { NavLink } from 'react-router';
import { isApiMode } from '../config/dataSource';
import { useNotifications } from '../hooks/useNotifications';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/posts', label: 'Explore' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/me', label: 'Me' },
  ...(isApiMode() ? [{ to: '/notifications', label: 'Notifications' }] : []),
  // Import batch history is API-mode only (mock mode is demo-frozen from v0.3.0).
  ...(isApiMode() ? [{ to: '/imports', label: 'Imports' }] : []),
];

type SideNavProps = {
  /**
   * `vertical` is the desktop left rail; `horizontal` is the narrow-width
   * fallback row in the header. The link list is shared so routes stay in one
   * place.
   */
  orientation?: 'vertical' | 'horizontal';
};

function NotificationBadge() {
  const { unreadCount } = useNotifications({ limit: 1 });

  if (unreadCount === 0) {
    return null;
  }

  return (
    <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-bold leading-4 text-neutral-800">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}

export default function SideNav({ orientation = 'vertical' }: SideNavProps) {
  const isVertical = orientation === 'vertical';

  return (
    <nav
      className={
        isVertical
          ? 'flex flex-col gap-1'
          : 'flex gap-2 overflow-x-auto'
      }
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              'rounded-md border px-3 text-sm font-semibold transition-colors',
              isVertical
                ? 'py-2.5 text-left'
                : 'shrink-0 py-2 text-center',
              isActive
                ? 'border-neutral-950 bg-neutral-950 text-white'
                : 'border-transparent text-neutral-500 hover:border-neutral-200 hover:bg-white hover:text-neutral-950',
            ].join(' ')
          }
        >
          <span className="inline-flex items-center">
            {item.label}
            {item.to === '/notifications' ? <NotificationBadge /> : null}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
