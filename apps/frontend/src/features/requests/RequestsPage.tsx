import { Link } from 'react-router-dom';
import {
  useCancelRequestMutation,
  useGetMeQuery,
  useListRequestsQuery,
  type OrderRequest,
} from '../../api/api';

const STATUS_STYLES: Record<OrderRequest['status'], string> = {
  pending: 'border-amber-700 bg-amber-950/40 text-amber-200',
  accepted: 'border-indigo-700 bg-indigo-950/40 text-indigo-200',
  completed: 'border-emerald-700 bg-emerald-950/40 text-emerald-200',
  cancelled: 'border-slate-700 bg-slate-800 text-slate-400',
};

export function RequestsPage() {
  const { data: me } = useGetMeQuery();
  const { data: requests, isLoading } = useListRequestsQuery();
  const [cancelRequest] = useCancelRequestMutation();

  // Backend returns own-only for members, all for admins. On the user-facing
  // "My requests" page we always show only the caller's, so admins keep the
  // /admin view for everyone-else's.
  const mine = me ? requests?.filter((r) => r.userId === me.id) ?? [] : [];

  if (isLoading) return <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">My requests</h2>
        <Link
          to="/requests/new"
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New request
        </Link>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-sm text-slate-400">You haven't placed any requests yet.</p>
          <Link
            to="/requests/new"
            className="mt-3 inline-block rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Place your first order
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {mine.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">${r.total}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Scheduled {new Date(r.scheduledFor).toLocaleString()}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <button
                    onClick={() => {
                      if (confirm('Cancel this request?')) cancelRequest({ id: r.id });
                    }}
                    className="rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                {r.items.map((line) => (
                  <li key={line.itemId}>
                    {line.quantity} × {line.item?.name ?? line.itemId}
                  </li>
                ))}
              </ul>
              {r.contactNotes && (
                <p className="mt-2 text-xs italic text-slate-400">"{r.contactNotes}"</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
