export type PushPermissionState = NotificationPermission | 'unsupported';

interface PushConfigResponse {
  publicKey: string | null;
}

interface SerializedPushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

function hasPushSupport(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window,
  );
}

export function getPushPermissionState(): PushPermissionState {
  return hasPushSupport() ? Notification.permission : 'unsupported';
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const decoded = window.atob(normalized);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function serializeSubscription(subscription: PushSubscription): SerializedPushSubscription {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      auth: json.keys.auth,
      p256dh: json.keys.p256dh,
    },
  };
}

async function readPushConfig(): Promise<PushConfigResponse> {
  const response = await fetch('/api/push/config');
  if (!response.ok) throw new Error('Push notifications are unavailable on this server.');
  return (await response.json()) as PushConfigResponse;
}

async function sendSubscription(credential: string, subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, subscription: serializeSubscription(subscription) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Push notification setup failed.');
  }
}

export async function enablePushNotifications(credential: string): Promise<void> {
  if (!hasPushSupport()) {
    throw new Error('This browser does not support push notifications.');
  }

  const config = await readPushConfig();
  if (!config.publicKey) {
    throw new Error('Push notifications are not configured on this server yet.');
  }

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Allow Scuttlebutt in your browser or iPhone settings.'
        : 'Notification permission was not granted.',
    );
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const readyRegistration = await navigator.serviceWorker.ready;
  const pushManager = readyRegistration.pushManager ?? registration.pushManager;
  let subscription = await pushManager.getSubscription();
  if (!subscription) {
    subscription = await pushManager.subscribe({
      applicationServerKey: decodeBase64Url(config.publicKey),
      userVisibleOnly: true,
    });
  }
  await sendSubscription(credential, subscription);
}

export async function syncPushNotifications(credential: string): Promise<void> {
  if (getPushPermissionState() !== 'granted') return;
  await enablePushNotifications(credential);
}

export async function disablePushNotifications(credential: string): Promise<void> {
  if (!hasPushSupport()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, endpoint }),
    keepalive: true,
  }).catch(() => undefined);
  await subscription.unsubscribe();
}
