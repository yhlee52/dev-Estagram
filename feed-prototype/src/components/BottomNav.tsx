import { NavLink } from 'react-router';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/posts', label: 'Posts' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/me', label: 'Me' },
];

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 border-t border-neutral-200 bg-neutral-50/95 px-3 py-2 backdrop-blur">
      <div className="grid grid-cols-4 gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'rounded-md border px-3 py-2.5 text-center text-sm font-semibold transition-colors',
                isActive
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-transparent text-neutral-500 hover:border-neutral-200 hover:bg-white hover:text-neutral-950',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
