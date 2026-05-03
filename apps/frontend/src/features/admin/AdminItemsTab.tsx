import { useState } from 'react';
import {
  useCreateItemMutation,
  useDeleteItemMutation,
  useListItemsQuery,
  useUpdateItemMutation,
  type Item,
  type ItemUpsertBody,
} from '../../api/api';

export function AdminItemsTab() {
  const { data: items, isLoading } = useListItemsQuery({ includeInactive: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Flavors</h3>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New flavor
        </button>
      </div>

      {creating && (
        <ItemForm
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      )}

      <ul className="space-y-2">
        {items?.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
          >
            {editingId === item.id ? (
              <ItemForm
                item={item}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <ItemRow
                item={item}
                onEdit={() => setEditingId(item.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemRow({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const [deleteItem, { isLoading: deleting }] = useDeleteItemMutation();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{item.name}</span>
          <span className="text-sm text-slate-400">${item.cost}</span>
          {!item.active && (
            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              inactive
            </span>
          )}
          {item.isSeasonal && (
            <span className="rounded-full border border-amber-700 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-200">
              seasonal
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-400">{item.description}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={onEdit}
          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (confirm(`Soft-delete "${item.name}"?`)) deleteItem(item.id);
          }}
          disabled={deleting}
          className="rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ItemForm({
  item,
  onCancel,
  onSaved,
}: {
  item?: Item;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [createItem, { isLoading: creating }] = useCreateItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateItemMutation();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [cost, setCost] = useState(item?.cost ?? '');
  const [isSeasonal, setIsSeasonal] = useState(item?.isSeasonal ?? false);
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const isBusy = creating || updating;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: ItemUpsertBody = {
      name: name.trim(),
      description: description.trim(),
      cost,
      isSeasonal,
      active,
    };
    try {
      if (item) {
        await updateItem({ id: item.id, patch: body }).unwrap();
      } else {
        await createItem(body).unwrap();
      }
      onSaved();
    } catch (err) {
      const e = err as { data?: { error?: { message?: string } } };
      setError(e.data?.error?.message ?? 'Failed');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs text-slate-400">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            required
          />
        </label>
        <label className="col-span-2 text-xs text-slate-400">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            required
          />
        </label>
        <label className="text-xs text-slate-400">
          Cost ($)
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
            placeholder="4.50"
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            required
          />
        </label>
        <div className="flex items-end gap-3 text-xs text-slate-400">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={isSeasonal}
              onChange={(e) => setIsSeasonal(e.target.checked)}
            />
            Seasonal
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isBusy}
          className="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {isBusy ? 'Saving…' : item ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  );
}
