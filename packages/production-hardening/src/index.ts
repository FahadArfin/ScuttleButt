export type ReleaseGateStatus = 'pending' | 'passed' | 'blocked' | 'waived';

export type ReleaseGateArea =
  | 'security-review'
  | 'dependency-audit'
  | 'license-audit'
  | 'fuzz-testing'
  | 'load-testing'
  | 'backup-restore'
  | 'disaster-recovery'
  | 'rate-limits'
  | 'abuse-resistance'
  | 'privacy-review'
  | 'accessibility-audit'
  | 'upgrade-tests'
  | 'observability';

export const REQUIRED_RELEASE_GATE_AREAS: readonly ReleaseGateArea[] = [
  'security-review',
  'dependency-audit',
  'license-audit',
  'fuzz-testing',
  'load-testing',
  'backup-restore',
  'disaster-recovery',
  'rate-limits',
  'abuse-resistance',
  'privacy-review',
  'accessibility-audit',
  'upgrade-tests',
  'observability',
];

export interface ReleaseGate {
  id: string;
  area: ReleaseGateArea;
  status: ReleaseGateStatus;
  evidenceReference?: string;
}

export interface ReleaseReadiness {
  ready: boolean;
  blockers: string[];
  passedAreas: ReleaseGateArea[];
}

export function evaluateReleaseReadiness(
  gates: readonly ReleaseGate[],
  requiredAreas: readonly ReleaseGateArea[] = REQUIRED_RELEASE_GATE_AREAS,
): ReleaseReadiness {
  const blockers: string[] = [];
  const passedAreas: ReleaseGateArea[] = [];

  for (const area of requiredAreas) {
    const gate = gates.find((candidate) => candidate.area === area);

    if (!gate) {
      blockers.push(`${area}: missing gate`);
      continue;
    }

    if (gate.status !== 'passed' || !gate.evidenceReference?.trim()) {
      blockers.push(`${area}: ${gate.status} or missing evidence`);
      continue;
    }

    passedAreas.push(area);
  }

  return { ready: blockers.length === 0, blockers, passedAreas };
}

export type VulnerabilitySeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface DependencyVulnerability {
  id: string;
  severity: VulnerabilitySeverity;
}

export interface DependencyRecord {
  name: string;
  version: string;
  direct: boolean;
  licenseSpdx: string | null;
  vulnerabilities: readonly DependencyVulnerability[];
}

export interface DependencyAuditPolicy {
  allowedLicenses: readonly string[];
  deniedLicenses: readonly string[];
  allowUnknownLicenses: boolean;
  failOnSeverities: readonly VulnerabilitySeverity[];
}

export const DEFAULT_DEPENDENCY_AUDIT_POLICY: DependencyAuditPolicy = {
  allowedLicenses: ['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause'],
  deniedLicenses: [],
  allowUnknownLicenses: false,
  failOnSeverities: ['high', 'critical'],
};

export interface DependencyAuditIssue {
  dependency: string;
  kind: 'unknown-license' | 'license-not-allowed' | 'license-denied' | 'vulnerability';
  detail: string;
}

export interface DependencyAuditResult {
  passed: boolean;
  issues: DependencyAuditIssue[];
}

export function auditDependencies(
  records: readonly DependencyRecord[],
  policy: DependencyAuditPolicy = DEFAULT_DEPENDENCY_AUDIT_POLICY,
): DependencyAuditResult {
  const issues: DependencyAuditIssue[] = [];

  for (const record of records) {
    const name = record.name.trim() || '(unnamed dependency)';

    if (!record.licenseSpdx?.trim()) {
      if (!policy.allowUnknownLicenses) {
        issues.push({
          dependency: name,
          kind: 'unknown-license',
          detail: 'SPDX license is missing.',
        });
      }
    } else if (policy.deniedLicenses.includes(record.licenseSpdx)) {
      issues.push({
        dependency: name,
        kind: 'license-denied',
        detail: `License ${record.licenseSpdx} is explicitly denied.`,
      });
    } else if (!policy.allowedLicenses.includes(record.licenseSpdx)) {
      issues.push({
        dependency: name,
        kind: 'license-not-allowed',
        detail: `License ${record.licenseSpdx} is outside the approved inventory.`,
      });
    }

    for (const vulnerability of record.vulnerabilities) {
      if (policy.failOnSeverities.includes(vulnerability.severity)) {
        issues.push({
          dependency: name,
          kind: 'vulnerability',
          detail: `${vulnerability.id} is ${vulnerability.severity}.`,
        });
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
  maxTrackedKeys: number;
}

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  maxRequests: 10,
  windowMs: 60_000,
  maxTrackedKeys: 10_000,
};

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  reason?: 'invalid-request' | 'rate-limited' | 'capacity';
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly policy: RateLimitPolicy = DEFAULT_RATE_LIMIT_POLICY,
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string): RateLimitDecision {
    const normalizedKey = key.trim();
    const now = this.now();

    if (
      !normalizedKey ||
      !Number.isInteger(this.policy.maxRequests) ||
      this.policy.maxRequests < 1 ||
      !Number.isInteger(this.policy.windowMs) ||
      this.policy.windowMs < 1
    ) {
      return { allowed: false, remaining: 0, retryAfterMs: 0, reason: 'invalid-request' };
    }

    this.prune(now);

    let timestamps = this.buckets.get(normalizedKey) ?? [];

    if (!this.buckets.has(normalizedKey) && this.buckets.size >= this.policy.maxTrackedKeys) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: this.policy.windowMs,
        reason: 'capacity',
      };
    }

    timestamps = timestamps.filter((timestamp) => now - timestamp < this.policy.windowMs);

    if (timestamps.length >= this.policy.maxRequests) {
      const oldest = timestamps[0] ?? now;
      this.buckets.set(normalizedKey, timestamps);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, this.policy.windowMs - (now - oldest)),
        reason: 'rate-limited',
      };
    }

    timestamps.push(now);
    this.buckets.set(normalizedKey, timestamps);
    return {
      allowed: true,
      remaining: Math.max(0, this.policy.maxRequests - timestamps.length),
      retryAfterMs: 0,
    };
  }

  private prune(now: number): void {
    for (const [key, timestamps] of this.buckets) {
      const active = timestamps.filter((timestamp) => now - timestamp < this.policy.windowMs);

      if (active.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, active);
      }
    }
  }
}

export interface BackupPolicy {
  encrypted: boolean;
  includeDatabase: boolean;
  includeObjectStorage: boolean;
  includeMatrixSigningKeys: boolean;
  requireOffsiteCopy: boolean;
  requireIntegrityCheck: boolean;
  requireRestoreTest: boolean;
  maxBackupAgeMs: number;
  maxRestoreTestAgeMs: number;
  requireSeparateKeyCustody: boolean;
}

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  encrypted: true,
  includeDatabase: true,
  includeObjectStorage: true,
  includeMatrixSigningKeys: true,
  requireOffsiteCopy: true,
  requireIntegrityCheck: true,
  requireRestoreTest: true,
  maxBackupAgeMs: 24 * 60 * 60 * 1000,
  maxRestoreTestAgeMs: 30 * 24 * 60 * 60 * 1000,
  requireSeparateKeyCustody: true,
};

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  encrypted: boolean;
  databaseIncluded: boolean;
  objectStorageIncluded: boolean;
  matrixSigningKeysIncluded: boolean;
  offsiteCopyAvailable: boolean;
  integrityVerified: boolean;
  restoreTestedAt?: string;
  keyCustody: 'separate-encrypted' | 'same-host' | 'unknown';
}

export interface OperationalReadiness {
  ready: boolean;
  blockers: string[];
}

function isFresh(timestamp: string | undefined, nowMs: number, maxAgeMs: number): boolean {
  const timestampMs = timestamp ? Date.parse(timestamp) : Number.NaN;
  return Number.isFinite(timestampMs) && nowMs >= timestampMs && nowMs - timestampMs <= maxAgeMs;
}

export function evaluateBackupSnapshot(
  snapshot: BackupSnapshot,
  policy: BackupPolicy = DEFAULT_BACKUP_POLICY,
  nowMs = Date.now(),
): OperationalReadiness {
  const blockers: string[] = [];

  if (!isFresh(snapshot.createdAt, nowMs, policy.maxBackupAgeMs)) blockers.push('backup is stale');
  if (policy.encrypted && !snapshot.encrypted) blockers.push('backup is not encrypted');
  if (policy.includeDatabase && !snapshot.databaseIncluded) blockers.push('database is missing');
  if (policy.includeObjectStorage && !snapshot.objectStorageIncluded)
    blockers.push('object storage is missing');
  if (policy.includeMatrixSigningKeys && !snapshot.matrixSigningKeysIncluded)
    blockers.push('Matrix signing keys are missing');
  if (policy.requireOffsiteCopy && !snapshot.offsiteCopyAvailable)
    blockers.push('offsite copy is missing');
  if (policy.requireIntegrityCheck && !snapshot.integrityVerified)
    blockers.push('integrity check is missing');
  if (
    policy.requireRestoreTest &&
    !isFresh(snapshot.restoreTestedAt, nowMs, policy.maxRestoreTestAgeMs)
  ) {
    blockers.push('restore test is stale or missing');
  }
  if (policy.requireSeparateKeyCustody && snapshot.keyCustody !== 'separate-encrypted') {
    blockers.push('backup key custody is not separate and encrypted');
  }

  return { ready: blockers.length === 0, blockers };
}

export interface DisasterRecoveryPlan {
  planId: string;
  recoveryPointObjectiveMs: number;
  recoveryTimeObjectiveMs: number;
  runbookReference: string;
  rollbackProcedureReference: string;
  lastRestoreTestAt?: string;
  ownerRole: string;
}

export function evaluateDisasterRecoveryPlan(
  plan: DisasterRecoveryPlan,
  nowMs = Date.now(),
  maxRestoreTestAgeMs = DEFAULT_BACKUP_POLICY.maxRestoreTestAgeMs,
): OperationalReadiness {
  const blockers: string[] = [];

  if (!plan.planId.trim()) blockers.push('plan ID is missing');
  if (!Number.isInteger(plan.recoveryPointObjectiveMs) || plan.recoveryPointObjectiveMs < 0) {
    blockers.push('recovery point objective is invalid');
  }
  if (!Number.isInteger(plan.recoveryTimeObjectiveMs) || plan.recoveryTimeObjectiveMs < 0) {
    blockers.push('recovery time objective is invalid');
  }
  if (!plan.runbookReference.trim()) blockers.push('recovery runbook is missing');
  if (!plan.rollbackProcedureReference.trim()) blockers.push('rollback procedure is missing');
  if (!plan.ownerRole.trim()) blockers.push('recovery owner is missing');
  if (!isFresh(plan.lastRestoreTestAt, nowMs, maxRestoreTestAgeMs))
    blockers.push('restore test is stale or missing');

  return { ready: blockers.length === 0, blockers };
}

const SENSITIVE_LOG_KEY =
  /(authorization|access[_-]?token|refresh[_-]?token|password|secret|private[_-]?key|plaintext|ciphertext|message|body|content|cookie|media[_-]?token)/i;

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 6) return '[DEPTH_LIMIT]';
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, depth + 1));
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    redacted[key] = SENSITIVE_LOG_KEY.test(key)
      ? '[REDACTED]'
      : redactValue(child, seen, depth + 1);
  }

  return redacted;
}

export function redactLogRecord(
  record: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return redactValue(record, new WeakSet<object>(), 0) as Record<string, unknown>;
}

export interface MetricSample {
  name: string;
  value: number;
  unit?: string;
  labels: Readonly<Record<string, string>>;
}

const METRIC_NAME = /^[a-z][a-z0-9_.-]{1,127}$/;

export function createMetricSample(input: {
  name: string;
  value: number;
  unit?: string;
  labels?: Readonly<Record<string, string>>;
}): MetricSample {
  const name = input.name.trim();

  if (!METRIC_NAME.test(name) || !Number.isFinite(input.value)) {
    throw new Error('Metric name or value is invalid.');
  }

  const labels = input.labels ?? {};

  for (const [key, value] of Object.entries(labels)) {
    if (SENSITIVE_LOG_KEY.test(key) || value.length > 128) {
      throw new Error('Metric labels must not contain sensitive or unbounded values.');
    }
  }

  return {
    name,
    value: input.value,
    ...(input.unit ? { unit: input.unit.trim() } : {}),
    labels: { ...labels },
  };
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

export function createTraceContext(traceId: string, spanId: string, sampled = true): TraceContext {
  if (!/^[a-f0-9]{16,128}$/i.test(traceId) || !/^[a-f0-9]{8,64}$/i.test(spanId)) {
    throw new Error('Trace IDs must be hexadecimal and bounded.');
  }

  return { traceId, spanId, sampled };
}

export type AlertComparator = '>' | '>=' | '<' | '<=';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  metricName: string;
  comparator: AlertComparator;
  threshold: number;
  forMs: number;
  severity: AlertSeverity;
  runbookReference: string;
}

export interface AlertEvaluation {
  triggered: boolean;
  pending: boolean;
  value: number;
}

function compareAlert(value: number, comparator: AlertComparator, threshold: number): boolean {
  if (comparator === '>') return value > threshold;
  if (comparator === '>=') return value >= threshold;
  if (comparator === '<') return value < threshold;
  return value <= threshold;
}

export function evaluateAlert(
  rule: AlertRule,
  sample: MetricSample,
  observedSinceMs: number | undefined,
  nowMs: number,
): AlertEvaluation {
  const matches =
    sample.name === rule.metricName && compareAlert(sample.value, rule.comparator, rule.threshold);
  const pending =
    matches &&
    rule.forMs > 0 &&
    observedSinceMs !== undefined &&
    nowMs - observedSinceMs < rule.forMs;

  return { triggered: matches && !pending, pending, value: sample.value };
}

export type ProductionTestKind =
  'fuzz' | 'load' | 'backup-restore' | 'privacy' | 'accessibility' | 'upgrade';

export interface ProductionTestPlan {
  id: string;
  kind: ProductionTestKind;
  target: string;
  command: string;
  acceptanceCriteria: readonly string[];
  usesProductionData: boolean;
}

export const DEFAULT_PRODUCTION_TEST_PLANS: readonly ProductionTestPlan[] = [
  {
    id: 'fuzz-api-boundaries',
    kind: 'fuzz',
    target: 'platform-api request parsers',
    command: 'pnpm test:fuzz',
    acceptanceCriteria: [
      'bounded input does not crash the process',
      'no secret values appear in failures',
    ],
    usesProductionData: false,
  },
  {
    id: 'load-core-services',
    kind: 'load',
    target: 'health, authentication, media, and federation boundaries',
    command: 'pnpm test:load',
    acceptanceCriteria: ['error rate and latency stay within the release budget'],
    usesProductionData: false,
  },
  {
    id: 'restore-encrypted-backup',
    kind: 'backup-restore',
    target: 'PostgreSQL, Matrix signing keys, and object storage',
    command: 'pnpm test:restore',
    acceptanceCriteria: [
      'restore is isolated',
      'encrypted-room ciphertext remains ciphertext',
      'clients can reconnect',
    ],
    usesProductionData: false,
  },
  {
    id: 'privacy-review',
    kind: 'privacy',
    target: 'logs, telemetry, backups, and user-facing claims',
    command: 'pnpm audit:privacy',
    acceptanceCriteria: ['no plaintext, keys, or bearer tokens are emitted'],
    usesProductionData: false,
  },
  {
    id: 'accessibility-audit',
    kind: 'accessibility',
    target: 'web and desktop flows',
    command: 'pnpm audit:a11y',
    acceptanceCriteria: [
      'keyboard and screen-reader paths are usable',
      'contrast and motion checks pass',
    ],
    usesProductionData: false,
  },
  {
    id: 'upgrade-rollback',
    kind: 'upgrade',
    target: 'Compose services and database migrations',
    command: 'pnpm test:upgrade',
    acceptanceCriteria: ['forward upgrade and documented rollback both complete'],
    usesProductionData: false,
  },
];
