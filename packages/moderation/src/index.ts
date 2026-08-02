export type RoleName = 'owner' | 'admin' | 'moderator' | 'member';

export type ModerationPermission =
  | 'view_reports'
  | 'resolve_reports'
  | 'warn_members'
  | 'timeout_members'
  | 'kick_members'
  | 'ban_members'
  | 'manage_roles'
  | 'manage_invites'
  | 'manage_registration'
  | 'manage_retention'
  | 'manage_storage'
  | 'manage_stream_quality'
  | 'view_audit_log';

export interface RoleDefinition {
  name: RoleName;
  rank: number;
  permissions: readonly ModerationPermission[];
}

export const ROLE_DEFINITIONS: Readonly<Record<RoleName, RoleDefinition>> = {
  member: {
    name: 'member',
    rank: 10,
    permissions: [],
  },
  moderator: {
    name: 'moderator',
    rank: 20,
    permissions: [
      'view_reports',
      'resolve_reports',
      'warn_members',
      'timeout_members',
      'kick_members',
      'ban_members',
      'manage_invites',
      'view_audit_log',
    ],
  },
  admin: {
    name: 'admin',
    rank: 30,
    permissions: [
      'view_reports',
      'resolve_reports',
      'warn_members',
      'timeout_members',
      'kick_members',
      'ban_members',
      'manage_roles',
      'manage_invites',
      'manage_registration',
      'manage_retention',
      'manage_storage',
      'manage_stream_quality',
      'view_audit_log',
    ],
  },
  owner: {
    name: 'owner',
    rank: 40,
    permissions: [
      'view_reports',
      'resolve_reports',
      'warn_members',
      'timeout_members',
      'kick_members',
      'ban_members',
      'manage_roles',
      'manage_invites',
      'manage_registration',
      'manage_retention',
      'manage_storage',
      'manage_stream_quality',
      'view_audit_log',
    ],
  },
};

export interface ModerationActor {
  userId: string;
  roles: readonly RoleName[];
}

export interface ModerationTarget {
  userId: string;
  highestRole: RoleName;
}

export function getHighestRole(roles: readonly RoleName[]): RoleName {
  return roles.reduce<RoleName>(
    (highest, role) =>
      ROLE_DEFINITIONS[role].rank > ROLE_DEFINITIONS[highest].rank ? role : highest,
    'member',
  );
}

export function hasPermission(actor: ModerationActor, permission: ModerationPermission): boolean {
  return actor.roles.some((role) => ROLE_DEFINITIONS[role].permissions.includes(permission));
}

export function canAssignRole(
  actor: ModerationActor,
  target: ModerationTarget,
  roleToAssign: RoleName,
): boolean {
  if (!hasPermission(actor, 'manage_roles') || actor.userId === target.userId) {
    return false;
  }

  const actorRank = ROLE_DEFINITIONS[getHighestRole(actor.roles)].rank;
  return (
    ROLE_DEFINITIONS[target.highestRole].rank < actorRank &&
    ROLE_DEFINITIONS[roleToAssign].rank < actorRank
  );
}

export type ModerationActionName = 'warn' | 'timeout' | 'kick' | 'ban' | 'unban' | 'resolve-report';

const ACTION_PERMISSIONS: Readonly<Record<ModerationActionName, ModerationPermission>> = {
  warn: 'warn_members',
  timeout: 'timeout_members',
  kick: 'kick_members',
  ban: 'ban_members',
  unban: 'ban_members',
  'resolve-report': 'resolve_reports',
};

export function canPerformModerationAction(
  actor: ModerationActor,
  action: ModerationActionName,
  target?: ModerationTarget,
): boolean {
  if (!hasPermission(actor, ACTION_PERMISSIONS[action])) {
    return false;
  }

  if (action === 'resolve-report') {
    return true;
  }

  if (!target || actor.userId === target.userId) {
    return false;
  }

  const actorRank = ROLE_DEFINITIONS[getHighestRole(actor.roles)].rank;
  return ROLE_DEFINITIONS[target.highestRole].rank < actorRank;
}

export type ModerationReasonCode =
  'spam' | 'harassment' | 'hate' | 'sexual-content' | 'violence' | 'evasion' | 'other';

export type ModerationEnforcementAction = 'warn' | 'timeout' | 'kick' | 'ban' | 'unban';

export const DEFAULT_MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

export interface CreateModerationActionInput {
  id: string;
  communityId: string;
  actor: ModerationActor;
  target: ModerationTarget;
  action: ModerationEnforcementAction;
  reasonCode: ModerationReasonCode;
  durationMs?: number;
  createdAt?: string;
}

export interface ModerationActionRecord {
  id: string;
  communityId: string;
  actorUserId: string;
  targetUserId: string;
  action: ModerationEnforcementAction;
  reasonCode: ModerationReasonCode;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export function createModerationAction(input: CreateModerationActionInput): ModerationActionRecord {
  if (!input.id.trim() || !input.communityId.trim()) {
    throw new Error('Moderation action ID and community ID are required.');
  }

  if (!canPerformModerationAction(input.actor, input.action, input.target)) {
    throw new Error('The actor is not allowed to perform this moderation action.');
  }

  const durationMs = input.durationMs;

  if (input.action === 'timeout') {
    if (!isPositiveInteger(durationMs) || durationMs > DEFAULT_MAX_TIMEOUT_MS) {
      throw new Error('Timeout duration must be a positive value within the configured maximum.');
    }
  } else if (durationMs !== undefined) {
    if (!isPositiveInteger(durationMs)) {
      throw new Error('Moderation duration must be a positive integer.');
    }
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);

  if (!Number.isFinite(createdAtMs)) {
    throw new Error('Moderation action timestamp is invalid.');
  }

  return {
    id: input.id.trim(),
    communityId: input.communityId.trim(),
    actorUserId: input.actor.userId,
    targetUserId: input.target.userId,
    action: input.action,
    reasonCode: input.reasonCode,
    createdAt: new Date(createdAtMs).toISOString(),
    ...(durationMs ? { expiresAt: new Date(createdAtMs + durationMs).toISOString() } : {}),
  };
}

export function isModerationRestrictionActive(
  record: ModerationActionRecord,
  atMs = Date.now(),
): boolean {
  if (record.revokedAt || (record.action !== 'timeout' && record.action !== 'ban')) {
    return false;
  }

  if (!record.expiresAt) {
    return true;
  }

  const expiresAtMs = Date.parse(record.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > atMs;
}

export function revokeModerationAction(
  record: ModerationActionRecord,
  revokedAt = new Date().toISOString(),
): ModerationActionRecord {
  if (!Number.isFinite(Date.parse(revokedAt))) {
    throw new Error('Revocation timestamp is invalid.');
  }

  return { ...record, revokedAt: new Date(revokedAt).toISOString() };
}

export type ReportSource = 'user-submitted' | 'client-assisted-e2ee';
export type ModerationReportStatus = 'open' | 'triaged' | 'resolved' | 'dismissed';

export type ReportValidationCode =
  | 'invalid-report'
  | 'invalid-description'
  | 'missing-room'
  | 'missing-event'
  | 'disclosure-not-confirmed'
  | 'encrypted-evidence-source-required';

export interface ReportValidationIssue {
  code: ReportValidationCode;
  message: string;
}

export interface CreateModerationReportInput {
  id: string;
  reporterId: string;
  source: ReportSource;
  reasonCode: ModerationReasonCode;
  description: string;
  communityId?: string;
  roomId?: string;
  targetUserId?: string;
  senderId?: string;
  eventIds: readonly string[];
  selectedContent?: string;
  surroundingContext?: string;
  attachmentAssetIds?: readonly string[];
  disclosureConfirmed?: boolean;
  createdAt?: string;
}

export interface ReportEvidence {
  roomId?: string;
  senderId?: string;
  eventIds: readonly string[];
  selectedContent?: string;
  surroundingContext?: string;
  attachmentAssetIds: readonly string[];
  disclosureConfirmed: boolean;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  source: ReportSource;
  reasonCode: ModerationReasonCode;
  description: string;
  communityId?: string;
  targetUserId?: string;
  evidence?: ReportEvidence;
  status: ModerationReportStatus;
  createdAt: string;
}

export type ModerationReportResult =
  { ok: true; report: ModerationReport } | { ok: false; issues: ReportValidationIssue[] };

function normalizeStringList(values: readonly string[] | undefined, limit: number): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

export function createModerationReport(input: CreateModerationReportInput): ModerationReportResult {
  const issues: ReportValidationIssue[] = [];
  const description = input.description.normalize('NFKC').trim();
  const eventIds = normalizeStringList(input.eventIds, 50);
  const attachmentAssetIds = normalizeStringList(input.attachmentAssetIds, 20);
  const selectedContent = input.selectedContent?.normalize('NFKC').trim();
  const surroundingContext = input.surroundingContext?.normalize('NFKC').trim();
  const hasClientSelectedEvidence = Boolean(
    selectedContent || surroundingContext || attachmentAssetIds.length,
  );

  if (!input.id.trim() || !input.reporterId.trim()) {
    issues.push({ code: 'invalid-report', message: 'Report ID and reporter ID are required.' });
  }

  if (!description || description.length > 2_000) {
    issues.push({
      code: 'invalid-description',
      message: 'Report description must contain 1 to 2,000 characters.',
    });
  }

  if (input.source === 'client-assisted-e2ee' && !input.roomId?.trim()) {
    issues.push({
      code: 'missing-room',
      message: 'Client-assisted encrypted reports require a room ID.',
    });
  }

  if (input.source === 'client-assisted-e2ee' && eventIds.length === 0) {
    issues.push({
      code: 'missing-event',
      message: 'Client-assisted encrypted reports require an event ID.',
    });
  }

  if (hasClientSelectedEvidence && input.source !== 'client-assisted-e2ee') {
    issues.push({
      code: 'encrypted-evidence-source-required',
      message: 'Selected decrypted content must use the client-assisted report source.',
    });
  }

  if (hasClientSelectedEvidence && input.disclosureConfirmed !== true) {
    issues.push({
      code: 'disclosure-not-confirmed',
      message: 'The reporter must confirm exactly what decrypted evidence will be disclosed.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);

  if (!Number.isFinite(createdAtMs)) {
    return {
      ok: false,
      issues: [{ code: 'invalid-report', message: 'Report timestamp is invalid.' }],
    };
  }

  const evidence: ReportEvidence | undefined =
    input.source === 'client-assisted-e2ee'
      ? {
          ...(input.roomId?.trim() ? { roomId: input.roomId.trim() } : {}),
          ...(input.senderId?.trim() ? { senderId: input.senderId.trim() } : {}),
          eventIds,
          ...(selectedContent ? { selectedContent } : {}),
          ...(surroundingContext ? { surroundingContext } : {}),
          attachmentAssetIds,
          disclosureConfirmed: input.disclosureConfirmed === true,
        }
      : undefined;

  return {
    ok: true,
    report: {
      id: input.id.trim(),
      reporterId: input.reporterId.trim(),
      source: input.source,
      reasonCode: input.reasonCode,
      description,
      ...(input.communityId?.trim() ? { communityId: input.communityId.trim() } : {}),
      ...(input.targetUserId?.trim() ? { targetUserId: input.targetUserId.trim() } : {}),
      ...(evidence ? { evidence } : {}),
      status: 'open',
      createdAt: new Date(createdAtMs).toISOString(),
    },
  };
}

export type AuditAction =
  | 'report-created'
  | 'report-resolved'
  | 'moderation-action'
  | 'role-assigned'
  | 'role-removed'
  | 'invite-policy-updated'
  | 'registration-policy-updated'
  | 'retention-policy-updated'
  | 'storage-policy-updated'
  | 'stream-quality-policy-updated';

export interface AuditEventInput {
  id: string;
  communityId: string;
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string;
  createdAt?: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface AuditEvent {
  id: string;
  communityId: string;
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string;
  createdAt: string;
  metadata: Readonly<Record<string, string | number | boolean>>;
}

const UNSAFE_AUDIT_KEY = /(content|body|token|secret|password|plaintext|ciphertext)/i;

function assertSafeAuditMetadata(
  metadata: Readonly<Record<string, string | number | boolean>>,
): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (UNSAFE_AUDIT_KEY.test(key)) {
      throw new Error(`Audit metadata key ${key} is not allowed.`);
    }

    if (typeof value === 'string' && value.length > 256) {
      throw new Error('Audit metadata strings must be at most 256 characters.');
    }
  }
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  if (!input.id.trim() || !input.communityId.trim() || !input.actorUserId.trim()) {
    throw new Error('Audit event ID, community ID, and actor ID are required.');
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);
  const metadata = input.metadata ?? {};

  if (!Number.isFinite(createdAtMs)) {
    throw new Error('Audit event timestamp is invalid.');
  }

  assertSafeAuditMetadata(metadata);

  return {
    id: input.id.trim(),
    communityId: input.communityId.trim(),
    actorUserId: input.actorUserId.trim(),
    action: input.action,
    ...(input.targetUserId?.trim() ? { targetUserId: input.targetUserId.trim() } : {}),
    createdAt: new Date(createdAtMs).toISOString(),
    metadata: { ...metadata },
  };
}

export class InMemoryAuditLog {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    if (this.events.some(({ id }) => id === event.id)) {
      throw new Error(`Audit event ${event.id} already exists.`);
    }

    this.events.push(structuredClone(event));
  }

  list(communityId: string, limit = 100): AuditEvent[] {
    const boundedLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
    return this.events
      .filter((event) => event.communityId === communityId)
      .slice(-boundedLimit)
      .reverse()
      .map((event) => structuredClone(event));
  }
}

export interface InvitePolicy {
  enabled: boolean;
  minimumRole: RoleName;
  maxActiveInvitesPerUser: number;
  lifetimeMs: number;
  maxUses: number;
}

export const DEFAULT_INVITE_POLICY: InvitePolicy = {
  enabled: true,
  minimumRole: 'moderator',
  maxActiveInvitesPerUser: 10,
  lifetimeMs: 7 * 24 * 60 * 60 * 1000,
  maxUses: 25,
};

export interface InviteRecord {
  id: string;
  issuerUserId: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  revokedAt?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export function canCreateInvite(
  actor: ModerationActor,
  policy: InvitePolicy,
  activeInvitesForUser: number,
): PolicyDecision {
  if (!policy.enabled) {
    return { allowed: false, reason: 'invites-disabled' };
  }

  if (
    ROLE_DEFINITIONS[getHighestRole(actor.roles)].rank < ROLE_DEFINITIONS[policy.minimumRole].rank
  ) {
    return { allowed: false, reason: 'insufficient-role' };
  }

  if (!hasPermission(actor, 'manage_invites')) {
    return { allowed: false, reason: 'missing-permission' };
  }

  if (
    !Number.isInteger(activeInvitesForUser) ||
    activeInvitesForUser >= policy.maxActiveInvitesPerUser
  ) {
    return { allowed: false, reason: 'invite-limit-reached' };
  }

  return { allowed: true };
}

export function canUseInvite(invite: InviteRecord, atMs = Date.now()): PolicyDecision {
  if (invite.revokedAt) {
    return { allowed: false, reason: 'invite-revoked' };
  }

  const expiresAtMs = Date.parse(invite.expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= atMs) {
    return { allowed: false, reason: 'invite-expired' };
  }

  if (
    !Number.isInteger(invite.uses) ||
    !Number.isInteger(invite.maxUses) ||
    invite.uses >= invite.maxUses
  ) {
    return { allowed: false, reason: 'invite-uses-exhausted' };
  }

  return { allowed: true };
}

export interface RegistrationPolicy {
  enabled: boolean;
  requireInvite: boolean;
  allowGuestRegistration: boolean;
  requireEmailVerification: boolean;
  allowedEmailDomains: readonly string[];
  maxAttemptsPerWindow: number;
}

export const DEFAULT_REGISTRATION_POLICY: RegistrationPolicy = {
  enabled: true,
  requireInvite: false,
  allowGuestRegistration: false,
  requireEmailVerification: false,
  allowedEmailDomains: [],
  maxAttemptsPerWindow: 10,
};

export interface RegistrationAttempt {
  hasValidInvite: boolean;
  guest: boolean;
  email?: string;
  emailVerified: boolean;
  recentAttempts: number;
}

export function canRegister(
  attempt: RegistrationAttempt,
  policy: RegistrationPolicy,
): PolicyDecision {
  if (!policy.enabled) {
    return { allowed: false, reason: 'registration-disabled' };
  }

  if (attempt.recentAttempts >= policy.maxAttemptsPerWindow) {
    return { allowed: false, reason: 'registration-rate-limit' };
  }

  if (policy.requireInvite && !attempt.hasValidInvite) {
    return { allowed: false, reason: 'invite-required' };
  }

  if (attempt.guest && !policy.allowGuestRegistration) {
    return { allowed: false, reason: 'guest-registration-disabled' };
  }

  if (policy.requireEmailVerification && !attempt.emailVerified) {
    return { allowed: false, reason: 'email-verification-required' };
  }

  if (policy.allowedEmailDomains.length > 0) {
    const domain = attempt.email?.trim().toLowerCase().split('@').pop();

    if (
      !domain ||
      !policy.allowedEmailDomains.map((allowed) => allowed.toLowerCase()).includes(domain)
    ) {
      return { allowed: false, reason: 'email-domain-not-allowed' };
    }
  }

  return { allowed: true };
}

export type RetentionSubject =
  'message-events' | 'media-objects' | 'audit-events' | 'report-records' | 'voice-metadata';

export interface RetentionPolicy {
  messageEventsMaxAgeMs: number | null;
  mediaObjectsMaxAgeMs: number | null;
  auditEventsMaxAgeMs: number | null;
  reportRecordsMaxAgeMs: number | null;
  voiceMetadataMaxAgeMs: number | null;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  messageEventsMaxAgeMs: null,
  mediaObjectsMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  auditEventsMaxAgeMs: 365 * 24 * 60 * 60 * 1000,
  reportRecordsMaxAgeMs: 180 * 24 * 60 * 60 * 1000,
  voiceMetadataMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
};

export interface RetentionCheckInput {
  subject: RetentionSubject;
  createdAt: string;
  legalHold?: boolean;
  activeModerationCase?: boolean;
}

export function isRetentionExpired(
  input: RetentionCheckInput,
  atMs: number,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): boolean {
  if (input.legalHold || input.activeModerationCase) {
    return false;
  }

  const createdAtMs = Date.parse(input.createdAt);
  const maxAgeBySubject: Readonly<Record<RetentionSubject, number | null>> = {
    'message-events': policy.messageEventsMaxAgeMs,
    'media-objects': policy.mediaObjectsMaxAgeMs,
    'audit-events': policy.auditEventsMaxAgeMs,
    'report-records': policy.reportRecordsMaxAgeMs,
    'voice-metadata': policy.voiceMetadataMaxAgeMs,
  };
  const maxAgeMs = maxAgeBySubject[input.subject];

  return (
    Number.isFinite(createdAtMs) &&
    Number.isInteger(atMs) &&
    atMs >= createdAtMs &&
    maxAgeMs !== null &&
    Number.isInteger(maxAgeMs) &&
    maxAgeMs >= 0 &&
    atMs - createdAtMs >= maxAgeMs
  );
}

export type StorageProcessingMode = 'client-encrypted' | 'server-processed';
export type StorageStatus = 'ok' | 'warning' | 'exceeded';

export interface StoragePolicy {
  totalQuotaBytes: number;
  perUserQuotaBytes: number;
  warningThresholdRatio: number;
  maxObjectSizeBytes: number;
  preserveOriginals: boolean;
  allowServerProcessing: boolean;
}

export const DEFAULT_STORAGE_POLICY: StoragePolicy = {
  totalQuotaBytes: 10 * 1024 * 1024 * 1024,
  perUserQuotaBytes: 2 * 1024 * 1024 * 1024,
  warningThresholdRatio: 0.8,
  maxObjectSizeBytes: 200 * 1024 * 1024,
  preserveOriginals: true,
  allowServerProcessing: true,
};

export interface StorageUsageInput {
  totalUsedBytes: number;
  userUsedBytes: number;
  requestedBytes: number;
}

export interface StorageDecision {
  allowed: boolean;
  status: StorageStatus;
  totalRemainingBytes: number;
  userRemainingBytes: number;
  reason?: 'invalid-request' | 'object-too-large' | 'total-quota-exceeded' | 'user-quota-exceeded';
}

export function evaluateStorageUsage(
  input: StorageUsageInput,
  policy: StoragePolicy = DEFAULT_STORAGE_POLICY,
): StorageDecision {
  const valuesAreValid = [input.totalUsedBytes, input.userUsedBytes, input.requestedBytes].every(
    (value) => Number.isInteger(value) && value >= 0,
  );

  if (!valuesAreValid || input.requestedBytes <= 0) {
    return {
      allowed: false,
      status: 'exceeded',
      totalRemainingBytes: 0,
      userRemainingBytes: 0,
      reason: 'invalid-request',
    };
  }

  if (input.requestedBytes > policy.maxObjectSizeBytes) {
    return {
      allowed: false,
      status: 'exceeded',
      totalRemainingBytes: Math.max(0, policy.totalQuotaBytes - input.totalUsedBytes),
      userRemainingBytes: Math.max(0, policy.perUserQuotaBytes - input.userUsedBytes),
      reason: 'object-too-large',
    };
  }

  const projectedTotal = input.totalUsedBytes + input.requestedBytes;
  const projectedUser = input.userUsedBytes + input.requestedBytes;
  const totalRemainingBytes = Math.max(0, policy.totalQuotaBytes - projectedTotal);
  const userRemainingBytes = Math.max(0, policy.perUserQuotaBytes - projectedUser);

  if (projectedTotal > policy.totalQuotaBytes) {
    return {
      allowed: false,
      status: 'exceeded',
      totalRemainingBytes,
      userRemainingBytes,
      reason: 'total-quota-exceeded',
    };
  }

  if (projectedUser > policy.perUserQuotaBytes) {
    return {
      allowed: false,
      status: 'exceeded',
      totalRemainingBytes,
      userRemainingBytes,
      reason: 'user-quota-exceeded',
    };
  }

  const warningRatio = Math.min(1, Math.max(0, policy.warningThresholdRatio));
  const status: StorageStatus =
    projectedTotal / policy.totalQuotaBytes >= warningRatio ||
    projectedUser / policy.perUserQuotaBytes >= warningRatio
      ? 'warning'
      : 'ok';

  return { allowed: true, status, totalRemainingBytes, userRemainingBytes };
}

export function canUseStorageProcessing(
  mode: StorageProcessingMode,
  policy: StoragePolicy = DEFAULT_STORAGE_POLICY,
): boolean {
  return mode === 'client-encrypted' || policy.allowServerProcessing;
}

export type StreamQualityMode = 'data-saver' | 'balanced' | 'smooth' | 'sharp' | 'ultra';

export interface StreamQualityProfile {
  mode: StreamQualityMode;
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
}

export const STREAM_QUALITY_PROFILES: Readonly<Record<StreamQualityMode, StreamQualityProfile>> = {
  'data-saver': { mode: 'data-saver', width: 1280, height: 720, fps: 30, bitrateKbps: 1_500 },
  balanced: { mode: 'balanced', width: 1920, height: 1080, fps: 30, bitrateKbps: 3_500 },
  smooth: { mode: 'smooth', width: 1920, height: 1080, fps: 60, bitrateKbps: 5_000 },
  sharp: { mode: 'sharp', width: 2560, height: 1440, fps: 30, bitrateKbps: 7_000 },
  ultra: { mode: 'ultra', width: 3840, height: 2160, fps: 60, bitrateKbps: 16_000 },
};

export const STREAM_QUALITY_ORDER: readonly StreamQualityMode[] = [
  'data-saver',
  'balanced',
  'smooth',
  'sharp',
  'ultra',
];

export interface StreamQualityPolicy {
  enabledModes: readonly StreamQualityMode[];
  maxWidth: number;
  maxHeight: number;
  maxFps: number;
  maxBitrateKbps: number;
  maxParticipants: number;
}

export const DEFAULT_STREAM_QUALITY_POLICY: StreamQualityPolicy = {
  enabledModes: ['data-saver', 'balanced'],
  maxWidth: 1920,
  maxHeight: 1080,
  maxFps: 30,
  maxBitrateKbps: 3_500,
  maxParticipants: 25,
};

export interface StreamQualityDecision {
  selectedMode: StreamQualityMode | null;
  profile: StreamQualityProfile | null;
  fellBack: boolean;
  reason?: 'no-compatible-mode';
}

function profileFitsPolicy(profile: StreamQualityProfile, policy: StreamQualityPolicy): boolean {
  return (
    profile.width <= policy.maxWidth &&
    profile.height <= policy.maxHeight &&
    profile.fps <= policy.maxFps &&
    profile.bitrateKbps <= policy.maxBitrateKbps
  );
}

export function resolveStreamQuality(
  requestedMode: StreamQualityMode,
  policy: StreamQualityPolicy = DEFAULT_STREAM_QUALITY_POLICY,
): StreamQualityDecision {
  const compatibleModes = STREAM_QUALITY_ORDER.filter(
    (mode) =>
      policy.enabledModes.includes(mode) &&
      profileFitsPolicy(STREAM_QUALITY_PROFILES[mode], policy),
  );
  const requestedIndex = STREAM_QUALITY_ORDER.indexOf(requestedMode);

  if (compatibleModes.length === 0) {
    return { selectedMode: null, profile: null, fellBack: true, reason: 'no-compatible-mode' };
  }

  const lowerOrEqualModes = compatibleModes.filter(
    (mode) => STREAM_QUALITY_ORDER.indexOf(mode) <= requestedIndex,
  );
  const selectedMode = lowerOrEqualModes.at(-1) ?? compatibleModes[0];

  if (!selectedMode) {
    return { selectedMode: null, profile: null, fellBack: true, reason: 'no-compatible-mode' };
  }

  return {
    selectedMode,
    profile: STREAM_QUALITY_PROFILES[selectedMode],
    fellBack: selectedMode !== requestedMode,
  };
}

export function canJoinStream(
  currentParticipantCount: number,
  policy: StreamQualityPolicy = DEFAULT_STREAM_QUALITY_POLICY,
): PolicyDecision {
  if (!Number.isInteger(currentParticipantCount) || currentParticipantCount < 0) {
    return { allowed: false, reason: 'invalid-participant-count' };
  }

  return currentParticipantCount < policy.maxParticipants
    ? { allowed: true }
    : { allowed: false, reason: 'participant-limit-reached' };
}
