import { NavLink } from 'react-router';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/posts', label: 'Explore' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/me', label: 'Me' },
];

type SideNavProps = {
  /**
   * `vertical` is the desktop left rail; `horizontal` is the narrow-width
   * fallback row in the header. The link list is shared so routes stay in one
   * place.
   */
  orientation?: 'vertical' | 'horizontal';
};

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
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
