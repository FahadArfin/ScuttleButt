export const PRESENCE_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;

export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];
export type PresenceIndicatorStatus = PresenceStatus | 'offline';

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
};

export const PRESENCE_DESCRIPTIONS: Record<PresenceStatus, string> = {
  online: 'You are available to chat',
  idle: 'You will be marked as away',
  dnd: 'You will not receive desktop notifications',
  invisible: 'You will appear offline',
};

export function normalizePresenceStatus(value: unknown): PresenceStatus {
  return typeof value === 'string' && PRESENCE_STATUSES.includes(value as PresenceStatus)
    ? (value as PresenceStatus)
    : 'online';
}

export function publicPresenceStatus(status: PresenceStatus): PresenceIndicatorStatus {
  return status === 'invisible' ? 'offline' : status;
}

export function normalizePresenceIndicatorStatus(value: unknown): PresenceIndicatorStatus {
  if (value === 'away') return 'idle';
  if (value === 'offline' || value === 'online' || value === 'idle' || value === 'dnd') {
    return value;
  }
  return 'offline';
}

export function presenceLabel(status: PresenceStatus | PresenceIndicatorStatus): string {
  if (status === 'offline') return 'Offline';
  return PRESENCE_LABELS[status];
}
