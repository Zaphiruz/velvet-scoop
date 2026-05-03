import { NavLink } from 'react-router-dom';
import { Home, IceCream, Shield, User } from 'lucide-react';
import { cn } from '../lib/cn';
import { useGetMeQuery } from '../api/api';

const baseTabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/items', label: 'Flavors', icon: IceCream },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

const adminTab = { to: '/admin', label: 'Admin', icon: Shield } as const;

export function BottomNav() {
  const { data: me } = useGetMeQuery();
  const tabs = me?.role === 'admin' ? [...baseTabs, adminTab] : baseTabs;

  return (
    <nav className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <ul
        className="mx-auto grid max-w-screen-sm"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-xs',
                  isActive ? 'text-indigo-400' : 'text-slate-400',
                )
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
