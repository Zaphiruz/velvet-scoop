import {
  useBanUserMutation,
  useListAdminUsersQuery,
  useMuteUserMutation,
  usePatchAdminUserMutation,
  useUnbanUserMutation,
  useUnmuteUserMutation,
} from '../../api/api';

export function AdminUsersTab() {
  const { data: users, isLoading } = useListAdminUsersQuery();
  const [banUser] = useBanUserMutation();
  const [unbanUser] = useUnbanUserMutation();
  const [muteUser] = useMuteUserMutation();
  const [unmuteUser] = useUnmuteUserMutation();
  const [patchUser] = usePatchAdminUserMutation();

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!users || users.length === 0) {
    return <p className="text-sm text-slate-400">No users yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Owner admins receive email + push notifications when an order arrives or is cancelled.
        Toggle the <span className="text-emerald-300">Owner</span> button on each admin to
        opt them in.
      </p>
      <ul className="space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{u.displayName}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">
                    {u.role}
                  </span>
                  {u.isOwner && (
                    <span className="rounded-full border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-200">
                      owner
                    </span>
                  )}
                  {u.banned && (
                    <span className="rounded-full border border-red-900 bg-red-950/40 px-2 py-0.5 text-xs text-red-300">
                      banned
                    </span>
                  )}
                  {u.muted && (
                    <span className="rounded-full border border-amber-900 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-300">
                      muted
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-400">{u.email}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {u.role === 'admin' && (
                  <button
                    onClick={() => patchUser({ id: u.id, isOwner: !u.isOwner })}
                    className="rounded border border-emerald-800 bg-emerald-950/30 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
                  >
                    {u.isOwner ? 'Remove owner' : 'Make owner'}
                  </button>
                )}
                <button
                  onClick={() =>
                    u.muted ? unmuteUser(u.id) : muteUser({ id: u.id })
                  }
                  className="rounded border border-amber-900 bg-amber-950/30 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/40"
                >
                  {u.muted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => {
                    if (u.banned) unbanUser(u.id);
                    else if (confirm(`Ban ${u.displayName}? They'll lose access.`)) {
                      banUser({ id: u.id });
                    }
                  }}
                  className="rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
                >
                  {u.banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
