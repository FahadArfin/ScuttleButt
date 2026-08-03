import type { CommunityChannelKind } from '@scuttlebutt/community';

export type ConversationKind = 'channel' | 'direct';
export type MessageStatus = 'failed' | 'sending' | 'sent';

export interface Conversation {
  id: string;
  title: string;
  kind: ConversationKind;
  avatarLabel: string;
  avatarUrl?: string | null;
  presence: string;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  encrypted: boolean;
  members: number;
  categoryId?: string;
  categoryName?: string;
  channelKind?: CommunityChannelKind;
  voiceRoomId?: string;
}

export interface ReplyReference {
  id: string;
  author: string;
  body: string;
}

export interface ReactionUser {
  id: string;
  name: string;
}

export interface AttachmentDraft {
  id: string;
  alt?: string;
  kind?: 'file' | 'gif' | 'image' | 'sticker';
  name: string;
  previewUrl?: string;
  size: number;
  mimeType: string;
  source?: string;
  url?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderAvatar?: string;
  senderName: string;
  senderInitials: string;
  body: string;
  sentAt: string;
  status: MessageStatus;
  edited: boolean;
  own: boolean;
  replyTo?: ReplyReference;
  attachments: AttachmentDraft[];
  reactions: Record<string, number>;
  reactionUsers?: Record<string, ReactionUser[]>;
}

export interface SendMessageOptions {
  replyTo?: ReplyReference;
  attachments?: AttachmentDraft[];
}

export interface MessagingRepository {
  createConversation(conversation: Conversation): Promise<Conversation>;
  getConversations(): Promise<Conversation[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, body: string, options?: SendMessageOptions): Promise<Message>;
  editMessage(conversationId: string, messageId: string, body: string): Promise<void>;
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
  reactToMessage(conversationId: string, messageId: string, emoji: string): Promise<void>;
  markRead(conversationId: string): Promise<void>;
  setTyping(conversationId: string, isTyping: boolean): Promise<void>;
  retryMessage(conversationId: string, messageId: string): Promise<Message>;
}

const currentUser = {
  id: 'alex',
  name: 'Alex Rivers',
  initials: 'AR',
};

const initialConversations: Conversation[] = [
  {
    id: 'welcome',
    title: 'Announcements',
    kind: 'channel',
    avatarLabel: '!',
    presence: 'Announcements only',
    preview: 'Community updates and release notes.',
    updatedAt: 'Mon',
    unreadCount: 0,
    encrypted: true,
    members: 18,
    categoryId: 'cat-start',
    categoryName: 'Start here',
    channelKind: 'announcement',
  },
  {
    id: 'lounge',
    title: 'Engineering',
    kind: 'channel',
    avatarLabel: '#',
    presence: 'Everyone welcome',
    preview: 'Maya: Search indexing is ready for review.',
    updatedAt: '10:42 AM',
    unreadCount: 2,
    encrypted: true,
    members: 18,
    categoryId: 'cat-start',
    categoryName: 'Start here',
    channelKind: 'text',
  },
  {
    id: 'jordan',
    title: 'Maya Patel',
    kind: 'direct',
    avatarLabel: 'MP',
    presence: 'Online now',
    preview: 'Let’s review the next milestone.',
    updatedAt: '9:18 AM',
    unreadCount: 0,
    encrypted: true,
    members: 2,
  },
  {
    id: 'design',
    title: 'Product design',
    kind: 'channel',
    avatarLabel: 'PD',
    presence: '5 members',
    preview: 'Priya shared a new accessibility checklist.',
    updatedAt: 'Yesterday',
    unreadCount: 0,
    encrypted: true,
    members: 5,
    categoryId: 'cat-build',
    categoryName: 'Build together',
    channelKind: 'forum',
  },
  {
    id: 'huddle',
    title: 'Engineering Room',
    kind: 'channel',
    avatarLabel: 'ER',
    presence: 'Voice room · 3 seats open',
    preview: 'Drop in for a quick sync.',
    updatedAt: 'Now',
    unreadCount: 0,
    encrypted: true,
    members: 3,
    categoryId: 'cat-build',
    categoryName: 'Build together',
    channelKind: 'voice',
    voiceRoomId: 'northstar-huddle',
  },
];

const initialMessages: Record<string, Message[]> = {
  welcome: [],
  lounge: [
    {
      id: 'lounge-1',
      senderId: 'maya',
      senderName: 'Maya Patel',
      senderInitials: 'MP',
      body: 'Morning team — search indexing is ready for review. I pushed the benchmark notes and a short rollout checklist.',
      sentAt: '10:26 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [
        {
          id: 'search-benchmark',
          name: 'search-benchmark.md',
          size: 24_832,
          mimeType: 'text/markdown',
        },
      ],
      reactions: { '👍': 4, '✨': 2 },
    },
    {
      id: 'lounge-2',
      senderId: 'sam',
      senderName: 'Sam Lee',
      senderInitials: 'SL',
      body: 'Nice. The query latency looks stable on my local dataset. I will test the larger fixture after lunch.',
      sentAt: '10:31 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [],
      reactions: { '🚀': 3 },
    },
    {
      id: 'lounge-3',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderInitials: currentUser.initials,
      body: 'Great work. I’m wiring the message surface next, then we can connect the new results view.',
      sentAt: '10:38 AM',
      status: 'sent',
      edited: false,
      own: true,
      attachments: [],
      reactions: { '✅': 1 },
    },
    {
      id: 'lounge-4',
      senderId: 'priya',
      senderName: 'Priya Shah',
      senderInitials: 'PS',
      body: 'I can review the empty and loading states this afternoon. Tag me when the branch is ready.',
      sentAt: '10:42 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [],
      reactions: {},
    },
  ],
  jordan: [
    {
      id: 'jordan-1',
      senderId: 'maya',
      senderName: 'Maya Patel',
      senderInitials: 'MP',
      body: 'I pulled together the search notes. Want to review the conversation states this afternoon?',
      sentAt: '9:14 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [],
      reactions: {},
    },
    {
      id: 'jordan-2',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderInitials: currentUser.initials,
      body: 'Absolutely. I’ll bring the retry and offline cases too.',
      sentAt: '9:18 AM',
      status: 'sent',
      edited: false,
      own: true,
      attachments: [],
      reactions: {},
    },
  ],
  design: [
    {
      id: 'design-1',
      senderId: 'priya',
      senderName: 'Priya Shah',
      senderInitials: 'PS',
      body: 'I added the accessibility checklist to the design notes. Keyboard focus and readable contrast are the first pass.',
      sentAt: 'Yesterday',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [
        {
          id: 'design-attachment',
          name: 'accessibility-checklist.md',
          size: 18_432,
          mimeType: 'text/markdown',
        },
      ],
      reactions: { '✅': 2 },
    },
  ],
  huddle: [
    {
      id: 'huddle-1',
      senderId: 'maya',
      senderName: 'Maya Patel',
      senderInitials: 'MP',
      body: 'I added the meeting notes here so everyone can follow along without joining audio.',
      sentAt: '10:12 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [],
      reactions: { '👍': 2 },
    },
  ],
};

// Retained only as legacy fixtures for older component previews; the active repository starts empty.
void initialConversations;
void initialMessages;

function cloneMessage(message: Message): Message {
  return {
    ...message,
    attachments: [...message.attachments],
    reactions: { ...message.reactions },
    reactionUsers: message.reactionUsers
      ? Object.fromEntries(
          Object.entries(message.reactionUsers).map(([emoji, users]) => [
            emoji,
            users.map((user) => ({ ...user })),
          ]),
        )
      : undefined,
    replyTo: message.replyTo ? { ...message.replyTo } : undefined,
  };
}

export function createDemoMessagingRepository(user?: {
  id: string;
  name: string;
}): MessagingRepository {
  const conversations: Conversation[] = [];
  const messages: Record<string, Message[]> = {};
  const currentUser = {
    id: user?.id ?? 'local-user',
    name: user?.name ?? 'Local user',
    initials: (user?.name ?? 'Local user')
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  };

  return {
    async createConversation(conversation) {
      const existing = conversations.find(({ id }) => id === conversation.id);
      if (existing) return { ...existing };
      const nextConversation = { ...conversation };
      conversations.push(nextConversation);
      messages[nextConversation.id] = [];
      return { ...nextConversation };
    },

    async getConversations() {
      return conversations.map((conversation) => ({ ...conversation }));
    },

    async getMessages(conversationId) {
      return (messages[conversationId] ?? []).map(cloneMessage);
    },

    async sendMessage(conversationId, body, options = {}) {
      const message: Message = {
        id: `${conversationId}-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderInitials: currentUser.initials,
        body,
        sentAt: 'Just now',
        status: 'sent',
        edited: false,
        own: true,
        replyTo: options.replyTo,
        attachments: options.attachments ? [...options.attachments] : [],
        reactions: {},
      };
      messages[conversationId] ??= [];
      messages[conversationId].push(message);
      return cloneMessage(message);
    },

    async editMessage(conversationId, messageId, body) {
      const message = messages[conversationId]?.find((candidate) => candidate.id === messageId);
      if (!message || !message.own) {
        throw new Error('Only your messages can be edited.');
      }
      message.body = body;
      message.edited = true;
    },

    async deleteMessage(conversationId, messageId) {
      const conversationMessages = messages[conversationId] ?? [];
      const message = conversationMessages.find((candidate) => candidate.id === messageId);
      if (!message || !message.own) {
        throw new Error('Only your messages can be deleted.');
      }
      messages[conversationId] = conversationMessages.filter(
        (candidate) => candidate.id !== messageId,
      );
    },

    async reactToMessage(conversationId, messageId, emoji) {
      const message = messages[conversationId]?.find((candidate) => candidate.id === messageId);
      if (!message) {
        throw new Error('Message not found.');
      }
      const reactionUsers = message.reactionUsers ?? {};
      const users = [...(reactionUsers[emoji] ?? [])];
      const legacyCount = Math.max(0, (message.reactions[emoji] ?? 0) - users.length);
      const currentUserIndex = users.findIndex(({ id }) => id === currentUser.id);

      if (currentUserIndex >= 0) {
        users.splice(currentUserIndex, 1);
      } else {
        users.push({ id: currentUser.id, name: currentUser.name });
      }

      if (users.length > 0) {
        reactionUsers[emoji] = users;
      } else {
        delete reactionUsers[emoji];
      }
      message.reactionUsers = Object.keys(reactionUsers).length > 0 ? reactionUsers : undefined;

      const nextCount = legacyCount + users.length;
      if (nextCount > 0) {
        message.reactions[emoji] = nextCount;
      } else {
        delete message.reactions[emoji];
      }
    },

    async markRead(conversationId) {
      const conversation = conversations.find((candidate) => candidate.id === conversationId);
      if (conversation) {
        conversation.unreadCount = 0;
      }
    },

    async setTyping() {
      return undefined;
    },

    async retryMessage(conversationId, messageId) {
      const message = messages[conversationId]?.find((candidate) => candidate.id === messageId);
      if (!message) {
        throw new Error('Message not found.');
      }
      message.status = 'sent';
      return cloneMessage(message);
    },
  };
}

async function syncRequest<T>(
  path: string,
  credential: string,
  body: Record<string, unknown> = {},
  method = 'POST',
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, ...body }),
  });
  if (!response.ok) throw new Error('Cloud synchronization failed. Please sign in again.');
  return response.json() as Promise<T>;
}

export function createSyncedMessagingRepository(
  credential: string,
  user: { id: string; name: string },
): MessagingRepository {
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const normalizeMessage = (message: Message): Message => ({
    ...message,
    own: message.senderId === user.id,
  });

  return {
    async createConversation(conversation) {
      const result = await syncRequest<{ conversation: Conversation }>(
        '/api/sync/conversations',
        credential,
        { conversation },
      );
      return result.conversation;
    },

    async getConversations() {
      const result = await syncRequest<{ conversations: Conversation[] }>(
        '/api/sync/conversations/list',
        credential,
      );
      return result.conversations;
    },

    async getMessages(conversationId) {
      const result = await syncRequest<{ messages: Message[] }>(
        '/api/sync/messages/list',
        credential,
        { conversationId },
      );
      return result.messages.map(normalizeMessage);
    },

    async sendMessage(conversationId, body, options = {}) {
      const message: Message = {
        id: `${conversationId}-${crypto.randomUUID()}`,
        senderId: user.id,
        senderName: user.name,
        senderInitials: initials,
        body,
        sentAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        status: 'sent',
        edited: false,
        own: true,
        replyTo: options.replyTo,
        attachments: options.attachments ? [...options.attachments] : [],
        reactions: {},
      };
      const result = await syncRequest<{ message: Message }>('/api/sync/messages', credential, {
        conversationId,
        message,
      });
      return normalizeMessage(result.message);
    },

    async editMessage(conversationId, messageId, body) {
      await syncRequest(
        '/api/sync/messages/edit',
        credential,
        {
          conversationId,
          messageId,
          value: body,
        },
        'PATCH',
      );
    },

    async deleteMessage(conversationId, messageId) {
      await syncRequest('/api/sync/messages', credential, { conversationId, messageId }, 'DELETE');
    },

    async reactToMessage(conversationId, messageId, emoji) {
      await syncRequest('/api/sync/messages/react', credential, {
        conversationId,
        messageId,
        value: emoji,
      });
    },

    async markRead() {
      return undefined;
    },

    async setTyping() {
      return undefined;
    },

    async retryMessage(conversationId, messageId) {
      const messages = await this.getMessages(conversationId);
      const message = messages.find(({ id }) => id === messageId);
      if (!message) throw new Error('Message not found.');
      return message;
    },
  };
}

export async function loadSyncedWorkspace<T>(credential: string): Promise<T | null> {
  const result = await syncRequest<{ workspace: T | null }>('/api/sync/workspace/load', credential);
  return result.workspace;
}

export async function saveSyncedWorkspace(
  credential: string,
  workspace: { dms: Conversation[]; groups: unknown[] },
): Promise<void> {
  await syncRequest('/api/sync/workspace', credential, { workspace }, 'PUT');
}
