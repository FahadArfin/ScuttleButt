export const PUSH_TO_TALK_ACCELERATOR = 'CommandOrControl+Shift+Space' as const;
export const SCUTTLEBUTT_DEEP_LINK_PROTOCOL = 'scuttlebutt:' as const;

const DESKTOP_RUNTIME_ERROR = 'Desktop runtime is unavailable in this context.';
const DEEP_LINK_HOSTS = new Set(['friend', 'login', 'open']);

export interface DesktopSession {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  refreshToken?: string;
}

export interface DesktopNotification {
  title: string;
  body: string;
}

export interface DesktopDiagnostics {
  runtime: 'desktop' | 'web';
  secureStorage: 'os-keychain' | 'unavailable';
  notifications: boolean;
  globalShortcut: boolean;
  deepLinks: boolean;
  mediaDevices: boolean;
  platform?: string;
}

export interface DesktopBridge {
  readonly runtime: 'desktop' | 'web';
  saveSession(session: DesktopSession): Promise<void>;
  loadSession(): Promise<DesktopSession | null>;
  clearSession(): Promise<void>;
  notify(input: DesktopNotification): Promise<void>;
  setPushToTalkEnabled(enabled: boolean, accelerator?: string): Promise<void>;
  onPushToTalk(listener: (pressed: boolean) => void): Promise<() => void>;
  getDiagnostics(): Promise<DesktopDiagnostics>;
  onDeepLink(listener: (url: string) => void): Promise<() => void>;
}

type UnknownRecord = Record<string, unknown>;
type NativeInvoke = <T>(command: string, args?: UnknownRecord) => Promise<T>;

let nativeInvoke: Promise<NativeInvoke> | undefined;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requiredText(value, field);
}

export function validateDesktopSession(value: unknown): DesktopSession {
  if (!isRecord(value)) {
    throw new Error('A desktop session object is required.');
  }

  const homeserverUrl = requiredText(value.homeserverUrl, 'A homeserver URL');
  let parsedHomeserverUrl: URL;
  try {
    parsedHomeserverUrl = new URL(homeserverUrl);
  } catch {
    throw new Error('A valid homeserver URL is required.');
  }
  if (!['http:', 'https:'].includes(parsedHomeserverUrl.protocol)) {
    throw new Error('The homeserver URL must use HTTP or HTTPS.');
  }

  return {
    homeserverUrl,
    accessToken: requiredText(value.accessToken, 'An access token'),
    userId: requiredText(value.userId, 'A Matrix user ID'),
    deviceId: requiredText(value.deviceId, 'A Matrix device ID'),
    refreshToken: optionalText(value.refreshToken, 'A refresh token'),
  };
}

export function isAllowedDeepLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === SCUTTLEBUTT_DEEP_LINK_PROTOCOL &&
      DEEP_LINK_HOSTS.has(url.hostname) &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.port.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}

export function normalizeDeepLink(value: string): string | null {
  return isAllowedDeepLink(value) ? value : null;
}

export function isDesktopRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}

async function invoke<T>(command: string, args?: UnknownRecord): Promise<T> {
  nativeInvoke ??= import('@tauri-apps/api/core').then(({ invoke: tauriInvoke }) => tauriInvoke);
  return (await nativeInvoke)(command, args);
}

function requireDesktopRuntime(): void {
  if (!isDesktopRuntime()) {
    throw new Error(DESKTOP_RUNTIME_ERROR);
  }
}

function validateNotification(input: DesktopNotification): DesktopNotification {
  if (!isRecord(input)) {
    throw new Error('A notification object is required.');
  }
  const title = requiredText(input.title, 'A notification title');
  const body = requiredText(input.body, 'A notification body');
  if (title.length > 120 || body.length > 500) {
    throw new Error('Desktop notification content is too long.');
  }
  return { title, body };
}

function webDiagnostics(): DesktopDiagnostics {
  return {
    runtime: 'web',
    secureStorage: 'unavailable',
    notifications: typeof Notification !== 'undefined',
    globalShortcut: false,
    deepLinks: false,
    mediaDevices: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
  };
}

function validateDiagnostics(value: unknown): DesktopDiagnostics {
  if (!isRecord(value)) {
    throw new Error('Desktop diagnostics were not available.');
  }
  const runtime = value.runtime === 'desktop' ? 'desktop' : 'web';
  const secureStorage = value.secureStorage === 'os-keychain' ? 'os-keychain' : 'unavailable';
  return {
    runtime,
    secureStorage,
    notifications: value.notifications === true,
    globalShortcut: value.globalShortcut === true,
    deepLinks: value.deepLinks === true,
    mediaDevices: value.mediaDevices === true,
    platform: typeof value.platform === 'string' ? value.platform : undefined,
  };
}

async function subscribeToDeepLinks(listener: (url: string) => void): Promise<() => void> {
  requireDesktopRuntime();
  const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
  let active = true;
  const dispatch = (urls: string[]) => {
    if (!active) {
      return;
    }
    for (const url of urls) {
      const normalizedUrl = normalizeDeepLink(url);
      if (normalizedUrl) {
        listener(normalizedUrl);
      }
    }
  };

  const unlisten = await onOpenUrl(dispatch);
  const currentUrls = await getCurrent();
  if (currentUrls) {
    dispatch(currentUrls);
  }

  return () => {
    active = false;
    unlisten();
  };
}

async function subscribeToPushToTalk(listener: (pressed: boolean) => void): Promise<() => void> {
  requireDesktopRuntime();
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<boolean>('desktop://push-to-talk', (event) => {
    listener(event.payload === true);
  });
  return unlisten;
}

export function createDesktopBridge(): DesktopBridge {
  const runtime = isDesktopRuntime() ? 'desktop' : 'web';

  return {
    runtime,
    async saveSession(session) {
      requireDesktopRuntime();
      const validatedSession = validateDesktopSession(session);
      await invoke('store_session', { session: JSON.stringify(validatedSession) });
    },
    async loadSession() {
      requireDesktopRuntime();
      const serializedSession = await invoke<string | null>('load_session');
      return serializedSession ? validateDesktopSession(JSON.parse(serializedSession)) : null;
    },
    async clearSession() {
      requireDesktopRuntime();
      await invoke('clear_session');
    },
    async notify(input) {
      requireDesktopRuntime();
      const notification = validateNotification(input);
      await invoke('send_notification', {
        title: notification.title,
        body: notification.body,
      });
    },
    async setPushToTalkEnabled(enabled, accelerator = PUSH_TO_TALK_ACCELERATOR) {
      requireDesktopRuntime();
      if (accelerator !== PUSH_TO_TALK_ACCELERATOR) {
        throw new Error('Only the approved push-to-talk accelerator may be registered.');
      }
      await invoke('set_push_to_talk_enabled', { enabled, accelerator });
    },
    async onPushToTalk(listener) {
      return runtime === 'desktop' ? subscribeToPushToTalk(listener) : () => undefined;
    },
    async getDiagnostics() {
      return runtime === 'desktop'
        ? validateDiagnostics(await invoke('desktop_diagnostics'))
        : webDiagnostics();
    },
    async onDeepLink(listener) {
      return runtime === 'desktop' ? subscribeToDeepLinks(listener) : () => undefined;
    },
  };
}
