export type FederationLinkState = 'healthy' | 'degraded' | 'unavailable';

export type FederationFailureKind =
  'network' | 'timeout' | 'remote-http' | 'signature' | 'protocol' | 'rate-limited';

export interface FederationPolicy {
  requireTls: boolean;
  allowedServerNames: readonly string[];
  blockedServerNames: readonly string[];
  maxRetryAttempts: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  maxClockSkewMs: number;
  requireMatrixVerifiedSigningKeys: boolean;
}

export const DEFAULT_FEDERATION_POLICY: FederationPolicy = {
  requireTls: true,
  allowedServerNames: [],
  blockedServerNames: [],
  maxRetryAttempts: 4,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 30_000,
  maxClockSkewMs: 5 * 60 * 1_000,
  requireMatrixVerifiedSigningKeys: true,
};

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

export function normalizeServerName(value: string): string {
  const candidate = requireNonEmpty(value, 'Matrix server name').toLowerCase().replace(/\.$/, '');

  if (/\s|[/?#@]/.test(candidate)) {
    throw new Error('Matrix server name contains invalid characters.');
  }

  const parsed = new URL(`http://${candidate}`);

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Matrix server name must contain only a host and optional port.');
  }

  return parsed.host;
}

export function normalizeHomeserverOrigin(value: string, requireTls = false): string {
  const normalized = requireNonEmpty(value, 'Homeserver origin').replace(/\/+$/, '');
  const parsed = new URL(normalized);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Homeserver origin must use HTTP or HTTPS.');
  }

  if (requireTls && parsed.protocol !== 'https:') {
    throw new Error('Federation homeserver origin must use HTTPS.');
  }

  if (parsed.username || parsed.password || parsed.hash || parsed.search) {
    throw new Error('Homeserver origin cannot contain credentials, query, or fragment data.');
  }

  return parsed.toString().replace(/\/+$/, '');
}

export interface ServerDiscoveryPlan {
  homeserverOrigin: string;
  matrixServerWellKnownUrl: string;
  clientVersionsUrl: string;
  fallbackServerName: string;
}

export function createServerDiscoveryPlan(
  homeserverOrigin: string,
  fallbackServerName: string,
): ServerDiscoveryPlan {
  const origin = normalizeHomeserverOrigin(homeserverOrigin);
  const serverName = normalizeServerName(fallbackServerName);

  return {
    homeserverOrigin: origin,
    matrixServerWellKnownUrl: `${origin}/.well-known/matrix/server`,
    clientVersionsUrl: `${origin}/_matrix/client/versions`,
    fallbackServerName: serverName,
  };
}

export interface FederatedIdentity {
  userId: string;
  localpart: string;
  serverName: string;
}

export function parseFederatedUserId(userId: string): FederatedIdentity {
  const normalized = requireNonEmpty(userId, 'Matrix user ID');

  if (!normalized.startsWith('@')) {
    throw new Error('Matrix user ID must start with @.');
  }

  const separator = normalized.lastIndexOf(':');
  const localpart = normalized.slice(1, separator);
  const serverName = normalized.slice(separator + 1);

  if (separator <= 1 || !localpart || !serverName) {
    throw new Error('Matrix user ID must contain a localpart and server name.');
  }

  return {
    userId: normalized,
    localpart,
    serverName: normalizeServerName(serverName),
  };
}

export interface FederatedRoomIdentity {
  roomId: string;
  localpart: string;
  originServerName: string;
}

export function parseFederatedRoomId(roomId: string): FederatedRoomIdentity {
  const normalized = requireNonEmpty(roomId, 'Matrix room ID');

  if (!normalized.startsWith('!')) {
    throw new Error('Matrix room ID must start with !.');
  }

  const separator = normalized.lastIndexOf(':');
  const localpart = normalized.slice(1, separator);
  const serverName = normalized.slice(separator + 1);

  if (separator <= 1 || !localpart || !serverName) {
    throw new Error('Matrix room ID must contain a localpart and origin server name.');
  }

  return {
    roomId: normalized,
    localpart,
    originServerName: normalizeServerName(serverName),
  };
}

export function isRemoteFederatedIdentity(userId: string, localServerName: string): boolean {
  return parseFederatedUserId(userId).serverName !== normalizeServerName(localServerName);
}

export interface FederationPeer {
  serverName: string;
  homeserverOrigin: string;
  linkState: FederationLinkState;
}

export interface FederationPolicyDecision {
  allowed: boolean;
  reason?: 'blocked' | 'not-allowlisted' | 'tls-required' | 'invalid-server' | 'unavailable';
  serverName?: string;
}

function includesServerName(serverNames: readonly string[], serverName: string): boolean {
  return serverNames.some((candidate) => {
    try {
      return normalizeServerName(candidate) === serverName;
    } catch {
      return false;
    }
  });
}

export function evaluateFederationPeer(
  peer: FederationPeer,
  policy: FederationPolicy = DEFAULT_FEDERATION_POLICY,
): FederationPolicyDecision {
  let serverName: string;

  try {
    serverName = normalizeServerName(peer.serverName);
    normalizeHomeserverOrigin(peer.homeserverOrigin, policy.requireTls);
  } catch {
    return { allowed: false, reason: 'invalid-server' };
  }

  if (includesServerName(policy.blockedServerNames, serverName)) {
    return { allowed: false, reason: 'blocked', serverName };
  }

  if (
    policy.allowedServerNames.length > 0 &&
    !includesServerName(policy.allowedServerNames, serverName)
  ) {
    return { allowed: false, reason: 'not-allowlisted', serverName };
  }

  if (peer.linkState === 'unavailable') {
    return { allowed: false, reason: 'unavailable', serverName };
  }

  return { allowed: true, serverName };
}

export type SigningKeyVerificationState = 'verified-by-matrix' | 'unverified';

export interface FederationSigningKey {
  serverName: string;
  keyId: string;
  fingerprint: string;
  verificationState: SigningKeyVerificationState;
  validFrom: string;
  validUntil?: string;
}

export interface SigningKeyDecision {
  accepted: boolean;
  reason?: 'invalid-key' | 'server-mismatch' | 'unverified' | 'not-yet-valid' | 'expired';
}

export function evaluateFederationSigningKey(
  key: FederationSigningKey,
  expectedServerName: string,
  atMs = Date.now(),
  policy: FederationPolicy = DEFAULT_FEDERATION_POLICY,
): SigningKeyDecision {
  let expected: string;
  let actual: string;

  try {
    expected = normalizeServerName(expectedServerName);
    actual = normalizeServerName(key.serverName);
  } catch {
    return { accepted: false, reason: 'invalid-key' };
  }

  if (!key.keyId.trim() || !key.fingerprint.trim()) {
    return { accepted: false, reason: 'invalid-key' };
  }

  if (actual !== expected) {
    return { accepted: false, reason: 'server-mismatch' };
  }

  if (policy.requireMatrixVerifiedSigningKeys && key.verificationState !== 'verified-by-matrix') {
    return { accepted: false, reason: 'unverified' };
  }

  const validFromMs = Date.parse(key.validFrom);

  if (!Number.isFinite(validFromMs) || validFromMs - atMs > policy.maxClockSkewMs) {
    return { accepted: false, reason: 'not-yet-valid' };
  }

  if (key.validUntil) {
    const validUntilMs = Date.parse(key.validUntil);

    if (!Number.isFinite(validUntilMs) || atMs - validUntilMs > policy.maxClockSkewMs) {
      return { accepted: false, reason: 'expired' };
    }
  }

  return { accepted: true };
}

export interface FederationRetryPlan {
  attempt: number;
  retry: boolean;
  delayMs: number;
}

export function createFederationRetryPlan(
  attempt: number,
  policy: FederationPolicy = DEFAULT_FEDERATION_POLICY,
): FederationRetryPlan {
  const normalizedAttempt = Math.max(1, Math.trunc(attempt));
  const retry = normalizedAttempt <= policy.maxRetryAttempts;
  const delayMs = retry
    ? Math.min(
        policy.maxRetryDelayMs,
        policy.baseRetryDelayMs * 2 ** Math.max(0, normalizedAttempt - 1),
      )
    : 0;

  return { attempt: normalizedAttempt, retry, delayMs };
}

export interface FederationFailure {
  kind: FederationFailureKind;
  retryable: boolean;
  preserveQueuedEvents: boolean;
}

export function classifyFederationFailure(
  kind: FederationFailureKind,
  retryAfterMs?: number,
): FederationFailure {
  const retryable = kind === 'network' || kind === 'timeout' || kind === 'rate-limited';

  return {
    kind,
    retryable: retryAfterMs !== undefined || retryable,
    preserveQueuedEvents: retryable,
  };
}

export interface FederationLinkSummary {
  state: FederationLinkState;
  healthyPeers: string[];
  degradedPeers: string[];
  unavailablePeers: string[];
  queueEventsForUnavailablePeers: boolean;
}

export function summarizeFederationLinks(peers: readonly FederationPeer[]): FederationLinkSummary {
  const healthyPeers: string[] = [];
  const degradedPeers: string[] = [];
  const unavailablePeers: string[] = [];

  for (const peer of peers) {
    const serverName = normalizeServerName(peer.serverName);

    if (peer.linkState === 'healthy') {
      healthyPeers.push(serverName);
    } else if (peer.linkState === 'degraded') {
      degradedPeers.push(serverName);
    } else {
      unavailablePeers.push(serverName);
    }
  }

  const state: FederationLinkState =
    unavailablePeers.length === peers.length && peers.length > 0
      ? 'unavailable'
      : unavailablePeers.length > 0 || degradedPeers.length > 0
        ? 'degraded'
        : 'healthy';

  return {
    state,
    healthyPeers,
    degradedPeers,
    unavailablePeers,
    queueEventsForUnavailablePeers: unavailablePeers.length > 0,
  };
}

export type FederatedInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface FederatedInvite {
  id: string;
  roomId: string;
  inviterUserId: string;
  inviteeUserId: string;
  targetServerName: string;
  status: FederatedInviteStatus;
  createdAt: string;
}

export function createFederatedInvite(input: {
  id: string;
  roomId: string;
  inviterUserId: string;
  inviteeUserId: string;
  createdAt?: string;
}): FederatedInvite {
  const room = parseFederatedRoomId(input.roomId);
  const inviter = parseFederatedUserId(input.inviterUserId);
  const invitee = parseFederatedUserId(input.inviteeUserId);

  if (!input.id.trim() || inviter.userId === invitee.userId) {
    throw new Error('A federated invite needs a distinct ID, inviter, and invitee.');
  }

  const createdAt = input.createdAt ?? new Date().toISOString();

  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Federated invite timestamp is invalid.');
  }

  return {
    id: input.id.trim(),
    roomId: room.roomId,
    inviterUserId: inviter.userId,
    inviteeUserId: invitee.userId,
    targetServerName: invitee.serverName,
    status: 'pending',
    createdAt: new Date(createdAt).toISOString(),
  };
}
