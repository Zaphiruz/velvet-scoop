import { NavLink } from 'react-router-dom';
import { Home, IceCream, User } from 'lucide-react';
import { cn } from '../lib/cn';

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/items', label: 'Flavors', icon: IceCream },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <ul className="mx-auto grid max-w-screen-sm grid-cols-3">
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
