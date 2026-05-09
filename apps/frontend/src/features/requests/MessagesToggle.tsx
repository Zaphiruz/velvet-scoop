import {
  useGetMeQuery,
  useListRequestMessagesQuery,
  type OrderRequest,
} from '../../api/api';

export interface MessagesToggleProps {
  request: OrderRequest;
  expanded: boolean;
  onToggle: () => void;
}

export function MessagesToggle({ request, expanded, onToggle }: MessagesToggleProps) {
  const { data: me } = useGetMeQuery();
  // When expanded, the inner MessageThread polls the same cache at 12s,
  // so a second 30s poll here would be redundant.
  const { data: messages = [] } = useListRequestMessagesQuery(request.id, {
    pollingInterval: expanded ? undefined : 30_000,
  });
  const unread = me
    ? messages.filter((m) => m.senderId !== me.id && !m.readAt && !m.deleted).length
    : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 flex w-full items-center justify-between rounded border border-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/40"
    >
      <span>
        💬 Messages{unread > 0 ? ` (${unread})` : ''}
      </span>
      <span aria-hidden>{expanded ? '▴' : '▾'}</span>
    </button>
  );
}
