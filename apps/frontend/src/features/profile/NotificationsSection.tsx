import { useEffect, useState } from 'react';
import {
  useGetMeQuery,
  useGetVapidPublicKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
} from '../../api/api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOSNotInstalled(): boolean {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

export function NotificationsSection() {
  const { data: me } = useGetMeQuery();
  const { data: vapidPublicKey, error: vapidError } = useGetVapidPublicKeyQuery();
  const [subscribePush] = useSubscribePushMutation();
  const [unsubscribePush] = useUnsubscribePushMutation();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => undefined);
  }, []);

  async function handleSubscribe() {
    setError(null);
    if (!vapidPublicKey) {
      setError('Push not configured on the server.');
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });
      const json = sub.toJSON();
      await subscribePush({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        userAgent: navigator.userAgent,
      }).unwrap();
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not subscribe.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unsubscribePush({ endpoint: sub.endpoint }).unwrap();
      } else {
        await unsubscribePush().unwrap();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unsubscribe.');
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  const iosNotInstalled = isIOSNotInstalled();
  const denied = permission === 'denied';
  const unsupported = permission === 'unsupported';
  const serverNotConfigured =
    (vapidError as { status?: number } | undefined)?.status === 503;

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-base font-medium">Push notifications</h3>
      <p className="text-xs text-slate-400">
        Get a notification on this device when there's an update on your order.
        {me.role === 'admin' && me.isOwner ? ' Owners also get notified on new orders.' : ''}
      </p>

      {serverNotConfigured && (
        <p className="text-xs text-slate-400">
          Push isn't configured on the server yet.
        </p>
      )}

      {!serverNotConfigured && unsupported && (
        <p className="text-xs text-slate-400">
          Your browser doesn't support push notifications.
        </p>
      )}

      {!serverNotConfigured && !unsupported && iosNotInstalled && (
        <p className="text-xs text-slate-400">
          On iPhone, add this app to your home screen first (Share → Add to Home
          Screen), then come back here to enable push.
        </p>
      )}

      {!serverNotConfigured && !unsupported && !iosNotInstalled && denied && (
        <p className="text-xs text-slate-400">
          Notifications are blocked in your browser. Re-enable them in browser
          settings, then refresh.
        </p>
      )}

      {!serverNotConfigured && !unsupported && !iosNotInstalled && !denied && !subscribed && (
        <button
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={busy}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Enable notifications'}
        </button>
      )}

      {!serverNotConfigured && !unsupported && !iosNotInstalled && !denied && subscribed && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-300">Subscribed on this device.</span>
          <button
            type="button"
            onClick={() => void handleUnsubscribe()}
            disabled={busy}
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Unsubscribe'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
