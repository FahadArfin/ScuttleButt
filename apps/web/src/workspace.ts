import type { Conversation } from './messaging.js';
import type { PresenceIndicatorStatus } from './presence.js';

export type AppSurface = 'dms' | 'explore' | 'groups' | 'threads';
export type DialogMode = 'dm' | 'group' | 'text-channel' | 'voice-channel';

export type WorkspaceChannelKind = 'text' | 'voice' | 'forum';

export interface WorkspaceMember {
  avatar: string;
  id: string;
  name: string;
  note: string;
  roleIds?: string[];
  status: PresenceIndicatorStatus;
}

export interface WorkspaceCategory {
  collapsed?: boolean;
  id: string;
  name: string;
}

export interface ForumReply {
  authorAvatar: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
}

export interface ForumPost {
  authorAvatar: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  replies: ForumReply[];
  title: string;
}

export type ServerEventFrequency = 'daily' | 'monthly' | 'once' | 'weekly';
export type ServerEventLocationType = 'external' | 'voice';

export interface ServerEvent {
  coverImage?: string;
  createdAt: string;
  createdBy: string;
  description: string;
  frequency: ServerEventFrequency;
  id: string;
  location: string;
  locationType: ServerEventLocationType;
  postChannelId?: string;
  startDate: string;
  startTime: string;
  title: string;
}

export interface CustomSound {
  dataUrl: string;
  id: string;
  name: string;
  sourceGroupId: string;
  sourceGroupName: string;
}

export interface CustomEmote {
  dataUrl: string;
  id: string;
  name: string;
  sourceGroupId: string;
  sourceGroupName: string;
}

export interface WorkspaceChannel {
  conversationId: string;
  id: string;
  kind: WorkspaceChannelKind;
  categoryId?: string;
  forumPosts?: ForumPost[];
  isPrivate?: boolean;
  allowedRoleIds?: string[];
  muted?: boolean;
  name: string;
  participantIds: string[];
}

export type ServerAccessMode = 'invite-only' | 'apply-to-join' | 'discoverable';
export type ServerNotificationLevel = 'all' | 'mentions';
export type ServerSensitiveContentMode = 'none' | 'filter';

export interface ServerRole {
  color: string;
  id: string;
  name: string;
  permissions: string[];
}

export interface ServerInvite {
  code: string;
  createdAt: string;
  uses: number;
}

export interface ServerSettings {
  access: {
    ageRestricted: boolean;
    mode: ServerAccessMode;
    rules: string[];
    rulesEnabled: boolean;
  };
  bannerUrl: string;
  bannerColor: string;
  communityEnabled: boolean;
  engagement: {
    activityFeed: boolean;
    boostMessages: boolean;
    defaultNotifications: ServerNotificationLevel;
    inactiveChannelId: string;
    inactiveTimeoutMinutes: number;
    replySticker: boolean;
    setupTips: boolean;
    systemChannelId: string;
    welcomeMessages: boolean;
    widgetEnabled: boolean;
  };
  games: string[];
  iconUrl: string;
  invites: ServerInvite[];
  membersInChannelList: boolean;
  moderation: {
    customWords: string[];
    flaggedWords: boolean;
    mentionSpam: boolean;
    sensitiveContent: ServerSensitiveContentMode;
    suspectedSpam: boolean;
  };
  privateProfile: boolean;
  roles: ServerRole[];
  serverTag: {
    badge: string;
    color: string;
    name: string;
  };
  traits: string[];
  webhooks: string[];
}

export interface WorkspaceGroup {
  categories?: WorkspaceCategory[];
  channels: WorkspaceChannel[];
  description: string;
  emotes?: CustomEmote[];
  events?: ServerEvent[];
  icon: 'chat' | 'garden' | 'orbit' | 'summit';
  id: string;
  members?: WorkspaceMember[];
  name: string;
  ownerId?: string;
  settings?: ServerSettings;
  sounds?: CustomSound[];
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

export function createDefaultServerSettings(): ServerSettings {
  return {
    access: {
      ageRestricted: false,
      mode: 'invite-only',
      rules: [],
      rulesEnabled: false,
    },
    bannerUrl: '',
    bannerColor: '#283457',
    communityEnabled: false,
    engagement: {
      activityFeed: true,
      boostMessages: true,
      defaultNotifications: 'all',
      inactiveChannelId: '',
      inactiveTimeoutMinutes: 5,
      replySticker: false,
      setupTips: true,
      systemChannelId: '',
      welcomeMessages: true,
      widgetEnabled: false,
    },
    games: [],
    iconUrl: '',
    invites: [],
    membersInChannelList: true,
    moderation: {
      customWords: [],
      flaggedWords: false,
      mentionSpam: true,
      sensitiveContent: 'none',
      suspectedSpam: true,
    },
    privateProfile: false,
    roles: [
      {
        color: '#98a2b3',
        id: 'everyone',
        name: '@everyone',
        permissions: ['View channels', 'Send messages', 'Connect to voice'],
      },
    ],
    serverTag: {
      badge: '*',
      color: '#5865f2',
      name: '',
    },
    traits: [],
    webhooks: [],
  };
}

export function serverSettingsFor(group: WorkspaceGroup): ServerSettings {
  const defaults = createDefaultServerSettings();
  const settings = group.settings;
  return {
    ...defaults,
    ...settings,
    access: { ...defaults.access, ...settings?.access },
    engagement: { ...defaults.engagement, ...settings?.engagement },
    moderation: { ...defaults.moderation, ...settings?.moderation },
    serverTag: { ...defaults.serverTag, ...settings?.serverTag },
    games: [...(settings?.games ?? defaults.games)],
    invites: [...(settings?.invites ?? defaults.invites)],
    roles: [...(settings?.roles ?? defaults.roles)],
    traits: [...(settings?.traits ?? defaults.traits)],
    webhooks: [...(settings?.webhooks ?? defaults.webhooks)],
  };
}

export const DEFAULT_GROUPS: WorkspaceGroup[] = [
  {
    id: 'scuttlebutt-labs',
    name: 'Scuttlebutt Labs',
    description: 'A private product community for building Scuttlebutt in the open.',
    icon: 'chat',
    settings: createDefaultServerSettings(),
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
    settings: createDefaultServerSettings(),
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
    settings: createDefaultServerSettings(),
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
    settings: createDefaultServerSettings(),
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
    avatarLabel: channel.kind === 'voice' ? 'VC' : channel.kind === 'forum' ? 'F' : '#',
    presence:
      channel.kind === 'voice'
        ? `Voice room · ${channel.participantIds.length} connected`
        : channel.kind === 'forum'
          ? `${group.name} forum channel`
          : `${group.name} text channel`,
    preview:
      channel.kind === 'voice'
        ? 'Meeting chat and voice room.'
        : channel.kind === 'forum'
          ? 'Start a discussion post.'
          : 'Start the conversation.',
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
