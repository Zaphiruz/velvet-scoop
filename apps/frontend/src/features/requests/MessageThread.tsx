import { useEffect, useRef, useState } from 'react';
import {
  useDeleteRequestMessageMutation,
  useGetMeQuery,
  useListRequestMessagesQuery,
  useMarkRequestThreadReadMutation,
  useSendRequestMessageMutation,
  type OrderRequest,
  type RequestMessage,
} from '../../api/api';

const POLL_MS = 12_000;

export interface MessageThreadProps {
  requestId: string;
  orderNumber: number;
  status: OrderRequest['status'];
  viewerRole: 'customer' | 'owner';
}

export function MessageThread({
  requestId,
  orderNumber,
  status,
  viewerRole,
}: MessageThreadProps) {
  const { data: me } = useGetMeQuery();
  const { data: messages = [], isLoading } = useListRequestMessagesQuery(requestId, {
    pollingInterval: POLL_MS,
  });
  const [sendMessage, { isLoading: sending }] = useSendRequestMessageMutation();
  const [markRead] = useMarkRequestThreadReadMutation();
  const [deleteMessage] = useDeleteRequestMessageMutation();

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isClosed = status !== 'pending' && status !== 'accepted';

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // Mark counterparty messages read whenever the visible list contains any
  // unread-from-counterparty rows. Idempotent on the server.
  useEffect(() => {
    if (!me) return;
    const hasUnread = messages.some((m) => m.senderId !== me.id && !m.readAt);
    if (hasUnread) {
      void markRead(requestId);
    }
  }, [messages, me, markRead, requestId]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const content = draft.trim();
    if (!content) return;
    try {
      await sendMessage({ requestId, content }).unwrap();
      setDraft('');
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 429) {
        setError('Slow down — try again in a moment.');
      } else if (e.status === 409) {
        setError('This order is closed; messaging is locked.');
      } else {
        setError('Could not send. Try again.');
      }
    }
  }

  async function onDelete(message: RequestMessage) {
    if (!confirm('Delete this message?')) return;
    await deleteMessage({ requestId, messageId: message.id });
  }

  if (isLoading) {
    return (
      <div className="border-t border-slate-800 px-3 py-3 text-xs text-slate-500">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800">
      <div className="flex items-baseline justify-between px-3 pt-3 text-xs text-slate-400">
        <span>💬 Messages — Order #{orderNumber}</span>
      </div>

      <ul className="space-y-2 px-3 py-3 max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <li className="text-center text-xs text-slate-500">
            {viewerRole === 'customer'
              ? 'No messages yet. Say hi to the team.'
              : 'No messages yet from this customer.'}
          </li>
        )}
        {messages.map((m) => {
          const mine = me?.id === m.senderId;
          const lastMineId = [...messages]
            .reverse()
            .find((x) => x.senderId === me?.id)?.id;
          const lastMine = mine && m.id === lastMineId;
          const seenByCounterparty = lastMine && m.readAt !== null;

          if (m.deleted) {
            return (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-lg px-2 py-1 text-xs italic text-slate-500 ${
                  mine ? 'ml-auto bg-slate-800/50' : 'bg-slate-900/50'
                }`}
              >
                message deleted
              </li>
            );
          }

          return (
            <li
              key={m.id}
              className={`max-w-[85%] ${mine ? 'ml-auto text-right' : ''}`}
            >
              <div className="text-[11px] text-slate-500">
                {!mine && viewerRole === 'customer' && (
                  <span className="mr-1 rounded bg-indigo-950/60 px-1 text-indigo-300">
                    owner
                  </span>
                )}
                {mine ? 'you' : m.sender.displayName}
                {' · '}
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {seenByCounterparty && ' · ✓ seen'}
              </div>
              <div
                className={`mt-0.5 inline-block rounded-lg px-2 py-1 text-sm ${
                  mine
                    ? 'bg-indigo-900/40 text-indigo-100'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                {m.content}
              </div>
              {mine && (
                <button
                  type="button"
                  onClick={() => void onDelete(m)}
                  className="ml-2 text-[10px] text-slate-500 hover:text-red-400"
                >
                  delete
                </button>
              )}
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ul>

      {isClosed ? (
        <p className="border-t border-slate-800 px-3 py-2 text-xs italic text-slate-500">
          This order is closed — messaging is locked.
        </p>
      ) : (
        <form onSubmit={onSend} className="flex gap-2 border-t border-slate-800 px-3 py-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a reply…"
            maxLength={4000}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={sending || draft.trim() === ''}
            className="rounded-md bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
      {error && (
        <p className="px-3 pb-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
