import type {
  Community,
  CommunityCategory,
  CommunityChannel,
  CommunityRole,
} from '@scuttlebutt/community';

const categories: CommunityCategory[] = [
  { id: 'cat-start', name: 'Start here', position: 0 },
  { id: 'cat-build', name: 'Build together', position: 1 },
];

const channels: CommunityChannel[] = [
  {
    id: 'channel-welcome',
    categoryId: 'cat-start',
    name: 'welcome',
    kind: 'announcement',
    topic: 'News and community guidelines',
    position: 0,
    encrypted: true,
  },
  {
    id: 'channel-lounge',
    categoryId: 'cat-start',
    name: 'lounge',
    kind: 'text',
    topic: 'Progress, questions, and tiny wins',
    position: 1,
    encrypted: true,
  },
  {
    id: 'channel-design',
    categoryId: 'cat-build',
    name: 'design-notes',
    kind: 'forum',
    topic: 'Share work and accessibility notes',
    position: 0,
    encrypted: true,
  },
  {
    id: 'channel-huddle',
    categoryId: 'cat-build',
    name: 'huddle',
    kind: 'voice',
    topic: 'A small voice room for the team',
    position: 1,
    encrypted: true,
  },
];

const roles: CommunityRole[] = [
  {
    id: 'owner',
    name: 'owner',
    color: '#A8C3FF',
    position: 30,
    permissions: [
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
  },
  {
    id: 'member',
    name: 'member',
    color: '#8E98AA',
    position: 10,
    permissions: ['read_messages', 'send_messages', 'start_threads', 'use_voice'],
  },
];

export const DEMO_COMMUNITY: Community = {
  id: 'northstar-lab',
  name: 'Northstar Lab',
  description: 'A private product community for building Scuttlebutt in the open.',
  homeserverUrl: 'http://localhost:8008',
  spaceRoomId: '!northstar:localhost',
  ownerUserId: '@fahad:localhost',
  categories,
  channels,
  roles,
  members: [
    {
      userId: '@fahad:localhost',
      displayName: 'Fahad Arfin',
      roleIds: ['owner'],
      joinedAt: '2026-08-02T00:00:00.000Z',
    },
    {
      userId: '@jordan:localhost',
      displayName: 'Jordan Lee',
      roleIds: ['member'],
      joinedAt: '2026-08-02T00:00:00.000Z',
    },
    {
      userId: '@maya:localhost',
      displayName: 'Maya Chen',
      roleIds: ['member'],
      joinedAt: '2026-08-02T00:00:00.000Z',
    },
  ],
  invitations: [],
  customEmoji: [
    {
      id: 'emoji-northstar',
      name: 'northstar',
      shortcode: ':northstar:',
      mediaUri: 'mxc://localhost/northstar',
      animated: false,
    },
  ],
  pinnedMessages: [
    {
      eventId: 'lounge-1',
      channelId: 'channel-lounge',
      pinnedBy: '@fahad:localhost',
      pinnedAt: '2026-08-02T10:26:00.000Z',
    },
  ],
  threads: [
    {
      id: 'thread-invite',
      channelId: 'channel-lounge',
      rootEventId: 'lounge-1',
      name: 'Invite language',
      startedBy: '@jordan:localhost',
      startedAt: '2026-08-02T10:30:00.000Z',
    },
  ],
};

export function channelsForCategory(community: Community, categoryId: string): CommunityChannel[] {
  return community.channels
    .filter(({ categoryId: channelCategoryId }) => channelCategoryId === categoryId)
    .sort((left, right) => left.position - right.position);
}
