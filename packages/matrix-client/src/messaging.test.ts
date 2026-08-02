import { describe, expect, it } from 'vitest';
import { MatrixEvent } from 'matrix-js-sdk';

import { mapMatrixTimelineEvent } from './messaging.js';

describe('Matrix messaging adapter mapping', () => {
  it('maps text and replacement events into the web timeline shape', () => {
    const event = new MatrixEvent({
      content: {
        body: '* updated text',
        msgtype: 'm.text',
        'm.new_content': { body: 'updated text', msgtype: 'm.text' },
        'm.relates_to': { event_id: '$original', rel_type: 'm.replace' },
      },
      event_id: '$edited',
      origin_server_ts: 1_725_000_000_000,
      room_id: '!lounge:localhost',
      sender: '@fahad:localhost',
      type: 'm.room.message',
    });

    expect(mapMatrixTimelineEvent(event)).toEqual({
      body: 'updated text',
      edited: true,
      id: '$edited',
      replyToEventId: null,
      roomId: '!lounge:localhost',
      senderId: '@fahad:localhost',
      sentAt: 1_725_000_000_000,
    });
  });

  it('ignores non-message events', () => {
    const event = new MatrixEvent({
      content: {},
      event_id: '$reaction',
      origin_server_ts: 1_725_000_000_000,
      room_id: '!lounge:localhost',
      sender: '@fahad:localhost',
      type: 'm.reaction',
    });

    expect(mapMatrixTimelineEvent(event)).toBeNull();
  });
});
