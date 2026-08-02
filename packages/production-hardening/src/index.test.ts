import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BACKUP_POLICY,
  DEFAULT_PRODUCTION_TEST_PLANS,
  InMemoryRateLimiter,
  auditDependencies,
  createMetricSample,
  createTraceContext,
  evaluateAlert,
  evaluateBackupSnapshot,
  evaluateDisasterRecoveryPlan,
  evaluateReleaseReadiness,
  redactLogRecord,
} from './index.js';

describe('release, dependency, and rate-limit gates', () => {
  it('blocks a release until every required gate has evidence', () => {
    expect(
      evaluateReleaseReadiness(
        [
          {
            id: 'security',
            area: 'security-review',
            status: 'passed',
            evidenceReference: 'review-1',
          },
          { id: 'deps', area: 'dependency-audit', status: 'pending' },
        ],
        ['security-review', 'dependency-audit'],
      ),
    ).toEqual({
      ready: false,
      blockers: ['dependency-audit: pending or missing evidence'],
      passedAreas: ['security-review'],
    });
  });

  it('audits licenses and high-severity vulnerabilities as separate concerns', () => {
    const result = auditDependencies([
      {
        name: 'safe-package',
        version: '1.0.0',
        direct: true,
        licenseSpdx: 'MIT',
        vulnerabilities: [],
      },
      {
        name: 'risky-package',
        version: '2.0.0',
        direct: false,
        licenseSpdx: 'Unknown',
        vulnerabilities: [{ id: 'CVE-test', severity: 'high' }],
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.issues.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['license-not-allowed', 'vulnerability']),
    );
  });

  it('rate-limits per key, reports retry timing, and expires buckets', () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimiter(
      { maxRequests: 2, windowMs: 1_000, maxTrackedKeys: 10 },
      () => now,
    );
    expect(limiter.consume('alice')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('alice')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume('alice')).toMatchObject({
      allowed: false,
      reason: 'rate-limited',
      retryAfterMs: 1_000,
    });
    now += 1_001;
    expect(limiter.consume('alice')).toMatchObject({ allowed: true, remaining: 1 });
  });
});

describe('backup, recovery, and observability boundaries', () => {
  it('requires encrypted, offsite, integrity-checked backups and recent restore tests', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    expect(
      evaluateBackupSnapshot(
        {
          id: 'backup-1',
          createdAt: '2026-08-02T11:00:00.000Z',
          encrypted: true,
          databaseIncluded: true,
          objectStorageIncluded: true,
          matrixSigningKeysIncluded: true,
          offsiteCopyAvailable: true,
          integrityVerified: true,
          restoreTestedAt: '2026-08-01T12:00:00.000Z',
          keyCustody: 'separate-encrypted',
        },
        DEFAULT_BACKUP_POLICY,
        now,
      ),
    ).toEqual({ ready: true, blockers: [] });
    expect(
      evaluateBackupSnapshot(
        {
          id: 'backup-2',
          createdAt: '2026-08-02T11:00:00.000Z',
          encrypted: false,
          databaseIncluded: true,
          objectStorageIncluded: false,
          matrixSigningKeysIncluded: true,
          offsiteCopyAvailable: false,
          integrityVerified: false,
          keyCustody: 'same-host',
        },
        DEFAULT_BACKUP_POLICY,
        now,
      ),
    ).toMatchObject({ ready: false });
  });

  it('requires documented recovery targets, ownership, rollback, and a tested restore', () => {
    expect(
      evaluateDisasterRecoveryPlan(
        {
          planId: 'dr-1',
          recoveryPointObjectiveMs: 15 * 60_000,
          recoveryTimeObjectiveMs: 60 * 60_000,
          runbookReference: 'runbook/dr-1',
          rollbackProcedureReference: 'runbook/rollback-1',
          lastRestoreTestAt: '2026-08-01T12:00:00.000Z',
          ownerRole: 'devops',
        },
        Date.parse('2026-08-02T12:00:00.000Z'),
      ),
    ).toEqual({ ready: true, blockers: [] });
  });

  it('redacts nested credentials and content without mutating the source', () => {
    const source = {
      requestId: 'request-1',
      authorization: 'Bearer secret-token',
      nested: { message: 'plaintext', safe: 'kept' },
      list: [{ password: 'secret' }],
    };
    const redacted = redactLogRecord(source);
    expect(redacted).toMatchObject({
      requestId: 'request-1',
      authorization: '[REDACTED]',
      nested: { message: '[REDACTED]', safe: 'kept' },
      list: [{ password: '[REDACTED]' }],
    });
    expect(source.authorization).toBe('Bearer secret-token');
  });
});

describe('metrics, traces, alerts, and test plans', () => {
  it('rejects sensitive metric labels and accepts bounded trace context', () => {
    expect(
      createMetricSample({
        name: 'scuttlebutt.api.requests',
        value: 3,
        labels: { route: '/health' },
      }),
    ).toMatchObject({
      name: 'scuttlebutt.api.requests',
      value: 3,
    });
    expect(() =>
      createMetricSample({ name: 'requests', value: 1, labels: { access_token: 'secret' } }),
    ).toThrow('sensitive');
    expect(createTraceContext('a'.repeat(32), 'b'.repeat(16))).toEqual({
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      sampled: true,
    });
  });

  it('keeps alerts pending until their duration and exposes a safe test inventory', () => {
    const rule = {
      id: 'api-errors',
      metricName: 'scuttlebutt.api.errors',
      comparator: '>=' as const,
      threshold: 5,
      forMs: 60_000,
      severity: 'critical' as const,
      runbookReference: 'runbook/api-errors',
    };
    const sample = createMetricSample({ name: rule.metricName, value: 6 });
    expect(evaluateAlert(rule, sample, 1_000, 30_000)).toMatchObject({
      triggered: false,
      pending: true,
    });
    expect(evaluateAlert(rule, sample, 1_000, 61_000)).toMatchObject({
      triggered: true,
      pending: false,
    });
    expect(DEFAULT_PRODUCTION_TEST_PLANS.every((plan) => !plan.usesProductionData)).toBe(true);
  });
});
