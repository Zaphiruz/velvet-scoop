import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useCompleteRequestMutation,
  useListRequestsQuery,
  type OrderRequest,
} from '../../api/api';

const STATUS_STYLES: Record<OrderRequest['status'], string> = {
  pending: 'border-amber-700 bg-amber-950/40 text-amber-200',
  accepted: 'border-indigo-700 bg-indigo-950/40 text-indigo-200',
  completed: 'border-emerald-700 bg-emerald-950/40 text-emerald-200',
  cancelled: 'border-slate-700 bg-slate-800 text-slate-400',
};

export function AdminRequestsTab() {
  const { data: requests, isLoading } = useListRequestsQuery();
  const [acceptRequest] = useAcceptRequestMutation();
  const [completeRequest] = useCompleteRequestMutation();
  const [cancelRequest] = useCancelRequestMutation();

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!requests || requests.length === 0) {
    return <p className="text-sm text-slate-400">No requests yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{r.contactName}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status]}`}
                >
                  {r.status}
                </span>
                <span className="text-sm text-slate-400">${r.total}</span>
              </div>
              <p className="text-xs text-slate-500">
                {r.contactEmail} • scheduled{' '}
                {new Date(r.scheduledFor).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {r.status === 'pending' && (
                <button
                  onClick={() => acceptRequest(r.id)}
                  className="rounded border border-indigo-700 bg-indigo-950/40 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-900/40"
                >
                  Accept
                </button>
              )}
              {r.status === 'accepted' && (
                <button
                  onClick={() => completeRequest(r.id)}
                  className="rounded border border-emerald-700 bg-emerald-950/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
                >
                  Complete
                </button>
              )}
              {(r.status === 'pending' || r.status === 'accepted') && (
                <button
                  onClick={() => {
                    const reason = prompt('Reason (optional):') ?? undefined;
                    cancelRequest({ id: r.id, ...(reason ? { reason } : {}) });
                  }}
                  className="rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
                >
                  Cancel
                </button>
              )}
            </div>
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
  );
}
