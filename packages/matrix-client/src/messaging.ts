import {
  EventType,
  MsgType,
  RelationType,
  type MatrixClient,
  type MatrixEvent,
} from 'matrix-js-sdk';
import { makeTextMessage } from 'matrix-js-sdk/lib/content-helpers';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';

export interface MatrixTimelineMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  sentAt: number;
  edited: boolean;
  replyToEventId: string | null;
}

interface MatrixRelation {
  rel_type?: string;
  event_id?: string;
  'm.in_reply_to'?: { event_id?: string };
}

interface MatrixMessageContent {
  body?: unknown;
  msgtype?: unknown;
  'm.new_content'?: { body?: unknown };
  'm.relates_to'?: MatrixRelation;
}

function readMessageContent(event: MatrixEvent): MatrixMessageContent {
  return event.getContent() as MatrixMessageContent;
}

export function mapMatrixTimelineEvent(event: MatrixEvent): MatrixTimelineMessage | null {
  if (
    event.getType() !== EventType.RoomMessage &&
    event.getType() !== EventType.RoomMessageEncrypted
  ) {
    return null;
  }

  const content = readMessageContent(event);
  const replacement = content['m.new_content'];
  const body = typeof replacement?.body === 'string' ? replacement.body : content.body;
  const eventId = event.getId();
  const roomId = event.getRoomId();

  if (typeof body !== 'string' || !eventId || !roomId) {
    return null;
  }

  const relation = content['m.relates_to'];
  return {
    id: eventId,
    roomId,
    senderId: event.getSender() ?? 'unknown',
    body,
    sentAt: event.getTs(),
    edited: relation?.rel_type === RelationType.Replace,
    replyToEventId:
      relation?.['m.in_reply_to']?.event_id ??
      (relation?.rel_type === RelationType.Thread ? (relation.event_id ?? null) : null),
  };
}

function messageContent(body: string): RoomMessageEventContent {
  return makeTextMessage(body);
}

function replyMessageContent(body: string, replyToEventId: string): RoomMessageEventContent {
  return {
    ...messageContent(body),
    'm.relates_to': { 'm.in_reply_to': { event_id: replyToEventId } },
  } as RoomMessageEventContent;
}

export class MatrixMessagingAdapter {
  public constructor(private readonly client: MatrixClient) {}

  listMessages(roomId: string): MatrixTimelineMessage[] {
    return (
      this.client
        .getRoom(roomId)
        ?.getLiveTimeline()
        .getEvents()
        .map(mapMatrixTimelineEvent)
        .filter((message): message is MatrixTimelineMessage => message !== null) ?? []
    );
  }

  async sendText(roomId: string, body: string, replyToEventId?: string): Promise<string> {
    const response = await this.client.sendMessage(
      roomId,
      replyToEventId ? replyMessageContent(body, replyToEventId) : messageContent(body),
    );
    return response.event_id;
  }

  async editMessage(roomId: string, eventId: string, body: string): Promise<string> {
    const response = await this.client.sendMessage(roomId, {
      body: `* ${body}`,
      msgtype: MsgType.Text,
      'm.new_content': messageContent(body),
      'm.relates_to': {
        event_id: eventId,
        rel_type: RelationType.Replace,
      },
    });
    return response.event_id;
  }

  async deleteMessage(
    roomId: string,
    eventId: string,
    reason = 'Deleted by the sender',
  ): Promise<string> {
    const response = await this.client.redactEvent(roomId, eventId, undefined, { reason });
    return response.event_id;
  }

  async reactToMessage(roomId: string, eventId: string, key: string): Promise<string> {
    const response = await this.client.sendEvent(roomId, EventType.Reaction, {
      'm.relates_to': {
        event_id: eventId,
        key,
        rel_type: RelationType.Annotation,
      },
    });
    return response.event_id;
  }

  async setTyping(roomId: string, isTyping: boolean): Promise<void> {
    await this.client.sendTyping(roomId, isTyping, isTyping ? 15_000 : 0);
  }

  async markRead(roomId: string, eventId: string): Promise<void> {
    const event = this.client.getRoom(roomId)?.findEventById(eventId);
    if (!event) {
      return;
    }

    await this.client.setRoomReadMarkers(roomId, eventId, event);
  }
}
