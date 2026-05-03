import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCreateRequestMutation,
  useGetMeQuery,
  useListItemsQuery,
} from '../../api/api';

function defaultScheduledFor(): string {
  // Tomorrow at 18:00 local, formatted for <input type="datetime-local">
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: me } = useGetMeQuery();
  const { data: items, isLoading } = useListItemsQuery();
  const [createRequest, { isLoading: submitting }] = useCreateRequestMutation();

  const preselectedItem = searchParams.get('item');

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    preselectedItem ? { [preselectedItem]: 1 } : {},
  );
  const [scheduledFor, setScheduledFor] = useState(defaultScheduledFor);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Seed contact info from the signed-in user once it loads.
  useMemo(() => {
    if (me) {
      setContactName((cur) => cur || me.displayName);
      setContactEmail((cur) => cur || me.email);
    }
  }, [me]);

  const total = useMemo(() => {
    if (!items) return 0;
    let t = 0;
    for (const item of items) {
      const q = quantities[item.id] ?? 0;
      if (q > 0) t += Number(item.cost) * q;
    }
    return t;
  }, [items, quantities]);

  function bump(itemId: string, delta: number) {
    setQuantities((prev) => {
      const next = (prev[itemId] ?? 0) + delta;
      const out = { ...prev };
      if (next <= 0) delete out[itemId];
      else out[itemId] = next;
      return out;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (lines.length === 0) {
      setError('Pick at least one flavor.');
      return;
    }
    try {
      const created = await createRequest({
        scheduledFor: new Date(scheduledFor).toISOString(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactNotes: contactNotes.trim() || null,
        items: lines,
      }).unwrap();
      navigate(`/requests`, { state: { justCreated: created.id } });
    } catch (err) {
      const e = err as { data?: { error?: { message?: string } } };
      setError(e.data?.error?.message ?? 'Failed to submit');
    }
  }

  if (isLoading) return <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-5 px-4 py-6">
      <h2 className="text-2xl font-semibold tracking-tight">New request</h2>

      <section>
        <h3 className="text-sm font-medium text-slate-300">Flavors</h3>
        <ul className="mt-2 space-y-2">
          {items?.map((item) => {
            const q = quantities[item.id] ?? 0;
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-slate-400">${item.cost}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-slate-500">{item.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bump(item.id, -1)}
                    disabled={q === 0}
                    className="h-7 w-7 rounded border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                  <button
                    type="button"
                    onClick={() => bump(item.id, 1)}
                    className="h-7 w-7 rounded border border-slate-700 text-sm hover:bg-slate-800"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Pickup</h3>
        <label className="block text-xs text-slate-400">
          When
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            required
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Name on order
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Contact email
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Notes (optional)
          <textarea
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            rows={2}
            placeholder="Allergies, special requests…"
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="sticky bottom-14 -mx-4 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-lg font-semibold tabular-nums">${total.toFixed(2)}</p>
          </div>
          <button
            type="submit"
            disabled={submitting || total === 0}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </form>
  );
}
