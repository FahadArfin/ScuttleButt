export type CommunityChannelKind = 'announcement' | 'forum' | 'text' | 'voice';
export type CommunityPermission =
  | 'invite_members'
  | 'manage_channels'
  | 'manage_community'
  | 'manage_members'
  | 'manage_roles'
  | 'moderate_messages'
  | 'pin_messages'
  | 'read_messages'
  | 'send_messages'
  | 'start_threads'
  | 'use_voice';

export interface CommunityCategory {
  id: string;
  name: string;
  position: number;
}

export interface CommunityChannel {
  id: string;
  categoryId: string;
  name: string;
  kind: CommunityChannelKind;
  topic: string;
  position: number;
  encrypted: boolean;
}

export interface CommunityRole {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: CommunityPermission[];
}

export interface CommunityMember {
  userId: string;
  displayName: string;
  roleIds: string[];
  joinedAt: string;
}

export interface CommunityInvitation {
  id: string;
  communityId: string;
  inviterUserId: string;
  inviteeUserId?: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface CommunityEmoji {
  id: string;
  name: string;
  shortcode: string;
  mediaUri: string;
  animated: boolean;
}

export interface PinnedMessage {
  eventId: string;
  channelId: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface CommunityThread {
  id: string;
  channelId: string;
  rootEventId: string;
  name: string;
  startedBy: string;
  startedAt: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  homeserverUrl: string;
  spaceRoomId: string;
  ownerUserId: string;
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  roles: CommunityRole[];
  members: CommunityMember[];
  invitations: CommunityInvitation[];
  customEmoji: CommunityEmoji[];
  pinnedMessages: PinnedMessage[];
  threads: CommunityThread[];
}

export interface CreateCommunityInput {
  id?: string;
  name: string;
  description?: string;
  homeserverUrl: string;
  spaceRoomId: string;
  ownerUserId: string;
}

export interface CreateChannelInput {
  categoryId: string;
  name: string;
  kind?: CommunityChannelKind;
  topic?: string;
  encrypted?: boolean;
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, CommunityPermission[]> = {
  member: ['read_messages', 'send_messages', 'start_threads', 'use_voice'],
  moderator: [
    'invite_members',
    'manage_members',
    'moderate_messages',
    'pin_messages',
    'read_messages',
    'send_messages',
    'start_threads',
    'use_voice',
  ],
  owner: [
    'invite_members',
    'manage_channels',
    'manage_community',
    'manage_members',
    'manage_roles',
    'moderate_messages',
    'pin_messages',
    'read_messages',
    'send_messages',
    'start_threads',
    'use_voice',
  ],
};

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function now(): string {
  return new Date().toISOString();
}

function cloneCommunity(community: Community): Community {
  return structuredClone(community);
}

function createRole(id: string, name: string, position: number): CommunityRole {
  return {
    id,
    name,
    color: name === 'owner' ? '#A8C3FF' : name === 'moderator' ? '#7BD9AF' : '#8E98AA',
    position,
    permissions: [...(DEFAULT_ROLE_PERMISSIONS[name] ?? [])],
  };
}

export function createCommunity(input: CreateCommunityInput): Community {
  const name = requireText(input.name, 'Community name');
  const ownerUserId = requireText(input.ownerUserId, 'Owner user ID');
  const homeserverUrl = requireText(input.homeserverUrl, 'Homeserver URL').replace(/\/+$/, '');

  return {
    id: input.id ?? `community-${crypto.randomUUID()}`,
    name,
    description: input.description?.trim() ?? '',
    homeserverUrl,
    spaceRoomId: requireText(input.spaceRoomId, 'Space room ID'),
    ownerUserId,
    categories: [],
    channels: [],
    roles: [
      createRole('owner', 'owner', 30),
      createRole('moderator', 'moderator', 20),
      createRole('member', 'member', 10),
    ],
    members: [
      {
        userId: ownerUserId,
        displayName: ownerUserId,
        roleIds: ['owner'],
        joinedAt: now(),
      },
    ],
    invitations: [],
    customEmoji: [],
    pinnedMessages: [],
    threads: [],
  };
}

export function addCategory(community: Community, name: string): CommunityCategory {
  const category: CommunityCategory = {
    id: `category-${crypto.randomUUID()}`,
    name: requireText(name, 'Category name'),
    position: community.categories.length,
  };
  community.categories.push(category);
  return { ...category };
}

export function addChannel(community: Community, input: CreateChannelInput): CommunityChannel {
  if (!community.categories.some(({ id }) => id === input.categoryId)) {
    throw new Error('The channel category does not exist.');
  }
  const channel: CommunityChannel = {
    id: `channel-${crypto.randomUUID()}`,
    categoryId: input.categoryId,
    name: requireText(input.name, 'Channel name').toLowerCase().replace(/\s+/g, '-'),
    kind: input.kind ?? 'text',
    topic: input.topic?.trim() ?? '',
    position: community.channels.filter(({ categoryId }) => categoryId === input.categoryId).length,
    encrypted: input.encrypted ?? true,
  };
  community.channels.push(channel);
  return { ...channel };
}

export function addMember(
  community: Community,
  member: Pick<CommunityMember, 'userId' | 'displayName'> &
    Partial<Pick<CommunityMember, 'roleIds'>>,
): CommunityMember {
  if (community.members.some(({ userId }) => userId === member.userId)) {
    throw new Error('The user is already a community member.');
  }
  const nextMember: CommunityMember = {
    userId: requireText(member.userId, 'Member user ID'),
    displayName: requireText(member.displayName, 'Member display name'),
    roleIds: member.roleIds ?? ['member'],
    joinedAt: now(),
  };
  community.members.push(nextMember);
  return { ...nextMember, roleIds: [...nextMember.roleIds] };
}

export function createInvitation(
  community: Community,
  inviterUserId: string,
  input: { inviteeUserId?: string; expiresAt: string },
): CommunityInvitation {
  if (!can(community, inviterUserId, 'invite_members')) {
    throw new Error('The inviter does not have permission to invite members.');
  }
  const invitation: CommunityInvitation = {
    id: `invite-${crypto.randomUUID()}`,
    communityId: community.id,
    inviterUserId: requireText(inviterUserId, 'Inviter user ID'),
    inviteeUserId: input.inviteeUserId?.trim() || undefined,
    expiresAt: new Date(input.expiresAt).toISOString(),
  };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    throw new Error('Invitation expiration must be in the future.');
  }
  community.invitations.push(invitation);
  return { ...invitation };
}

export function can(
  community: Community,
  userId: string,
  permission: CommunityPermission,
): boolean {
  const member = community.members.find(({ userId: candidate }) => candidate === userId);
  if (!member) {
    return false;
  }
  return member.roleIds.some((roleId) =>
    community.roles.find(({ id }) => id === roleId)?.permissions.includes(permission),
  );
}

export function pinMessage(
  community: Community,
  userId: string,
  channelId: string,
  eventId: string,
): PinnedMessage {
  if (!can(community, userId, 'pin_messages')) {
    throw new Error('The user does not have permission to pin messages.');
  }
  if (!community.channels.some(({ id }) => id === channelId)) {
    throw new Error('The channel does not exist.');
  }
  const pinned: PinnedMessage = { channelId, eventId, pinnedAt: now(), pinnedBy: userId };
  community.pinnedMessages = [
    ...community.pinnedMessages.filter((candidate) => candidate.eventId !== eventId),
    pinned,
  ];
  return { ...pinned };
}

export function startThread(
  community: Community,
  userId: string,
  channelId: string,
  rootEventId: string,
  name: string,
): CommunityThread {
  if (!can(community, userId, 'start_threads')) {
    throw new Error('The user does not have permission to start threads.');
  }
  const thread: CommunityThread = {
    channelId,
    id: `thread-${crypto.randomUUID()}`,
    name: requireText(name, 'Thread name'),
    rootEventId: requireText(rootEventId, 'Root event ID'),
    startedAt: now(),
    startedBy: userId,
  };
  community.threads.push(thread);
  return { ...thread };
}

export function addCustomEmoji(
  community: Community,
  userId: string,
  input: Omit<CommunityEmoji, 'id'>,
): CommunityEmoji {
  if (!can(community, userId, 'manage_community')) {
    throw new Error('The user does not have permission to manage community emoji.');
  }
  const emoji: CommunityEmoji = {
    ...input,
    id: `emoji-${crypto.randomUUID()}`,
    name: requireText(input.name, 'Emoji name'),
    shortcode: requireText(input.shortcode, 'Emoji shortcode'),
    mediaUri: requireText(input.mediaUri, 'Emoji media URI'),
  };
  community.customEmoji.push(emoji);
  return { ...emoji };
}

export class InMemoryCommunityStore {
  private readonly communities = new Map<string, Community>();

  create(input: CreateCommunityInput): Community {
    const community = createCommunity(input);
    this.communities.set(community.id, community);
    return cloneCommunity(community);
  }

  get(communityId: string): Community {
    const community = this.communities.get(communityId);
    if (!community) {
      throw new Error('Community not found.');
    }
    return cloneCommunity(community);
  }

  update(communityId: string, update: (community: Community) => void): Community {
    const community = this.communities.get(communityId);
    if (!community) {
      throw new Error('Community not found.');
    }
    update(community);
    return cloneCommunity(community);
  }
}
