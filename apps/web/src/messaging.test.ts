import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDemoMessagingRepository,
  createSyncedMessagingRepository,
  shouldGroupMessage,
} from './messaging.js';

afterEach(() => vi.unstubAllGlobals());

describe('local messaging repository', () => {
  it('groups consecutive messages from the same sender for ten minutes', () => {
    const previous = {
      senderId: 'user-1',
      createdAt: '2026-08-04T00:00:00.000Z',
    } as Parameters<typeof shouldGroupMessage>[0];
    const withinWindow = {
      senderId: 'user-1',
      createdAt: '2026-08-04T00:10:00.000Z',
    } as Parameters<typeof shouldGroupMessage>[1];
    const afterWindow = {
      senderId: 'user-1',
      createdAt: '2026-08-04T00:10:01.000Z',
    } as Parameters<typeof shouldGroupMessage>[1];
    const differentSender = { ...withinWindow, senderId: 'user-2' };

    expect(shouldGroupMessage(previous, withinWindow)).toBe(true);
    expect(shouldGroupMessage(previous, afterWindow)).toBe(false);
    expect(shouldGroupMessage(previous, differentSender)).toBe(false);
  });

  it('creates a conversation that can immediately receive messages', async () => {
    const repository = createDemoMessagingRepository();
    await repository.createConversation({
      id: 'new-room',
      title: 'new-room',
      kind: 'channel',
      avatarLabel: '#',
      presence: 'Local text channel',
      preview: 'Start the conversation.',
      updatedAt: 'Now',
      unreadCount: 0,
      encrypted: true,
      members: 3,
      channelKind: 'text',
    });

    await repository.sendMessage('new-room', 'First message');

    expect((await repository.getConversations()).some(({ id }) => id === 'new-room')).toBe(true);
    expect((await repository.getMessages('new-room'))[0]?.body).toBe('First message');
  });

  it('sends replies and preserves attachment metadata', async () => {
    const repository = createDemoMessagingRepository();
    const originalMessages = await repository.getMessages('jordan');
    const reply = await repository.sendMessage('jordan', 'Here is the draft.', {
      attachments: [{ id: 'draft', name: 'draft.txt', size: 12, mimeType: 'text/plain' }],
      replyTo: {
        id: originalMessages[0]?.id ?? 'missing',
        author: 'Jordan Lee',
        body: 'I pulled together the Phase 4 notes.',
      },
    });

    expect(reply.own).toBe(true);
    expect(reply.replyTo?.author).toBe('Jordan Lee');
    expect(reply.attachments[0]?.name).toBe('draft.txt');
  });

  it('edits, reacts to, deletes, and marks conversations as read', async () => {
    const repository = createDemoMessagingRepository();
    await repository.createConversation({
      id: 'lounge',
      title: 'Lounge',
      kind: 'channel',
      avatarLabel: '#',
      presence: 'Local text channel',
      preview: 'Start the conversation.',
      updatedAt: 'Now',
      unreadCount: 2,
      encrypted: true,
      members: 1,
      channelKind: 'text',
    });
    const sent = await repository.sendMessage('lounge', 'Temporary note');

    await repository.editMessage('lounge', sent.id, 'Updated note');
    await repository.reactToMessage('lounge', sent.id, '✨');

    const edited = (await repository.getMessages('lounge')).find(({ id }) => id === sent.id);
    expect(edited?.body).toBe('Updated note');
    expect(edited?.edited).toBe(true);
    expect(edited?.reactions['✨']).toBe(1);

    await repository.deleteMessage('lounge', sent.id);
    expect((await repository.getMessages('lounge')).some(({ id }) => id === sent.id)).toBe(false);

    await repository.markRead('lounge');
    expect(
      (await repository.getConversations()).find(({ id }) => id === 'lounge')?.unreadCount,
    ).toBe(0);
  });

  it('loads cloud messages and identifies the signed-in user', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        messages: [
          {
            id: 'message-1',
            senderId: 'user-2',
            senderName: 'Friend',
            senderInitials: 'FR',
            senderAvatar: 'https://example.com/friend.png',
            body: 'Synced message',
            sentAt: 'Now',
            status: 'sent',
            edited: false,
            own: true,
            attachments: [],
            reactions: {},
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const repository = createSyncedMessagingRepository('credential', {
      id: 'user-1',
      name: 'Current User',
    });

    const messages = await repository.getMessages('shared-general');

    expect(messages[0]).toMatchObject({ body: 'Synced message', own: false });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync/messages/list',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
