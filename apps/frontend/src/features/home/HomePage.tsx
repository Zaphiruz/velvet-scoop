import { Link } from 'react-router-dom';
import { useGetMeQuery, useListItemsQuery } from '../../api/api';

export function HomePage() {
  const { data: me } = useGetMeQuery();
  const { data: items, isLoading } = useListItemsQuery();

  return (
    <div className="space-y-6 px-4 py-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          {me ? `Welcome, ${me.displayName}` : 'Welcome to Velvet Scoop'}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick a flavor, place a request, savor the wait.
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-lg font-medium">Today's flavors</h3>
          <Link to="/items" className="text-sm text-indigo-400 hover:underline">
            View all
          </Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : items && items.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.slice(0, 4).map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-slate-400">${item.cost}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No flavors available yet.</p>
        )}
      </section>
    </div>
  );
}
