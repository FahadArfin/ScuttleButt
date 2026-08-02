import type { Conversation } from './messaging.js';

export type AppSurface = 'dms' | 'explore' | 'groups' | 'threads';
export type DialogMode = 'dm' | 'group' | 'text-channel' | 'voice-channel';

export interface WorkspaceMember {
  avatar: string;
  id: string;
  name: string;
  note: string;
  status: 'away' | 'offline' | 'online';
}

export interface WorkspaceChannel {
  conversationId: string;
  id: string;
  kind: 'text' | 'voice';
  name: string;
  participantIds: string[];
}

export interface WorkspaceGroup {
  channels: WorkspaceChannel[];
  description: string;
  icon: 'chat' | 'garden' | 'orbit' | 'summit';
  id: string;
  name: string;
}

export const GROUP_STORAGE_KEY = 'scuttlebutt:workspace-groups:v3';
export const DM_STORAGE_KEY = 'scuttlebutt:custom-dms:v3';

export const AVATARS = {
  alex: '/avatars/alex-rivers.webp',
  jordan: '/avatars/jordan-park.webp',
  maya: '/avatars/maya-patel.webp',
  priya: '/avatars/priya-shah.webp',
  sam: '/avatars/sam-lee.webp',
  taylor: '/avatars/taylor-nguyen.webp',
};

export const MEMBERS: WorkspaceMember[] = [];

export const DEFAULT_GROUPS: WorkspaceGroup[] = [
  {
    id: 'scuttlebutt-labs',
    name: 'Scuttlebutt Labs',
    description: 'A private product community for building Scuttlebutt in the open.',
    icon: 'chat',
    channels: [
      {
        id: 'announcements',
        name: 'announcements',
        kind: 'text',
        conversationId: 'welcome',
        participantIds: [],
      },
      {
        id: 'general',
        name: 'general',
        kind: 'text',
        conversationId: 'general',
        participantIds: [],
      },
      {
        id: 'engineering',
        name: 'engineering',
        kind: 'text',
        conversationId: 'lounge',
        participantIds: [],
      },
      {
        id: 'product-design',
        name: 'product-design',
        kind: 'text',
        conversationId: 'design',
        participantIds: [],
      },
      {
        id: 'random',
        name: 'random',
        kind: 'text',
        conversationId: 'random',
        participantIds: [],
      },
      {
        id: 'engineering-room',
        name: 'Engineering Room',
        kind: 'voice',
        conversationId: 'huddle',
        participantIds: ['maya', 'sam'],
      },
    ],
  },
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Planning launches and the next product horizon.',
    icon: 'orbit',
    channels: [
      {
        id: 'orbit-general',
        name: 'general',
        kind: 'text',
        conversationId: 'orbit-general',
        participantIds: [],
      },
      {
        id: 'launch-room',
        name: 'Launch Room',
        kind: 'voice',
        conversationId: 'orbit-launch-room',
        participantIds: ['priya'],
      },
    ],
  },
  {
    id: 'garden',
    name: 'Garden',
    description: 'A calm community for ideas, learning, and feedback.',
    icon: 'garden',
    channels: [
      {
        id: 'garden-chat',
        name: 'garden-chat',
        kind: 'text',
        conversationId: 'garden-chat',
        participantIds: [],
      },
      {
        id: 'greenhouse',
        name: 'Greenhouse',
        kind: 'voice',
        conversationId: 'garden-greenhouse',
        participantIds: [],
      },
    ],
  },
  {
    id: 'summit',
    name: 'Summit',
    description: 'Community goals, milestones, and weekly standups.',
    icon: 'summit',
    channels: [
      {
        id: 'trailhead',
        name: 'trailhead',
        kind: 'text',
        conversationId: 'summit-trailhead',
        participantIds: [],
      },
      {
        id: 'basecamp',
        name: 'Basecamp',
        kind: 'voice',
        conversationId: 'summit-basecamp',
        participantIds: ['jordan'],
      },
    ],
  },
];

export function loadStoredGroups(): WorkspaceGroup[] {
  try {
    const stored = window.localStorage.getItem(GROUP_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as WorkspaceGroup[]) : [];
  } catch {
    return [];
  }
}

export function loadStoredDms(): Conversation[] {
  try {
    const stored = window.localStorage.getItem(DM_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function conversationForChannel(
  group: WorkspaceGroup,
  channel: WorkspaceChannel,
): Conversation {
  return {
    id: channel.conversationId,
    title: channel.name,
    kind: 'channel',
    avatarLabel: channel.kind === 'voice' ? 'VC' : '#',
    presence:
      channel.kind === 'voice'
        ? `Voice room · ${channel.participantIds.length} connected`
        : `${group.name} text channel`,
    preview: channel.kind === 'voice' ? 'Meeting chat and voice room.' : 'Start the conversation.',
    updatedAt: 'Now',
    unreadCount: 0,
    encrypted: true,
    members: Math.max(1, channel.participantIds.length),
    categoryId: group.id,
    categoryName: group.name,
    channelKind: channel.kind,
    voiceRoomId: channel.kind === 'voice' ? channel.conversationId : undefined,
  };
}
