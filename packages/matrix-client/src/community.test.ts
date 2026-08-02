import { describe, expect, it } from 'vitest';

import {
  createCommunityChannelOptions,
  createCommunitySpaceOptions,
  createCustomEmojiEvent,
  createPinnedEventsContent,
  createPowerLevelOverride,
  createSpaceChildEvent,
  createSpaceParentEvent,
} from './community.js';

describe('Matrix community mapping', () => {
  it('maps a community server to a private Matrix space', () => {
    expect(
      createCommunitySpaceOptions({
        aliasLocalpart: 'northstar',
        name: 'Northstar Lab',
        topic: 'Build together',
      }),
    ).toEqual(
      expect.objectContaining({
        creation_content: { type: 'm.space' },
        name: 'Northstar Lab',
        preset: 'private_chat',
        visibility: 'private',
      }),
    );
  });

  it('maps encrypted child channels and space relations', () => {
    const options = createCommunityChannelOptions({
      name: 'lounge',
      parentSpaceId: '!space:localhost',
      topic: 'Progress and questions',
    });
    expect(options.initial_state).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'm.space.parent', state_key: '' }),
        expect.objectContaining({ type: 'm.room.encryption', state_key: '' }),
      ]),
    );
    expect(createSpaceChildEvent('!room:localhost', 'a000')).toEqual({
      content: { order: 'a000', suggested: true, via: [] },
      state_key: '!room:localhost',
      type: 'm.space.child',
    });
    expect(createSpaceParentEvent('!space:localhost').content.canonical).toBe(true);
  });

  it('normalizes pin, role, and custom emoji state payloads', () => {
    expect(createPinnedEventsContent(['$one', '$one', '$two'])).toEqual({
      pinned: ['$one', '$two'],
    });
    expect(createPowerLevelOverride({ moderate_messages: 50, pin_messages: 40 })).toEqual({
      events: { 'm.room.pinned_events': 40, 'm.room.redaction': 50 },
    });
    expect(
      createCustomEmojiEvent({
        ':northstar:': { body: 'northstar', mimetype: 'image/png', url: 'mxc://localhost/emoji' },
      }).content.images[':northstar:']?.url,
    ).toBe('mxc://localhost/emoji');
  });
});
