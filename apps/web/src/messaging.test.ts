import { describe, expect, it } from 'vitest';

import { createDemoMessagingRepository } from './messaging.js';

describe('demo messaging repository', () => {
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
});
