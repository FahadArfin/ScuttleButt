export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'conflict'
  | 'invalid-request'
  | 'unavailable'
  | 'unknown';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
}

export type ApiEnvelope<T> =
  { ok: true; requestId: string; data: T } | { ok: false; requestId: string; error: ApiError };

export interface CursorPage<T> {
  items: readonly T[];
  nextCursor?: string;
}

export interface SharedConversationSummary {
  conversationId: string;
  kind: 'direct' | 'group' | 'community-channel';
  title: string;
  lastEventId?: string;
  unreadCount: number;
}

export interface SharedDeviceSummary {
  deviceId: string;
  displayName: string;
  platform: 'web' | 'desktop' | 'ios' | 'android';
  verified: boolean;
  lastSeenAt?: string;
}

export interface MobileSyncRequest {
  deviceId: string;
  since?: string;
  timeoutMs: number;
  limit: number;
}

export function createMobileSyncRequest(input: {
  deviceId: string;
  since?: string;
  timeoutMs?: number;
  limit?: number;
}): MobileSyncRequest {
  const deviceId = input.deviceId.trim();
  const timeoutMs = input.timeoutMs ?? 25_000;
  const limit = input.limit ?? 50;

  if (!deviceId || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error('Mobile sync device ID or timeout is invalid.');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Mobile sync limit must be between 1 and 100.');
  }

  return {
    deviceId,
    ...(input.since?.trim() ? { since: input.since.trim() } : {}),
    timeoutMs,
    limit,
  };
}

export type MobilePlatform = 'ios' | 'android';
export type PushEnvironment = 'development' | 'production';
export type PushEventKind = 'message' | 'mention' | 'call-invite' | 'device-verification';

export interface PushRegistration {
  platform: MobilePlatform;
  environment: PushEnvironment;
  deviceId: string;
  token: string;
  appVersion: string;
}

export interface PrivacySafePushPayload {
  eventKind: PushEventKind;
  eventId: string;
  title: string;
  body: string;
  collapseKey: string;
  contentAvailable: boolean;
  messagePreviewIncluded: false;
  expiresAt?: string;
}

export function createPrivacySafePushPayload(input: {
  eventKind: PushEventKind;
  eventId: string;
  expiresAt?: string;
}): PrivacySafePushPayload {
  const eventId = input.eventId.trim();

  if (!eventId) {
    throw new Error('Push event ID is required.');
  }

  const copy: Readonly<Record<PushEventKind, { title: string; body: string }>> = {
    message: { title: 'New message', body: 'Open Scuttlebutt to view it.' },
    mention: { title: 'You were mentioned', body: 'Open Scuttlebutt to view it.' },
    'call-invite': { title: 'Incoming call', body: 'Open Scuttlebutt to answer.' },
    'device-verification': {
      title: 'Device verification request',
      body: 'Open Scuttlebutt to review it.',
    },
  };
  const selectedCopy = copy[input.eventKind];

  if (input.expiresAt && !Number.isFinite(Date.parse(input.expiresAt))) {
    throw new Error('Push expiry is invalid.');
  }

  return {
    eventKind: input.eventKind,
    eventId,
    title: selectedCopy.title,
    body: selectedCopy.body,
    collapseKey: `scuttlebutt.${input.eventKind}`,
    contentAvailable: true,
    messagePreviewIncluded: false,
    ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt).toISOString() } : {}),
  };
}

export type MobileSecretKind =
  'matrix-access-token' | 'matrix-refresh-token' | 'device-private-keys' | 'recovery-key';

export type MobileKeyStorageBackend = 'ios-keychain' | 'android-keystore';

export interface MobileKeyStoragePlan {
  platform: MobilePlatform;
  backend: MobileKeyStorageBackend;
  hardwareBackedPreferred: boolean;
  requireUserPresenceForRecovery: boolean;
  privateKeysSync: 'never';
  recoveryExport: 'explicit-encrypted-user-action';
  allowUnencryptedBackup: false;
  secrets: readonly MobileSecretKind[];
}

export function createMobileKeyStoragePlan(platform: MobilePlatform): MobileKeyStoragePlan {
  return {
    platform,
    backend: platform === 'ios' ? 'ios-keychain' : 'android-keystore',
    hardwareBackedPreferred: true,
    requireUserPresenceForRecovery: true,
    privateKeysSync: 'never',
    recoveryExport: 'explicit-encrypted-user-action',
    allowUnencryptedBackup: false,
    secrets: ['matrix-access-token', 'matrix-refresh-token', 'device-private-keys', 'recovery-key'],
  };
}

export type MobileNetworkKind = 'wifi' | 'cellular' | 'offline';
export type MobileBandwidthMode = 'data-saver' | 'balanced' | 'high-quality';

export interface MobileBandwidthProfile {
  mode: MobileBandwidthMode;
  maxVideoWidth: number;
  maxVideoHeight: number;
  maxVideoFps: number;
  maxVideoBitrateKbps: number;
  maxAudioBitrateKbps: number;
  allowScreenShare: boolean;
  allowVideoOnCellular: boolean;
}

export const MOBILE_BANDWIDTH_PROFILES: Readonly<
  Record<MobileBandwidthMode, MobileBandwidthProfile>
> = {
  'data-saver': {
    mode: 'data-saver',
    maxVideoWidth: 640,
    maxVideoHeight: 360,
    maxVideoFps: 20,
    maxVideoBitrateKbps: 500,
    maxAudioBitrateKbps: 32,
    allowScreenShare: false,
    allowVideoOnCellular: false,
  },
  balanced: {
    mode: 'balanced',
    maxVideoWidth: 1280,
    maxVideoHeight: 720,
    maxVideoFps: 30,
    maxVideoBitrateKbps: 1_500,
    maxAudioBitrateKbps: 64,
    allowScreenShare: true,
    allowVideoOnCellular: false,
  },
  'high-quality': {
    mode: 'high-quality',
    maxVideoWidth: 1920,
    maxVideoHeight: 1080,
    maxVideoFps: 30,
    maxVideoBitrateKbps: 3_500,
    maxAudioBitrateKbps: 96,
    allowScreenShare: true,
    allowVideoOnCellular: true,
  },
};

export interface MobileBandwidthContext {
  network: MobileNetworkKind;
  batterySaver: boolean;
  lowPowerDevice: boolean;
}

export interface MobileBandwidthDecision {
  mode: MobileBandwidthMode | null;
  profile: MobileBandwidthProfile | null;
  fellBack: boolean;
  reason?: 'offline' | 'battery-saver' | 'cellular-policy' | 'low-power-device';
}

export function resolveMobileBandwidthMode(
  requestedMode: MobileBandwidthMode,
  context: MobileBandwidthContext,
): MobileBandwidthDecision {
  if (context.network === 'offline') {
    return { mode: null, profile: null, fellBack: true, reason: 'offline' };
  }

  if (context.batterySaver || context.lowPowerDevice) {
    return {
      mode: 'data-saver',
      profile: MOBILE_BANDWIDTH_PROFILES['data-saver'],
      fellBack: requestedMode !== 'data-saver',
      reason: context.batterySaver ? 'battery-saver' : 'low-power-device',
    };
  }

  if (context.network === 'cellular' && requestedMode !== 'data-saver') {
    return {
      mode: 'data-saver',
      profile: MOBILE_BANDWIDTH_PROFILES['data-saver'],
      fellBack: true,
      reason: 'cellular-policy',
    };
  }

  return {
    mode: requestedMode,
    profile: MOBILE_BANDWIDTH_PROFILES[requestedMode],
    fellBack: false,
  };
}

export type MobileDeepLinkKind = 'room' | 'invite' | 'verify-device';

export interface MobileDeepLinkTarget {
  kind: MobileDeepLinkKind;
  value: string;
  source: 'scuttlebutt-scheme' | 'https';
}

const MOBILE_DEEP_LINK_KINDS: readonly MobileDeepLinkKind[] = ['room', 'invite', 'verify-device'];

export function parseMobileDeepLink(
  value: string,
  allowedHttpsOrigins: readonly string[] = [],
): MobileDeepLinkTarget {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Mobile deep link is invalid.');
  }

  if (url.username || url.password || url.port || url.hash || url.search) {
    throw new Error('Mobile deep link contains unsafe URL components.');
  }

  let source: MobileDeepLinkTarget['source'];
  let kind: string;
  let rawValue: string;

  if (url.protocol === 'scuttlebutt:') {
    source = 'scuttlebutt-scheme';
    kind = url.hostname;
    rawValue = url.pathname.slice(1);
  } else if (url.protocol === 'https:') {
    source = 'https';
    if (!allowedHttpsOrigins.some((origin) => normalizeOrigin(origin) === url.origin)) {
      throw new Error('HTTPS deep-link origin is not allowed.');
    }
    const [pathKind, ...pathParts] = url.pathname.split('/').filter(Boolean);
    kind = pathKind ?? '';
    rawValue = pathParts.join('/');
  } else {
    throw new Error('Mobile deep link scheme is not supported.');
  }

  if (!MOBILE_DEEP_LINK_KINDS.includes(kind as MobileDeepLinkKind) || !rawValue.trim()) {
    throw new Error('Mobile deep link target is not supported.');
  }

  return {
    kind: kind as MobileDeepLinkKind,
    value: decodeURIComponent(rawValue),
    source,
  };
}

function normalizeOrigin(value: string): string {
  const url = new URL(value.trim());

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Allowed mobile HTTPS origin is invalid.');
  }

  return url.origin;
}

export type DeviceVerificationMethod = 'qr' | 'sas' | 'recovery-key';

export interface DeviceVerificationRequest {
  transactionId: string;
  localDeviceId: string;
  remoteDeviceId: string;
  method: DeviceVerificationMethod;
  expiresAt: string;
  userConfirmed: boolean;
}

export interface DeviceVerificationDecision {
  allowed: boolean;
  reason?: 'invalid-request' | 'same-device' | 'expired' | 'user-confirmation-required';
}

export function evaluateDeviceVerification(
  request: DeviceVerificationRequest,
  nowMs = Date.now(),
): DeviceVerificationDecision {
  if (
    !request.transactionId.trim() ||
    !request.localDeviceId.trim() ||
    !request.remoteDeviceId.trim()
  ) {
    return { allowed: false, reason: 'invalid-request' };
  }

  if (request.localDeviceId === request.remoteDeviceId) {
    return { allowed: false, reason: 'same-device' };
  }

  const expiresAtMs = Date.parse(request.expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { allowed: false, reason: 'expired' };
  }

  return request.userConfirmed
    ? { allowed: true }
    : { allowed: false, reason: 'user-confirmation-required' };
}

export type BackgroundCallKind = 'incoming' | 'reconnect';

export interface BackgroundCallPolicy {
  enabled: boolean;
  maxWakeDurationMs: number;
  allowCellular: boolean;
  videoRequiresForeground: boolean;
}

export const DEFAULT_BACKGROUND_CALL_POLICY: BackgroundCallPolicy = {
  enabled: true,
  maxWakeDurationMs: 30_000,
  allowCellular: true,
  videoRequiresForeground: true,
};

export interface BackgroundCallRequest {
  kind: BackgroundCallKind;
  network: MobileNetworkKind;
  requestedVideo: boolean;
}

export interface BackgroundCallDecision {
  allowed: boolean;
  mode: 'audio-only' | 'audio-video' | 'none';
  reason?: 'disabled' | 'offline' | 'cellular-policy' | 'video-requires-foreground';
}

export function decideBackgroundCall(
  request: BackgroundCallRequest,
  policy: BackgroundCallPolicy = DEFAULT_BACKGROUND_CALL_POLICY,
): BackgroundCallDecision {
  if (!policy.enabled) return { allowed: false, mode: 'none', reason: 'disabled' };
  if (request.network === 'offline') return { allowed: false, mode: 'none', reason: 'offline' };
  if (request.network === 'cellular' && !policy.allowCellular) {
    return { allowed: false, mode: 'none', reason: 'cellular-policy' };
  }
  if (request.requestedVideo && policy.videoRequiresForeground) {
    return { allowed: true, mode: 'audio-only', reason: 'video-requires-foreground' };
  }
  return { allowed: true, mode: request.requestedVideo ? 'audio-video' : 'audio-only' };
}

export type MobileClientArchitecture =
  'react-native' | 'native-swift-kotlin' | 'shared-core-hybrid';

export interface MobileArchitectureDecisionRecord {
  decision: 'deferred';
  options: readonly MobileClientArchitecture[];
  prerequisites: readonly string[];
  decisionCriteria: readonly string[];
}

export const MOBILE_ARCHITECTURE_DECISION: MobileArchitectureDecisionRecord = {
  decision: 'deferred',
  options: ['react-native', 'native-swift-kotlin', 'shared-core-hybrid'],
  prerequisites: [
    'validate Matrix E2EE and device-verification behavior on iOS and Android',
    'measure background-call and push reliability on supported OS versions',
    'measure media and battery budgets for the selected bandwidth modes',
    'complete the shared API and deep-link contract review',
  ],
  decisionCriteria: [
    'cryptographic storage guarantees',
    'background execution',
    'accessibility',
    'media performance',
    'maintenance cost',
  ],
};
