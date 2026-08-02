import { describe, expect, it } from 'vitest';

import {
  InMemoryCommunityStore,
  addCategory,
  addChannel,
  addCustomEmoji,
  addMember,
  can,
  createInvitation,
  pinMessage,
  startThread,
} from './index.js';

function makeCommunity() {
  const store = new InMemoryCommunityStore();
  const community = store.create({
    description: 'A private product community.',
    homeserverUrl: 'http://localhost:8008///',
    name: 'Northstar Lab',
    ownerUserId: '@fahad:localhost',
    spaceRoomId: '!space:localhost',
  });
  return { community, store };
}

describe('community domain', () => {
  it('creates categories, channels, members, and role-gated invitations', () => {
    const { community, store } = makeCommunity();
    const category = addCategory(community, 'Getting started');
    const channel = addChannel(community, { categoryId: category.id, name: 'Welcome room' });
    addMember(community, { displayName: 'Jordan Lee', userId: '@jordan:localhost' });

    expect(channel.name).toBe('welcome-room');
    expect(can(community, '@jordan:localhost', 'send_messages')).toBe(true);
    expect(() =>
      createInvitation(community, '@jordan:localhost', {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toThrow('does not have permission');

    const invitation = createInvitation(community, '@fahad:localhost', {
      inviteeUserId: '@maya:localhost',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(invitation.inviteeUserId).toBe('@maya:localhost');
    expect(store.get(community.id).channels).toHaveLength(0);
  });

  it('records pins, threads, and custom emoji behind owner permissions', () => {
    const { community } = makeCommunity();
    const category = addCategory(community, 'Chat');
    const channel = addChannel(community, { categoryId: category.id, name: 'lounge' });

    expect(pinMessage(community, '@fahad:localhost', channel.id, '$event').eventId).toBe('$event');
    expect(startThread(community, '@fahad:localhost', channel.id, '$event', 'Follow up').name).toBe(
      'Follow up',
    );
    expect(
      addCustomEmoji(community, '@fahad:localhost', {
        animated: false,
        mediaUri: 'mxc://localhost/emoji',
        name: 'party_parrot',
        shortcode: ':party_parrot:',
      }).shortcode,
    ).toBe(':party_parrot:');
  });
});
