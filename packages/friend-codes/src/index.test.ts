import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOOKUP_LIMIT,
  FriendCodeService,
  InMemoryFriendCodeStore,
  createFriendInvite,
  digestFriendCode,
  formatFriendCode,
  normalizeFriendCode,
  parseFriendInviteUrl,
} from './index.js';

const secret = 'phase-3-test-secret-with-at-least-32-bytes';

function createService(now = () => 1_000): FriendCodeService {
  return new FriendCodeService(new InMemoryFriendCodeStore(), { now, secret });
}

describe('friend-code primitives', () => {
  it('normalizes grouped and case-insensitive codes', () => {
    expect(normalizeFriendCode('abc-def')).toBe('ABCDEF');
    expect(formatFriendCode('ABCDEF')).toBe('ABC-DEF');
  });

  it('rejects ambiguous or malformed characters', () => {
    expect(() => normalizeFriendCode('ABC-IJK')).toThrow();
    expect(() => normalizeFriendCode('ABC-DE')).toThrow();
  });

  it('uses a keyed digest and rejects short secrets', () => {
    expect(digestFriendCode(secret, 'ABCDEF')).not.toContain('ABCDEF');
    expect(() => digestFriendCode('too-short', 'ABCDEF')).toThrow(
      'Friend-code secret must contain at least 32 bytes.',
    );
  });

  it('creates and parses an invitation URL that carries only the friend code', () => {
    const invite = createFriendInvite('https://scuttlebutt.example', 'abc-def');

    expect(invite).toEqual({
      displayCode: 'ABC-DEF',
      url: 'https://scuttlebutt.example/invite/friend?code=ABC-DEF',
    });
    expect(parseFriendInviteUrl(invite.url)).toBe('ABC-DEF');
    expect(() => parseFriendInviteUrl('https://scuttlebutt.example/invite/friend')).toThrow(
      'Invalid friend invite link.',
    );
  });
});

describe('friend-code and contact service', () => {
  it('issues, regenerates, and revokes codes without returning identities on lookup', () => {
    const store = new InMemoryFriendCodeStore();
    const service = new FriendCodeService(store, { secret });
    const aliceCode = service.issueCode({
      matrixUserId: '@alice:localhost',
      principalId: 'alice',
    });
    const bobCode = service.issueCode({
      matrixUserId: '@bob:localhost',
      principalId: 'bob',
    });

    const submission = service.requestContactByCode('alice', bobCode.displayCode);
    expect(submission).toMatchObject({
      acceptedForProcessing: true,
      rateLimited: false,
    });
    expect(JSON.stringify(submission)).not.toContain('@bob:localhost');
    expect(service.listPendingRequests('bob')).toEqual([
      {
        createdAt: expect.any(Number),
        requestId: submission.requestId,
        status: 'pending',
      },
    ]);
    expect(service.listPendingRequests('alice')).toHaveLength(0);
    service.declineContact('bob', submission.requestId);

    const pending = service.requestContactByCode('bob', aliceCode.displayCode);
    expect(service.listPendingRequests('alice')).toEqual([
      {
        createdAt: expect.any(Number),
        requestId: pending.requestId,
        status: 'pending',
      },
    ]);

    const accepted = service.acceptContact('alice', pending.requestId);
    expect(accepted.peerMatrixUserId).toBe('@bob:localhost');
    expect(service.listContacts('bob')[0]).toMatchObject({
      peerMatrixUserId: '@alice:localhost',
    });

    const regenerated = service.issueCode({
      matrixUserId: '@alice:localhost',
      principalId: 'alice',
    });
    expect(service.requestContactByCode('bob', aliceCode.displayCode).requestId).not.toBe('');
    expect(regenerated.displayCode).not.toBe(aliceCode.displayCode);

    service.revokeCode('bob');
    const revoked = service.requestContactByCode('alice', bobCode.displayCode);
    expect(revoked).toMatchObject({
      acceptedForProcessing: true,
      rateLimited: false,
    });
  });

  it('blocks contact requests in both directions and hides existing contacts', () => {
    const service = createService();
    const aliceCode = service.issueCode({
      matrixUserId: '@alice:localhost',
      principalId: 'alice',
    });
    const bobCode = service.issueCode({
      matrixUserId: '@bob:localhost',
      principalId: 'bob',
    });
    const pending = service.requestContactByCode('bob', aliceCode.displayCode);

    service.acceptContact('alice', pending.requestId);
    service.blockPrincipal('alice', 'bob');
    expect(service.listContacts('alice')).toEqual([]);
    expect(service.listContacts('bob')).toEqual([]);
    expect(service.requestContactByCode('bob', aliceCode.displayCode)).toMatchObject({
      acceptedForProcessing: true,
      rateLimited: false,
    });
    expect(service.requestContactByCode('alice', bobCode.displayCode)).toMatchObject({
      acceptedForProcessing: true,
      rateLimited: false,
    });
  });

  it('rate limits invalid and valid lookup attempts per requester', () => {
    let now = 1_000;
    const service = createService(() => now);

    for (let attempt = 0; attempt < DEFAULT_LOOKUP_LIMIT; attempt += 1) {
      expect(service.requestContactByCode('scraper', 'not-a-code').rateLimited).toBe(false);
    }

    const limited = service.requestContactByCode('scraper', 'not-a-code');
    expect(limited.rateLimited).toBe(true);
    expect(limited.retryAfterMs).toBeGreaterThan(0);

    now += 60_001;
    expect(service.requestContactByCode('scraper', 'not-a-code').rateLimited).toBe(false);
  });
});
