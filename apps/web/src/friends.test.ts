import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadFriendState, respondToFriendRequest, sendFriendRequest } from './friends.js';

afterEach(() => vi.unstubAllGlobals());

describe('friend API client', () => {
  it('loads real friend profiles and the account friend code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          friendCode: 'ABC234',
          friends: [{ id: 'friend-1', name: 'Taylor', avatarUrl: '/taylor.png', bio: '', tags: [] }],
          incoming: [],
          outgoing: [],
        }),
      })),
    );

    const state = await loadFriendState('credential');
    expect(state.friendCode).toBe('ABC234');
    expect(state.friends[0]).toMatchObject({ name: 'Taylor', avatarUrl: '/taylor.png' });
  });

  it('sends and responds to requests through authenticated endpoints', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ saved: true, recipient: { id: 'friend-1', name: 'Taylor' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await sendFriendRequest('credential', 'ABC234');
    await respondToFriendRequest('credential', 'friend-1', 'accept');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/friends/request',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/friends/respond',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
