import { useGetMeQuery, useLogoutMutation } from '../../api/api';
import { FeedbackForm } from './FeedbackForm';
import { NotificationsSection } from './NotificationsSection';

export function ProfilePage() {
  const { data: me, isLoading } = useGetMeQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  async function onLogout() {
    const result = await logout().unwrap().catch(() => null);
    if (result?.endSessionUrl) {
      window.location.assign(result.endSessionUrl);
    } else {
      window.location.assign('/');
    }
  }

  if (isLoading) return <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>;
  if (!me) return <p className="px-4 py-6 text-sm text-slate-400">Not signed in.</p>;

  return (
    <div className="space-y-6 px-4 py-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
      </section>

      <dl className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-400">Name</dt>
          <dd>{me.displayName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Email</dt>
          <dd>{me.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Role</dt>
          <dd className="capitalize">{me.role}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
      >
        {isLoggingOut ? 'Signing out…' : 'Sign out'}
      </button>

      <NotificationsSection />
      <FeedbackForm />
    </div>
  );
}
