import { afterEach, describe, expect, it, vi } from 'vitest';

import { inviteFriendToGroup } from './groups.js';

describe('group invitations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('invites an accepted friend with the current group definition', async () => {
    const group = {
      id: 'game-night-1',
      name: 'Game Night',
      description: 'Play together.',
      icon: 'chat' as const,
      channels: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ group }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(inviteFriendToGroup('credential', 'friend-1', group)).resolves.toEqual(group);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/groups/invite',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      credential: 'credential',
      friendId: 'friend-1',
      group,
    });
  });
});
