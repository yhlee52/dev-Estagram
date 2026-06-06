import { NavLink } from 'react-router';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/accounts', label: 'Accounts' },
];

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white/95 px-4 py-2 backdrop-blur">
      <div className="grid grid-cols-2 gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-center text-sm font-medium transition-colors',
                isActive
                  ? 'bg-neutral-950 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950',
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
