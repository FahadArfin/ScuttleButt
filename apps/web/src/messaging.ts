import type { CommunityChannelKind } from '@scuttlebutt/community';

export type ConversationKind = 'channel' | 'direct';
export type MessageStatus = 'failed' | 'sending' | 'sent';

export interface Conversation {
  id: string;
  title: string;
  kind: ConversationKind;
  avatarLabel: string;
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

export interface AttachmentDraft {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface Message {
  id: string;
  senderId: string;
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
}

export interface SendMessageOptions {
  replyTo?: ReplyReference;
  attachments?: AttachmentDraft[];
}

export interface MessagingRepository {
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
  id: 'fahad',
  name: 'Fahad Arfin',
  initials: 'FA',
};

const initialConversations: Conversation[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    kind: 'channel',
    avatarLabel: '!',
    presence: 'Announcements only',
    preview: 'Community guidelines and updates.',
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
    title: 'Lounge',
    kind: 'channel',
    avatarLabel: '#',
    presence: 'Everyone welcome',
    preview: 'Jordan: The new invite flow feels great.',
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
    title: 'Jordan Lee',
    kind: 'direct',
    avatarLabel: 'JL',
    presence: 'Online now',
    preview: 'Let’s review the next milestone.',
    updatedAt: '9:18 AM',
    unreadCount: 0,
    encrypted: true,
    members: 2,
  },
  {
    id: 'design',
    title: 'Design notes',
    kind: 'channel',
    avatarLabel: '✦',
    presence: '5 members',
    preview: 'Maya shared a new accessibility checklist.',
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
    title: 'Huddle',
    kind: 'channel',
    avatarLabel: '◉',
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
      senderId: 'jordan',
      senderName: 'Jordan Lee',
      senderInitials: 'JL',
      body: 'Welcome to the Scuttlebutt lounge. This is a safe place to share progress, questions, and tiny wins.',
      sentAt: '10:26 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [],
      reactions: { '👋': 4, '💛': 2 },
    },
    {
      id: 'lounge-2',
      senderId: 'maya',
      senderName: 'Maya Chen',
      senderInitials: 'MC',
      body: 'The new friend-code language is much easier to explain. “Share a code, approve a connection” is a keeper.',
      sentAt: '10:31 AM',
      status: 'sent',
      edited: false,
      own: false,
      attachments: [],
      reactions: { '✨': 3 },
    },
    {
      id: 'lounge-3',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderInitials: currentUser.initials,
      body: 'Agreed. I’m wiring the message surface next so the privacy boundary stays visible in the product.',
      sentAt: '10:38 AM',
      status: 'sent',
      edited: false,
      own: true,
      attachments: [],
      reactions: { '🚀': 1 },
    },
    {
      id: 'lounge-4',
      senderId: 'jordan',
      senderName: 'Jordan Lee',
      senderInitials: 'JL',
      body: 'The new invite flow feels great. Next up: making the timeline feel just as calm.',
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
      senderId: 'jordan',
      senderName: 'Jordan Lee',
      senderInitials: 'JL',
      body: 'I pulled together the Phase 4 notes. Want to review the conversation states this afternoon?',
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
      senderId: 'maya',
      senderName: 'Maya Chen',
      senderInitials: 'MC',
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
};

function cloneMessage(message: Message): Message {
  return {
    ...message,
    attachments: [...message.attachments],
    reactions: { ...message.reactions },
    replyTo: message.replyTo ? { ...message.replyTo } : undefined,
  };
}

export function createDemoMessagingRepository(): MessagingRepository {
  const conversations = initialConversations.map((conversation) => ({ ...conversation }));
  const messages = Object.fromEntries(
    Object.entries(initialMessages).map(([conversationId, conversationMessages]) => [
      conversationId,
      conversationMessages.map(cloneMessage),
    ]),
  ) as Record<string, Message[]>;

  return {
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
      message.reactions[emoji] = (message.reactions[emoji] ?? 0) + 1;
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
