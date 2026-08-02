import { describe, expect, it } from 'vitest';

import {
  MATRIX_ENCRYPTION_ALGORITHM,
  createEncryptedRoomOptions,
  normalizeHomeserverUrl,
} from './index.js';

describe('Matrix client boundary', () => {
  it('normalizes a homeserver URL without changing its origin', () => {
    expect(normalizeHomeserverUrl(' http://localhost:8008/// ')).toBe('http://localhost:8008');
  });

  it('creates a direct room with Matrix encryption enabled in initial state', () => {
    expect(createEncryptedRoomOptions({ inviteeUserId: '@bob:localhost' })).toEqual(
      expect.objectContaining({
        initial_state: [
          {
            content: { algorithm: MATRIX_ENCRYPTION_ALGORITHM },
            state_key: '',
            type: 'm.room.encryption',
          },
        ],
        invite: ['@bob:localhost'],
        is_direct: true,
      }),
    );
  });

  it('rejects an empty homeserver URL', () => {
    expect(() => normalizeHomeserverUrl(' / ')).toThrow('A Matrix homeserver URL is required.');
  });
});
