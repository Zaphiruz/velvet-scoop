import * as Tabs from '@radix-ui/react-tabs';
import { useGetMeQuery } from '../../api/api';
import { AdminItemsTab } from './AdminItemsTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminRequestsTab } from './AdminRequestsTab';

export function AdminPage() {
  const { data: me, isLoading } = useGetMeQuery();

  if (isLoading) return <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>;
  if (!me || me.role !== 'admin') {
    return (
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold">Admin</h2>
        <p className="mt-2 text-sm text-slate-400">You need an admin account to view this page.</p>
      </div>
    );
  }

  const triggerCls =
    'flex-1 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:border-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-slate-100';

  return (
    <div className="space-y-4 px-4 py-6">
      <h2 className="text-2xl font-semibold tracking-tight">Admin</h2>

      <Tabs.Root defaultValue="items">
        <Tabs.List
          aria-label="Admin sections"
          className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1"
        >
          <Tabs.Trigger value="items" className={triggerCls}>
            Items
          </Tabs.Trigger>
          <Tabs.Trigger value="requests" className={triggerCls}>
            Requests
          </Tabs.Trigger>
          <Tabs.Trigger value="users" className={triggerCls}>
            Users
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="items" className="mt-4 outline-none">
          <AdminItemsTab />
        </Tabs.Content>
        <Tabs.Content value="requests" className="mt-4 outline-none">
          <AdminRequestsTab />
        </Tabs.Content>
        <Tabs.Content value="users" className="mt-4 outline-none">
          <AdminUsersTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
