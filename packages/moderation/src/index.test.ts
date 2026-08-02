import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INVITE_POLICY,
  DEFAULT_MAX_TIMEOUT_MS,
  DEFAULT_RETENTION_POLICY,
  DEFAULT_STORAGE_POLICY,
  DEFAULT_STREAM_QUALITY_POLICY,
  InMemoryAuditLog,
  ROLE_DEFINITIONS,
  STREAM_QUALITY_PROFILES,
  canAssignRole,
  canCreateInvite,
  canJoinStream,
  canPerformModerationAction,
  canRegister,
  canUseInvite,
  canUseStorageProcessing,
  createAuditEvent,
  createModerationAction,
  createModerationReport,
  evaluateStorageUsage,
  isModerationRestrictionActive,
  isRetentionExpired,
  resolveStreamQuality,
  revokeModerationAction,
} from './index.js';

const owner = { userId: 'owner', roles: ['owner'] as const };
const admin = { userId: 'admin', roles: ['admin'] as const };
const moderator = { userId: 'moderator', roles: ['moderator'] as const };
const memberTarget = { userId: 'member', highestRole: 'member' as const };

describe('roles and moderation actions', () => {
  it('enforces role hierarchy for destructive actions and role assignment', () => {
    expect(canPerformModerationAction(moderator, 'ban', memberTarget)).toBe(true);
    expect(
      canPerformModerationAction(moderator, 'ban', { userId: 'admin', highestRole: 'admin' }),
    ).toBe(false);
    expect(
      canPerformModerationAction(admin, 'ban', { userId: 'owner', highestRole: 'owner' }),
    ).toBe(false);
    expect(
      canPerformModerationAction(moderator, 'ban', {
        userId: 'moderator',
        highestRole: 'moderator',
      }),
    ).toBe(false);
    expect(canAssignRole(owner, memberTarget, 'moderator')).toBe(true);
    expect(canAssignRole(admin, memberTarget, 'owner')).toBe(false);
    expect(ROLE_DEFINITIONS.owner.rank).toBeGreaterThan(ROLE_DEFINITIONS.admin.rank);
  });

  it('creates expiring timeouts and permanent bans without claiming enforcement happened', () => {
    const timeout = createModerationAction({
      id: 'case-timeout',
      communityId: 'community-1',
      actor: moderator,
      target: memberTarget,
      action: 'timeout',
      reasonCode: 'spam',
      durationMs: 60_000,
      createdAt: '2026-08-02T12:00:00.000Z',
    });
    const timeoutStart = Date.parse(timeout.createdAt);

    expect(isModerationRestrictionActive(timeout, timeoutStart + 59_999)).toBe(true);
    expect(isModerationRestrictionActive(timeout, timeoutStart + 60_000)).toBe(false);
    expect(isModerationRestrictionActive(revokeModerationAction(timeout), timeoutStart)).toBe(
      false,
    );
    expect(() =>
      createModerationAction({
        id: 'too-long',
        communityId: 'community-1',
        actor: moderator,
        target: memberTarget,
        action: 'timeout',
        reasonCode: 'other',
        durationMs: DEFAULT_MAX_TIMEOUT_MS + 1,
      }),
    ).toThrow('maximum');

    const ban = createModerationAction({
      id: 'case-ban',
      communityId: 'community-1',
      actor: admin,
      target: memberTarget,
      action: 'ban',
      reasonCode: 'evasion',
      createdAt: '2026-08-02T12:00:00.000Z',
    });
    expect(isModerationRestrictionActive(ban, Date.parse('2030-01-01T00:00:00.000Z'))).toBe(true);
  });
});

describe('reports and audit log', () => {
  it('requires explicit disclosure confirmation for client-assisted encrypted reports', () => {
    const rejected = createModerationReport({
      id: 'report-1',
      reporterId: 'alice',
      source: 'client-assisted-e2ee',
      reasonCode: 'harassment',
      description: 'This message needs moderator review.',
      roomId: '!room:localhost',
      eventIds: ['$event-1'],
      selectedContent: 'Selected content disclosed by the reporter.',
      disclosureConfirmed: false,
    });

    expect(rejected).toMatchObject({ ok: false });
    if (!rejected.ok) {
      expect(rejected.issues.map(({ code }) => code)).toContain('disclosure-not-confirmed');
    }

    const accepted = createModerationReport({
      id: 'report-2',
      reporterId: 'alice',
      source: 'client-assisted-e2ee',
      reasonCode: 'harassment',
      description: 'This message needs moderator review.',
      communityId: 'community-1',
      roomId: '!room:localhost',
      senderId: '@bob:localhost',
      eventIds: ['$event-1'],
      selectedContent: 'Selected content disclosed by the reporter.',
      surroundingContext: 'Only the selected context was shared.',
      attachmentAssetIds: ['asset-1'],
      disclosureConfirmed: true,
      createdAt: '2026-08-02T12:00:00.000Z',
    });

    expect(accepted).toMatchObject({
      ok: true,
      report: {
        source: 'client-assisted-e2ee',
        evidence: {
          roomId: '!room:localhost',
          eventIds: ['$event-1'],
          disclosureConfirmed: true,
        },
      },
    });
  });

  it('does not let ordinary reports smuggle selected decrypted content into the server path', () => {
    const result = createModerationReport({
      id: 'report-3',
      reporterId: 'alice',
      source: 'user-submitted',
      reasonCode: 'other',
      description: 'Review this report.',
      eventIds: [],
      selectedContent: 'This must use the client-assisted path.',
      disclosureConfirmed: true,
    });

    expect(result).toMatchObject({ ok: false });
  });

  it('rejects unsafe audit metadata and stores only bounded structured events', () => {
    expect(() =>
      createAuditEvent({
        id: 'audit-unsafe',
        communityId: 'community-1',
        actorUserId: 'moderator',
        action: 'moderation-action',
        metadata: { plaintext: 'never store this' },
      }),
    ).toThrow('not allowed');

    const log = new InMemoryAuditLog();
    const event = createAuditEvent({
      id: 'audit-safe',
      communityId: 'community-1',
      actorUserId: 'moderator',
      action: 'moderation-action',
      targetUserId: 'member',
      createdAt: '2026-08-02T12:00:00.000Z',
      metadata: { reasonCode: 'spam', durationMs: 60_000 },
    });
    log.append(event);
    expect(log.list('community-1')).toEqual([event]);
    expect(() => log.append(event)).toThrow('already exists');
  });
});

describe('invite and registration controls', () => {
  it('requires the configured role and caps active invite creation', () => {
    expect(canCreateInvite(moderator, DEFAULT_INVITE_POLICY, 0)).toEqual({ allowed: true });
    expect(
      canCreateInvite({ userId: 'member', roles: ['member'] }, DEFAULT_INVITE_POLICY, 0),
    ).toMatchObject({
      allowed: false,
      reason: 'insufficient-role',
    });
    expect(
      canCreateInvite(moderator, { ...DEFAULT_INVITE_POLICY, maxActiveInvitesPerUser: 2 }, 2),
    ).toMatchObject({ allowed: false, reason: 'invite-limit-reached' });
    expect(
      canUseInvite(
        {
          id: 'invite-1',
          issuerUserId: 'moderator',
          expiresAt: '2026-08-03T00:00:00.000Z',
          maxUses: 2,
          uses: 1,
        },
        Date.parse('2026-08-02T12:00:00.000Z'),
      ),
    ).toEqual({ allowed: true });
    expect(
      canUseInvite(
        {
          id: 'invite-2',
          issuerUserId: 'moderator',
          expiresAt: '2026-08-01T00:00:00.000Z',
          maxUses: 2,
          uses: 0,
        },
        Date.parse('2026-08-02T12:00:00.000Z'),
      ),
    ).toMatchObject({ allowed: false, reason: 'invite-expired' });
  });

  it('applies invite, guest, email, and rate controls before registration', () => {
    const policy = {
      enabled: true,
      requireInvite: true,
      allowGuestRegistration: false,
      requireEmailVerification: true,
      allowedEmailDomains: ['example.org'],
      maxAttemptsPerWindow: 3,
    };
    expect(
      canRegister(
        {
          hasValidInvite: true,
          guest: false,
          email: 'alice@example.org',
          emailVerified: true,
          recentAttempts: 0,
        },
        policy,
      ),
    ).toEqual({ allowed: true });
    expect(
      canRegister(
        {
          hasValidInvite: false,
          guest: false,
          email: 'alice@example.org',
          emailVerified: true,
          recentAttempts: 0,
        },
        policy,
      ),
    ).toMatchObject({ allowed: false, reason: 'invite-required' });
    expect(
      canRegister(
        {
          hasValidInvite: true,
          guest: false,
          email: 'alice@other.example',
          emailVerified: true,
          recentAttempts: 0,
        },
        policy,
      ),
    ).toMatchObject({ allowed: false, reason: 'email-domain-not-allowed' });
  });
});

describe('retention, storage, and stream policies', () => {
  it('honors indefinite retention and legal holds while expiring bounded operational data', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    const old = '2025-01-01T00:00:00.000Z';
    expect(isRetentionExpired({ subject: 'message-events', createdAt: old }, now)).toBe(false);
    expect(isRetentionExpired({ subject: 'audit-events', createdAt: old }, now)).toBe(true);
    expect(
      isRetentionExpired({ subject: 'audit-events', createdAt: old, legalHold: true }, now),
    ).toBe(false);
    expect(
      isRetentionExpired(
        { subject: 'report-records', createdAt: old, activeModerationCase: true },
        now,
      ),
    ).toBe(false);
    expect(DEFAULT_RETENTION_POLICY.voiceMetadataMaxAgeMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('evaluates object, user, and total storage limits with a warning state', () => {
    const policy = {
      ...DEFAULT_STORAGE_POLICY,
      totalQuotaBytes: 1_000,
      perUserQuotaBytes: 800,
      warningThresholdRatio: 0.8,
      maxObjectSizeBytes: 500,
    };
    expect(
      evaluateStorageUsage(
        { totalUsedBytes: 700, userUsedBytes: 500, requestedBytes: 100 },
        policy,
      ),
    ).toMatchObject({
      allowed: true,
      status: 'warning',
    });
    expect(
      evaluateStorageUsage(
        { totalUsedBytes: 700, userUsedBytes: 500, requestedBytes: 600 },
        policy,
      ),
    ).toMatchObject({
      allowed: false,
      reason: 'object-too-large',
    });
    expect(
      evaluateStorageUsage(
        { totalUsedBytes: 950, userUsedBytes: 500, requestedBytes: 100 },
        policy,
      ),
    ).toMatchObject({
      allowed: false,
      reason: 'total-quota-exceeded',
    });
    expect(
      canUseStorageProcessing('client-encrypted', { ...policy, allowServerProcessing: false }),
    ).toBe(true);
    expect(
      canUseStorageProcessing('server-processed', { ...policy, allowServerProcessing: false }),
    ).toBe(false);
  });

  it('falls back from unsupported stream quality instead of mislabeling the sent mode', () => {
    expect(resolveStreamQuality('ultra')).toMatchObject({
      selectedMode: 'balanced',
      fellBack: true,
      profile: STREAM_QUALITY_PROFILES.balanced,
    });
    expect(
      resolveStreamQuality('smooth', {
        ...DEFAULT_STREAM_QUALITY_POLICY,
        enabledModes: ['data-saver', 'smooth'],
        maxFps: 60,
        maxBitrateKbps: 5_000,
      }),
    ).toMatchObject({ selectedMode: 'smooth', fellBack: false });
    expect(canJoinStream(DEFAULT_STREAM_QUALITY_POLICY.maxParticipants)).toMatchObject({
      allowed: false,
      reason: 'participant-limit-reached',
    });
    expect(canJoinStream(1)).toEqual({ allowed: true });
  });
});
