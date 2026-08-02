import {
  EventType,
  Preset,
  Visibility,
  type ICreateRoomOpts,
  type MatrixClient,
} from 'matrix-js-sdk';
import type { CommunityChannelKind, CommunityPermission } from '@scuttlebutt/community';

export interface CommunitySpaceInput {
  name: string;
  topic?: string;
  aliasLocalpart?: string;
  invite?: string[];
}

export interface CommunityChannelInput {
  name: string;
  topic?: string;
  kind?: CommunityChannelKind;
  parentSpaceId: string;
  invite?: string[];
  encrypted?: boolean;
}

export interface MatrixSpaceChildEvent {
  type: typeof EventType.SpaceChild;
  state_key: string;
  content: {
    order: string;
    suggested: boolean;
    via: string[];
  };
}

export interface MatrixSpaceParentEvent {
  type: typeof EventType.SpaceParent;
  state_key: string;
  content: {
    canonical: boolean;
    via: string[];
  };
}

export interface MatrixCustomEmojiEvent {
  type: 'im.ponies.room_emotes';
  state_key: '';
  content: {
    images: Record<
      string,
      { body: string; info?: { mimetype?: string; w?: number; h?: number }; url: string }
    >;
  };
}

export function createCommunitySpaceOptions(input: CommunitySpaceInput): ICreateRoomOpts {
  return {
    creation_content: { type: 'm.space' },
    initial_state: [
      {
        content: { history_visibility: 'shared' },
        state_key: '',
        type: EventType.RoomHistoryVisibility,
      },
    ],
    invite: input.invite,
    name: input.name.trim(),
    preset: Preset.PrivateChat,
    room_alias_name: input.aliasLocalpart?.trim() || undefined,
    topic: input.topic?.trim(),
    visibility: Visibility.Private,
  };
}

export function createCommunityChannelOptions(input: CommunityChannelInput): ICreateRoomOpts {
  const initialState = [createSpaceParentEvent(input.parentSpaceId)];

  return {
    invite: input.invite,
    name: input.name.trim(),
    preset: Preset.PrivateChat,
    topic: input.topic?.trim(),
    visibility: Visibility.Private,
    initial_state:
      input.encrypted === false
        ? initialState
        : [
            ...initialState,
            {
              content: { algorithm: 'm.megolm.v1.aes-sha2' },
              state_key: '',
              type: EventType.RoomEncryption,
            },
          ],
  };
}

export function createSpaceChildEvent(
  channelRoomId: string,
  order: string,
  via: string[] = [],
): MatrixSpaceChildEvent {
  return {
    content: { order, suggested: true, via },
    state_key: channelRoomId,
    type: EventType.SpaceChild,
  };
}

export function createSpaceParentEvent(spaceRoomId: string): MatrixSpaceParentEvent {
  const serverName = spaceRoomId.split(':').pop();
  return {
    content: { canonical: true, via: serverName ? [serverName] : [] },
    state_key: '',
    type: EventType.SpaceParent,
  };
}

export function createPinnedEventsContent(eventIds: string[]): { pinned: string[] } {
  return { pinned: [...new Set(eventIds)] };
}

export function createPowerLevelOverride(
  permissions: Partial<Record<CommunityPermission, number>>,
): { events: Record<string, number> } {
  const eventMap: Record<string, number> = {};
  if (permissions.send_messages !== undefined) {
    eventMap[EventType.RoomMessage] = permissions.send_messages;
  }
  if (permissions.pin_messages !== undefined) {
    eventMap[EventType.RoomPinnedEvents] = permissions.pin_messages;
  }
  if (permissions.moderate_messages !== undefined) {
    eventMap[EventType.RoomRedaction] = permissions.moderate_messages;
  }
  return { events: eventMap };
}

export function createCustomEmojiEvent(
  emoji: Record<string, { body: string; url: string; mimetype?: string }>,
): MatrixCustomEmojiEvent {
  return {
    content: {
      images: Object.fromEntries(
        Object.entries(emoji).map(([shortcode, image]) => [
          shortcode,
          {
            body: image.body,
            info: image.mimetype ? { mimetype: image.mimetype } : undefined,
            url: image.url,
          },
        ]),
      ),
    },
    state_key: '',
    type: 'im.ponies.room_emotes',
  };
}

export class MatrixCommunityAdapter {
  public constructor(private readonly client: MatrixClient) {}

  async createCommunity(input: CommunitySpaceInput): Promise<string> {
    const response = await this.client.createRoom(createCommunitySpaceOptions(input));
    return response.room_id;
  }

  async createChannel(input: CommunityChannelInput): Promise<string> {
    const response = await this.client.createRoom(createCommunityChannelOptions(input));
    await this.client.sendStateEvent(
      input.parentSpaceId,
      EventType.SpaceChild,
      createSpaceChildEvent(response.room_id, input.name.trim().toLowerCase()).content,
      response.room_id,
    );
    return response.room_id;
  }

  async inviteMember(roomId: string, userId: string): Promise<void> {
    await this.client.invite(roomId, userId);
  }

  async joinCommunity(roomId: string): Promise<void> {
    await this.client.joinRoom(roomId);
  }

  async setPinnedMessages(roomId: string, eventIds: string[]): Promise<void> {
    await this.client.sendStateEvent(
      roomId,
      EventType.RoomPinnedEvents,
      createPinnedEventsContent(eventIds),
      '',
    );
  }

  async setPowerLevelEvents(
    roomId: string,
    permissions: Partial<Record<CommunityPermission, number>>,
  ): Promise<void> {
    await this.client.sendStateEvent(
      roomId,
      EventType.RoomPowerLevels,
      createPowerLevelOverride(permissions),
      '',
    );
  }
}
