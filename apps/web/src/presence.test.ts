import { describe, expect, it } from 'vitest';

import {
  normalizePresenceIndicatorStatus,
  normalizePresenceStatus,
  presenceLabel,
  publicPresenceStatus,
} from './presence.js';

describe('presence states', () => {
  it('normalizes unknown account states to Online', () => {
    expect(normalizePresenceStatus('unavailable')).toBe('online');
    expect(normalizePresenceStatus('dnd')).toBe('dnd');
  });

  it('projects Invisible as Offline to other users', () => {
    expect(publicPresenceStatus('invisible')).toBe('offline');
    expect(normalizePresenceIndicatorStatus('away')).toBe('idle');
  });

  it('uses Discord-style labels for the visible status groups', () => {
    expect(presenceLabel('dnd')).toBe('Do Not Disturb');
    expect(presenceLabel('offline')).toBe('Offline');
  });
});
