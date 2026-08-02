import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FEDERATION_POLICY,
  createFederatedInvite,
  createFederationRetryPlan,
  createServerDiscoveryPlan,
  evaluateFederationPeer,
  evaluateFederationSigningKey,
  isRemoteFederatedIdentity,
  normalizeHomeserverOrigin,
  parseFederatedRoomId,
  parseFederatedUserId,
  summarizeFederationLinks,
} from './index.js';

describe('federated identity and discovery contracts', () => {
  it('normalizes homeserver discovery inputs and parses remote Matrix identities', () => {
    expect(normalizeHomeserverOrigin('https://Example.org/')).toBe('https://example.org');
    expect(createServerDiscoveryPlan('https://example.org/', 'Example.org')).toEqual({
      homeserverOrigin: 'https://example.org',
      matrixServerWellKnownUrl: 'https://example.org/.well-known/matrix/server',
      clientVersionsUrl: 'https://example.org/_matrix/client/versions',
      fallbackServerName: 'example.org',
    });
    expect(parseFederatedUserId('@alice:Example.org')).toEqual({
      userId: '@alice:Example.org',
      localpart: 'alice',
      serverName: 'example.org',
    });
    expect(parseFederatedRoomId('!room:example.org')).toMatchObject({
      localpart: 'room',
      originServerName: 'example.org',
    });
    expect(isRemoteFederatedIdentity('@alice:remote.example', 'local.example')).toBe(true);
    expect(isRemoteFederatedIdentity('@alice:local.example', 'local.example')).toBe(false);
    expect(() => normalizeHomeserverOrigin('http://example.org', true)).toThrow('HTTPS');
  });
});

describe('federation policy and signing-key boundaries', () => {
  it('applies blocklists before allowlists and makes TLS policy explicit', () => {
    const policy = {
      ...DEFAULT_FEDERATION_POLICY,
      requireTls: false,
      allowedServerNames: ['remote.example'],
      blockedServerNames: ['blocked.example'],
    };
    expect(
      evaluateFederationPeer(
        {
          serverName: 'remote.example',
          homeserverOrigin: 'http://remote.example',
          linkState: 'healthy',
        },
        policy,
      ),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateFederationPeer(
        {
          serverName: 'blocked.example',
          homeserverOrigin: 'http://blocked.example',
          linkState: 'healthy',
        },
        policy,
      ),
    ).toMatchObject({ allowed: false, reason: 'blocked' });
    expect(
      evaluateFederationPeer(
        {
          serverName: 'other.example',
          homeserverOrigin: 'http://other.example',
          linkState: 'healthy',
        },
        policy,
      ),
    ).toMatchObject({ allowed: false, reason: 'not-allowlisted' });
  });

  it('accepts only Matrix-verified, time-valid signing-key metadata', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    const key = {
      serverName: 'remote.example',
      keyId: 'ed25519:auto',
      fingerprint: 'fingerprint-not-private-key-material',
      verificationState: 'verified-by-matrix' as const,
      validFrom: '2026-08-01T00:00:00.000Z',
      validUntil: '2026-08-03T00:00:00.000Z',
    };
    expect(evaluateFederationSigningKey(key, 'remote.example', now)).toEqual({ accepted: true });
    expect(
      evaluateFederationSigningKey(
        { ...key, verificationState: 'unverified' },
        'remote.example',
        now,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'unverified',
    });
    expect(
      evaluateFederationSigningKey(
        { ...key, validUntil: '2026-08-01T00:00:00.000Z' },
        'remote.example',
        now,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'expired',
    });
    expect(evaluateFederationSigningKey(key, 'other.example', now)).toMatchObject({
      accepted: false,
      reason: 'server-mismatch',
    });
  });
});

describe('partial failure and cross-server flow contracts', () => {
  it('caps exponential retry and summarizes a partial outage without dropping queued work', () => {
    expect(createFederationRetryPlan(1)).toMatchObject({ retry: true, delayMs: 1_000 });
    expect(createFederationRetryPlan(5)).toMatchObject({ retry: false, delayMs: 0 });
    expect(
      summarizeFederationLinks([
        { serverName: 'a.example', homeserverOrigin: 'https://a.example', linkState: 'healthy' },
        {
          serverName: 'b.example',
          homeserverOrigin: 'https://b.example',
          linkState: 'unavailable',
        },
      ]),
    ).toEqual({
      state: 'degraded',
      healthyPeers: ['a.example'],
      degradedPeers: [],
      unavailablePeers: ['b.example'],
      queueEventsForUnavailablePeers: true,
    });
  });

  it('models a cross-server room invitation without inventing a second identity protocol', () => {
    const invite = createFederatedInvite({
      id: 'invite-1',
      roomId: '!room:local.example',
      inviterUserId: '@alice:local.example',
      inviteeUserId: '@bob:remote.example',
      createdAt: '2026-08-02T12:00:00.000Z',
    });
    expect(invite).toMatchObject({
      targetServerName: 'remote.example',
      status: 'pending',
      roomId: '!room:local.example',
    });
    expect(() =>
      createFederatedInvite({
        id: 'invite-2',
        roomId: '!room:local.example',
        inviterUserId: '@alice:local.example',
        inviteeUserId: '@alice:local.example',
      }),
    ).toThrow('distinct');
  });
});
