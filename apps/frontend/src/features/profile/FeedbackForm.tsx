import { useState } from 'react';
import {
  useListMyFeedbackQuery,
  useSubmitFeedbackMutation,
  type FeedbackSubmission,
} from '../../api/api';

const STATUS_STYLES: Record<FeedbackSubmission['status'], string> = {
  open: 'border-amber-700 bg-amber-950/40 text-amber-200',
  done: 'border-emerald-700 bg-emerald-950/40 text-emerald-200',
  closed: 'border-slate-700 bg-slate-800 text-slate-400',
};

export function FeedbackForm() {
  const [submitFeedback, { isLoading }] = useSubmitFeedbackMutation();
  const { data: history } = useListMyFeedbackQuery();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastIssueUrl, setLastIssueUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) return;
    try {
      const res = await submitFeedback({
        body: body.trim(),
        pageUrl: window.location.href,
      }).unwrap();
      setLastIssueUrl(res.issueUrl);
      setBody('');
    } catch (err) {
      const e = err as { data?: { error?: { message?: string } }; status?: number };
      if (e.status === 429) {
        setError('Daily feedback limit reached — try again tomorrow.');
      } else if (e.status === 404) {
        setError('Feedback isn’t configured on this server.');
      } else {
        setError(e.data?.error?.message ?? 'Failed to submit feedback');
      }
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-base font-medium">Send feedback</h3>
      <p className="text-xs text-slate-400">
        Bug reports and suggestions go to the team as a GitHub issue.
      </p>
      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What did you notice?"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          required
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {lastIssueUrl && (
          <p className="text-xs text-emerald-300">
            Submitted —{' '}
            <a
              href={lastIssueUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              view issue
            </a>
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || body.trim() === ''}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {isLoading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>

      {history && history.length > 0 && (
        <div className="space-y-1 pt-2">
          <h4 className="text-xs uppercase tracking-wide text-slate-500">Your submissions</h4>
          <ul className="space-y-1">
            {history.map((s) => (
              <li
                key={s.id}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <a
                  href={s.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-slate-300 underline-offset-2 hover:underline"
                >
                  #{s.issueNumber} {s.title}
                </a>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 capitalize ${STATUS_STYLES[s.status]}`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
