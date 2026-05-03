import { Link } from 'react-router-dom';
import { useListItemsQuery } from '../../api/api';

export function ItemsPage() {
  const { data: items, isLoading, error } = useListItemsQuery();

  if (isLoading) return <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="px-4 py-6 text-sm text-red-400">Failed to load items.</p>;
  if (!items || items.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-400">No flavors available.</p>;
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">All flavors</h2>
        <Link
          to="/requests/new"
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New order
        </Link>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-medium">{item.name}</h3>
              <span className="text-sm text-slate-300">${item.cost}</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{item.description}</p>
            <div className="mt-2 flex items-center justify-between">
              {item.isSeasonal ? (
                <span className="inline-block rounded-full border border-amber-700 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-200">
                  Seasonal
                </span>
              ) : (
                <span />
              )}
              <Link
                to={`/requests/new?item=${item.id}`}
                className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
              >
                Order this
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
