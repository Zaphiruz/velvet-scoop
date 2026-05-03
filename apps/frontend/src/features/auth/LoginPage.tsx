export function LoginPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-2xl font-semibold tracking-tight">Sign in to Velvet Scoop</h2>
      <p className="text-sm text-slate-400">Authentication is handled by Authentik.</p>
      <a
        href="/api/auth/login"
        className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
      >
        Continue with Authentik
      </a>
    </div>
  );
}
