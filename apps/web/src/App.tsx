import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  ArrowClockwise,
  Bell,
  CaretDown,
  ChatCenteredDots,
  Code,
  Compass,
  Desktop,
  FileText,
  GearSix,
  Hash,
  Headphones,
  House,
  Leaf,
  LockSimple,
  MagnifyingGlass,
  Microphone,
  Mountains,
  Paperclip,
  PaperPlaneRight,
  PencilSimple,
  Planet,
  Plus,
  PushPin,
  Smiley,
  SpeakerHigh,
  Star,
  Trash,
  Users,
  Waveform,
  X,
} from '@phosphor-icons/react';
import { APP_NAME } from '@scuttlebutt/shared-types';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

import { DEMO_COMMUNITY } from './community.js';
import {
  createDemoMessagingRepository,
  type AttachmentDraft,
  type Conversation,
  type Message,
  type MessagingRepository,
  type ReplyReference,
} from './messaging.js';
import { mentionPattern, type MentionReference } from './mentions.js';
import type { PresenceIndicatorStatus } from './presence.js';
import { VoicePreviewPanel } from './voice-preview.js';
import { MediaPicker, type MediaAsset } from './media-picker.js';

interface AppProps {
  repository?: MessagingRepository;
}

interface Notice {
  tone: 'error' | 'info';
  text: string;
}

interface RenderableEmote {
  dataUrl: string;
  id: string;
  name: string;
}

interface Member {
  avatar: string;
  name: string;
  note: string;
  status: PresenceIndicatorStatus;
}

const DRAFT_STORAGE_PREFIX = 'scuttlebutt:draft:';
const QUICK_REACTIONS = ['❤️', '👍', '✨'];

const AVATARS = {
  alex: '/avatars/alex-rivers.webp',
  fahad: '/avatars/alex-rivers.webp',
  jordan: '/avatars/jordan-park.webp',
  maya: '/avatars/maya-patel.webp',
  priya: '/avatars/priya-shah.webp',
  sam: '/avatars/sam-lee.webp',
  taylor: '/avatars/taylor-nguyen.webp',
};

const TEXT_CHANNELS = [
  { conversationId: 'welcome', name: 'announcements' },
  { conversationId: 'lounge', name: 'general' },
  { conversationId: 'lounge', name: 'engineering' },
  { conversationId: 'design', name: 'product-design' },
  { conversationId: 'design', name: 'random' },
];

const MEMBERS: Member[] = [
  { avatar: AVATARS.alex, name: 'Alex Rivers', note: 'Owner', status: 'online' },
  { avatar: AVATARS.maya, name: 'Maya Patel', note: 'Online', status: 'online' },
  { avatar: AVATARS.sam, name: 'Sam Lee', note: 'Online', status: 'online' },
  { avatar: AVATARS.priya, name: 'Priya Shah', note: 'Online', status: 'online' },
  { avatar: AVATARS.jordan, name: 'Jordan Park', note: 'Online', status: 'online' },
  { avatar: AVATARS.taylor, name: 'Taylor Nguyen', note: 'Idle', status: 'idle' },
  { avatar: AVATARS.jordan, name: 'Chris Diaz', note: 'Idle', status: 'idle' },
  { avatar: AVATARS.sam, name: 'Riley Chen', note: 'Offline', status: 'offline' },
];

function avatarForMessage(message: Message): string {
  void message;
  return '';
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function parseMediaReaction(
  value: string,
): { kind: 'gif' | 'sticker'; url: string; previewUrl: string } | undefined {
  if (!value.startsWith('media:')) return undefined;
  const [kind, encodedUrl, encodedPreview] = value.slice('media:'.length).split(':');
  if ((kind !== 'gif' && kind !== 'sticker') || !encodedUrl) return undefined;
  try {
    const url = decodeURIComponent(encodedUrl);
    return {
      kind,
      previewUrl: encodedPreview ? decodeURIComponent(encodedPreview) : url,
      url,
    };
  } catch {
    return undefined;
  }
}

function reactionValueForAsset(asset: MediaAsset): string | undefined {
  if (asset.value) return asset.value;
  if (!asset.url || (asset.kind !== 'gif' && asset.kind !== 'sticker')) return undefined;
  return `media:${asset.kind}:${encodeURIComponent(asset.url)}:${encodeURIComponent(asset.previewUrl ?? asset.url)}`;
}

function renderTextWithMentions(value: string, mentions: MentionReference[]): ReactNode {
  const pattern = mentionPattern(mentions);
  if (!pattern) return value;
  const mentionIds = new Map(mentions.map(({ id, name }) => [name.trim().toLocaleLowerCase(), id]));
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const leading = match[1] ?? '';
    const mentionText = match[2] ?? '';
    const mentionStart = match.index + leading.length;
    if (mentionStart > lastIndex) {
      nodes.push(value.slice(lastIndex, mentionStart));
    }
    const mentionName = mentionText.slice(1).toLocaleLowerCase();
    nodes.push(
      <span
        className="message-mention"
        data-user-id={mentionIds.get(mentionName)}
        key={`${mentionText}-${mentionStart}`}
        title={`Mentioned ${mentionText.slice(1)}`}
      >
        {mentionText}
      </span>,
    );
    lastIndex = mentionStart + mentionText.length;
  }
  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}

function renderMessageBody(body: string, emotes: RenderableEmote[], mentions: MentionReference[]) {
  return (body || ' ').split(/(:[a-z0-9_-]+:)/gi).map((part, index) => {
    const emote = emotes.find(({ name }) => `:${name}:`.toLowerCase() === part.toLowerCase());
    return emote ? (
      <img
        className="message-custom-emote"
        src={emote.dataUrl}
        alt={`:${emote.name}:`}
        key={`${emote.id}-${index}`}
      />
    ) : (
      <span key={`${part}-${index}`}>{renderTextWithMentions(part, mentions)}</span>
    );
  });
}

function IconButton({
  children,
  label,
  onClick,
  pressed,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}

export function PersonAvatar({
  image,
  name,
  status,
  size = 'medium',
}: {
  image?: string | null;
  name: string;
  status?: PresenceIndicatorStatus;
  size?: 'large' | 'medium' | 'small';
}) {
  return (
    <span className={`person-avatar person-avatar-${size}`}>
      {image ? (
        <img src={image} alt="" />
      ) : (
        <span className="person-avatar-fallback" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      {status ? <span className={`presence-dot presence-${status}`} aria-label={status} /> : null}
      <span className="visually-hidden">{name}</span>
    </span>
  );
}

export function MessageRow({
  avatar,
  emotes = [],
  message,
  onDelete,
  onEdit,
  onReact,
  onReply,
  onRetry,
}: {
  avatar?: string;
  emotes?: RenderableEmote[];
  message: Message;
  onDelete: (message: Message) => void;
  onEdit: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
}) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{
    left: number;
    top: number;
  }>();
  const reactionAnchorRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  const positionReactionPicker = useCallback((height = 430, width = 500) => {
    const anchor = reactionAnchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const gutter = 12;
    const gap = 8;
    const left = Math.max(gutter, Math.min(anchor.left, window.innerWidth - width - gutter));
    const above = anchor.top - height - gap;
    const below = anchor.bottom + gap;
    const top =
      above >= gutter
        ? above
        : below + height <= window.innerHeight - gutter
          ? below
          : Math.max(gutter, window.innerHeight - height - gutter);
    setReactionPickerPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!reactionPickerOpen) return undefined;
    const reposition = () => {
      const picker = reactionPickerRef.current;
      positionReactionPicker(picker?.offsetHeight ?? 430, picker?.offsetWidth ?? 500);
    };
    reposition();
    const frame = window.requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [positionReactionPicker, reactionPickerOpen]);

  const toggleReactionPicker = () => {
    if (reactionPickerOpen) {
      setReactionPickerOpen(false);
      return;
    }
    positionReactionPicker();
    setReactionPickerOpen(true);
  };

  return (
    <article
      className={`message-row ${message.own ? 'message-row-own' : ''}`}
      data-testid={E2E_SELECTORS.message}
      data-message-id={message.id}
    >
      <PersonAvatar
        image={message.own && avatar ? avatar : (message.senderAvatar ?? avatarForMessage(message))}
        name={message.senderName}
        status="online"
      />
      <div className="message-content">
        <div className="message-heading">
          <strong>{message.senderName}</strong>
          <time>{message.sentAt}</time>
          {message.edited ? <span className="message-edited">edited</span> : null}
        </div>
        {message.replyTo ? (
          <div className="reply-snippet" aria-label={`Replying to ${message.replyTo.author}`}>
            <strong>{message.replyTo.author}</strong>
            <span>{message.replyTo.body}</span>
          </div>
        ) : null}
        <p className="message-body">
          {renderMessageBody(message.body, emotes, message.mentions ?? [])}
        </p>
        {message.attachments.length > 0 ? (
          <div className="message-attachments" aria-label="Message attachments">
            {message.attachments.map((attachment) =>
              attachment.url ? (
                <a
                  className="message-attachment message-media-attachment"
                  href={attachment.url}
                  key={attachment.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <img
                    src={attachment.previewUrl ?? attachment.url}
                    alt={attachment.alt ?? attachment.name}
                    loading="lazy"
                  />
                  <span>
                    <strong>{attachment.name}</strong>
                    <small>
                      {attachment.source ?? (attachment.kind === 'sticker' ? 'Sticker' : 'GIF')}
                    </small>
                  </span>
                </a>
              ) : (
                <div className="message-attachment" key={attachment.id}>
                  <span className="attachment-icon" aria-hidden="true">
                    {attachment.mimeType.includes('code') || attachment.name.endsWith('.md') ? (
                      <Code size={20} weight="duotone" />
                    ) : (
                      <FileText size={20} weight="duotone" />
                    )}
                  </span>
                  <span>
                    <strong>{attachment.name}</strong>
                    <small>{formatFileSize(attachment.size)}</small>
                  </span>
                </div>
              ),
            )}
          </div>
        ) : null}
        <div className="message-actions">
          <button
            type="button"
            onClick={() => onReply(message)}
            aria-label={`Reply to ${message.senderName}`}
            title={`Reply to ${message.senderName}`}
          >
            <ChatCenteredDots size={15} />
            Reply
          </button>
          {QUICK_REACTIONS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className="emoji-action"
              onClick={() => onReact(message, emoji)}
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {emotes.slice(0, 3).map((emote) => (
            <button
              type="button"
              key={emote.id}
              className="emoji-action custom-emote-action"
              onClick={() => onReact(message, `:${emote.name}:`)}
              aria-label={`React with ${emote.name}`}
              title={`:${emote.name}:`}
            >
              <img src={emote.dataUrl} alt="" />
            </button>
          ))}
          <div className="message-reaction-trigger-wrap" ref={reactionAnchorRef}>
            <button
              type="button"
              className="message-reaction-trigger"
              aria-label="Add reaction"
              aria-expanded={reactionPickerOpen}
              title="Add reaction"
              onClick={toggleReactionPicker}
            >
              <Smiley size={15} />
            </button>
          </div>
          {message.own ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(message)}
                aria-label="Edit message"
                title="Edit message"
              >
                <PencilSimple size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(message)}
                aria-label="Delete message"
                title="Delete message"
              >
                <Trash size={15} />
              </button>
            </>
          ) : null}
        </div>
        <div className="reaction-list" aria-label="Message reactions">
          {Object.entries(message.reactions).map(([emoji, count]) =>
            (() => {
              const reactors = message.reactionUsers?.[emoji] ?? [];
              const reactorNames = reactors.map(({ name }) => name).filter(Boolean);
              const reactionTitle = reactorNames.length
                ? `${reactorNames.join(', ')} reacted with ${emoji}`
                : `${count} reaction${count === 1 ? '' : 's'}`;
              return (
                <button
                  type="button"
                  className="reaction-pill"
                  key={emoji}
                  onClick={() => onReact(message, emoji)}
                  aria-label={reactionTitle}
                  title={reactionTitle}
                >
                  {(() => {
                    const mediaReaction = parseMediaReaction(emoji);
                    const emote = emotes.find(({ name }) => `:${name}:` === emoji);
                    if (mediaReaction) {
                      return (
                        <img
                          className="reaction-media-image"
                          src={mediaReaction.previewUrl}
                          alt={`Shared ${mediaReaction.kind}`}
                        />
                      );
                    }
                    return emote ? <img src={emote.dataUrl} alt={emoji} /> : emoji;
                  })()}{' '}
                  <span>{count}</span>
                </button>
              );
            })(),
          )}
        </div>
        {message.status === 'failed' ? (
          <div className="message-failure" role="alert">
            <span>Not sent</span>
            <button type="button" onClick={() => onRetry(message)}>
              <ArrowClockwise size={14} /> Retry
            </button>
          </div>
        ) : null}
      </div>
      {reactionPickerOpen && reactionPickerPosition
        ? createPortal(
            <div
              ref={reactionPickerRef}
              className="reaction-picker-popover"
              style={{ left: reactionPickerPosition.left, top: reactionPickerPosition.top }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <MediaPicker
                emotes={emotes}
                initialTab="emoji"
                onSelect={(asset) => {
                  const value = reactionValueForAsset(asset);
                  if (value) onReact(message, value);
                  setReactionPickerOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}

export function App({ repository: repositoryProp }: AppProps = {}) {
  const [repository] = useState<MessagingRepository>(
    () => repositoryProp ?? createDemoMessagingRepository(),
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState('');
  const [search, setSearch] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyReference>();
  const [editingMessage, setEditingMessage] = useState<Message>();
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [notice, setNotice] = useState<Notice>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [membersVisible, setMembersVisible] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeChannelAlias, setActiveChannelAlias] = useState('engineering');

  const selectedConversation = conversations.find(({ id }) => id === selectedConversationId);
  const directMessages = conversations.filter(({ kind }) => kind === 'direct');
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) =>
      `${message.senderName} ${message.body}`.toLowerCase().includes(query),
    );
  }, [messages, search]);

  useEffect(() => {
    let mounted = true;
    void repository.getConversations().then((nextConversations) => {
      if (!mounted) return;
      setConversations(nextConversations);
      setSelectedConversationId(
        nextConversations.find(({ id }) => id === 'lounge')?.id ?? nextConversations[0]?.id ?? '',
      );
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [repository]);

  useEffect(() => {
    if (!selectedConversationId) return;
    let mounted = true;
    setIsLoading(true);
    void Promise.all([
      repository.getMessages(selectedConversationId),
      repository.markRead(selectedConversationId),
    ]).then(([nextMessages]) => {
      if (!mounted) return;
      setMessages(nextMessages);
      setIsLoading(false);
      void repository.getConversations().then(setConversations);
    });
    return () => {
      mounted = false;
    };
  }, [repository, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || typeof window === 'undefined') return;
    setComposer(
      window.localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${selectedConversationId}`) ?? '',
    );
    setReplyTo(undefined);
    setEditingMessage(undefined);
    setAttachments([]);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || typeof window === 'undefined') return;
    const storageKey = `${DRAFT_STORAGE_PREFIX}${selectedConversationId}`;
    if (composer) window.localStorage.setItem(storageKey, composer);
    else window.localStorage.removeItem(storageKey);
  }, [composer, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    void repository.setTyping(selectedConversationId, composer.trim().length > 0);
  }, [composer, repository, selectedConversationId]);

  const selectConversation = (conversationId: string, channelAlias?: string) => {
    setSelectedConversationId(conversationId);
    if (channelAlias) setActiveChannelAlias(channelAlias);
    setSearch('');
    setNotice(undefined);
  };

  const refreshMessages = async () => {
    if (selectedConversationId) setMessages(await repository.getMessages(selectedConversationId));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversationId || (!composer.trim() && attachments.length === 0) || isSending)
      return;
    setIsSending(true);
    try {
      if (editingMessage) {
        await repository.editMessage(selectedConversationId, editingMessage.id, composer.trim());
        setNotice({ tone: 'info', text: 'Message updated.' });
      } else {
        await repository.sendMessage(selectedConversationId, composer.trim(), {
          attachments,
          replyTo,
        });
        setNotice({ tone: 'info', text: 'Message sent.' });
      }
      setComposer('');
      setAttachments([]);
      setReplyTo(undefined);
      setEditingMessage(undefined);
      await refreshMessages();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Message could not be sent.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    setAttachments((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      })),
    ]);
    event.currentTarget.value = '';
  };

  const handleDelete = async (message: Message) => {
    if (!selectedConversationId) return;
    await repository.deleteMessage(selectedConversationId, message.id);
    setNotice({ tone: 'info', text: 'Message deleted.' });
    await refreshMessages();
  };

  const handleReact = async (message: Message, emoji: string) => {
    if (!selectedConversationId) return;
    await repository.reactToMessage(selectedConversationId, message.id, emoji);
    await refreshMessages();
  };

  const activeChannelName =
    selectedConversation?.kind === 'direct'
      ? selectedConversation.title
      : selectedConversation?.channelKind === 'voice'
        ? selectedConversation.title
        : activeChannelAlias;

  return (
    <main className="app-shell" data-testid={E2E_SELECTORS.appShell}>
      <section className={`app-window ${membersVisible ? '' : 'members-collapsed'}`}>
        <aside className="server-rail" aria-label="Communities">
          <button
            type="button"
            className="server-mark server-mark-brand"
            aria-label="Scuttlebutt home"
          >
            <img src="/scuttlebutt-mark.webp" alt="" />
            <span className="visually-hidden">{APP_NAME}</span>
          </button>
          <div className="server-rail-divider" />
          <button
            type="button"
            className="server-mark server-mark-active"
            aria-label="Scuttlebutt Labs"
          >
            <ChatCenteredDots size={24} weight="duotone" />
          </button>
          <button type="button" className="server-mark" aria-label="Orbit community">
            <Planet size={24} weight="duotone" />
          </button>
          <button type="button" className="server-mark" aria-label="Garden community">
            <Leaf size={24} weight="duotone" />
          </button>
          <button type="button" className="server-mark" aria-label="Summit community">
            <Mountains size={24} weight="duotone" />
          </button>
          <button
            type="button"
            className="server-mark server-mark-add"
            aria-label="Create or join a community"
            onClick={() =>
              setNotice({ tone: 'info', text: 'Community creation is ready for backend wiring.' })
            }
          >
            <Plus size={23} />
          </button>
          <button
            type="button"
            className="server-mark server-mark-explore"
            aria-label="Explore communities"
          >
            <Compass size={22} />
          </button>
        </aside>

        <aside className="workspace-sidebar" aria-label="Workspace navigation">
          <header className="workspace-titlebar">
            <div>
              <strong>Scuttlebutt Labs</strong>
              <span>{DEMO_COMMUNITY.description}</span>
            </div>
            <CaretDown size={17} />
          </header>

          <div className="workspace-trust-row">
            <span>
              <span className="status-dot" />
              Local server
            </span>
            <span>
              <LockSimple size={14} weight="bold" />
              Encrypted
            </span>
          </div>

          <div className="workspace-scroll">
            <nav className="primary-nav" aria-label="Workspace destinations">
              <button type="button" className="primary-nav-item primary-nav-item-active">
                <House size={19} weight="fill" /> Home
              </button>
              <button
                type="button"
                className="primary-nav-item"
                onClick={() => setNotice({ tone: 'info', text: 'Thread inbox opened.' })}
              >
                <ChatCenteredDots size={19} /> Threads
              </button>
            </nav>

            <div className="nav-section">
              <div className="nav-section-heading">
                <span>Direct messages</span>
                <button type="button" aria-label="Start a direct message">
                  <Plus size={16} />
                </button>
              </div>
              <div className="dm-list" data-testid={E2E_SELECTORS.conversationList}>
                {directMessages.map((conversation) => (
                  <button
                    type="button"
                    className={`dm-button ${conversation.id === selectedConversationId ? 'dm-button-active' : ''}`}
                    key={conversation.id}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <PersonAvatar
                      image={
                        conversation.title.toLowerCase().includes('maya')
                          ? AVATARS.maya
                          : AVATARS.jordan
                      }
                      name={conversation.title}
                      status="online"
                      size="small"
                    />
                    <span>{conversation.title}</span>
                    {conversation.unreadCount > 0 ? (
                      <strong>{conversation.unreadCount}</strong>
                    ) : null}
                  </button>
                ))}
                <button
                  type="button"
                  className="dm-button"
                  onClick={() =>
                    setNotice({
                      tone: 'info',
                      text: 'Group conversations are ready for persistence.',
                    })
                  }
                >
                  <span className="group-avatar">
                    <Users size={15} />
                  </span>
                  <span>Dev Team</span>
                  <small>4 members</small>
                </button>
              </div>
            </div>

            <div className="community-heading">
              <span>Scuttlebutt Labs</span>
              <CaretDown size={14} />
              <button type="button" aria-label="Add a community channel">
                <Plus size={16} />
              </button>
            </div>

            <div className="nav-section channel-section">
              <div className="nav-section-heading">
                <span>Text channels</span>
                <button type="button" aria-label="Add a text channel">
                  <Plus size={16} />
                </button>
              </div>
              {TEXT_CHANNELS.map((channel) => {
                const active =
                  selectedConversationId === channel.conversationId &&
                  activeChannelAlias === channel.name;
                return (
                  <button
                    type="button"
                    key={channel.name}
                    className={`channel-button ${active ? 'channel-button-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      selectConversation(channel.conversationId, channel.name);
                      if (channel.name === 'engineering' || channel.name === 'general') {
                        setNotice(undefined);
                      }
                    }}
                  >
                    <Hash size={18} weight={active ? 'bold' : 'regular'} />
                    <span>{channel.name}</span>
                    {channel.name === 'engineering' ? <span className="channel-unread" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="nav-section channel-section voice-section">
              <div className="nav-section-heading">
                <span>Voice channels</span>
                <button type="button" aria-label="Add a voice channel">
                  <Plus size={16} />
                </button>
              </div>
              <div className="voice-channel-card">
                <button
                  type="button"
                  className="voice-channel-name"
                  onClick={() => selectConversation('huddle', 'Engineering Room')}
                >
                  <SpeakerHigh size={18} weight="fill" />
                  <span>
                    <strong>Engineering Room</strong>
                    <small>Maya, Alex, Sam</small>
                  </span>
                  <Users size={15} />
                  <b>3</b>
                </button>
                <div className="voice-channel-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setNotice({
                        tone: 'info',
                        text: '4K streaming selected. Actual quality adapts to bandwidth and device support.',
                      })
                    }
                  >
                    <Desktop size={15} /> Stream 4K
                  </button>
                  <button
                    type="button"
                    onClick={() => selectConversation('huddle', 'Engineering Room')}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </div>

          <footer className="user-panel">
            <button
              type="button"
              className="user-identity"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
            >
              <PersonAvatar image={AVATARS.alex} name="Alex Rivers" status="online" />
              <span>
                <strong>Alex Rivers</strong>
                <small>Online</small>
              </span>
            </button>
            <IconButton label="Mute microphone">
              <Microphone size={18} />
            </IconButton>
            <IconButton label="Deafen">
              <Headphones size={18} />
            </IconButton>
            <IconButton label="User settings">
              <GearSix size={18} />
            </IconButton>
            {profileOpen ? (
              <div className="profile-popover" role="dialog" aria-label="Profile menu">
                <strong>Alex Rivers</strong>
                <span>Demo account</span>
                <button type="button">Connect Google account</button>
              </div>
            ) : null}
          </footer>
        </aside>

        <section className="conversation-main" aria-label="Active conversation">
          <header className="conversation-header">
            <div className="conversation-header-title">
              {selectedConversation?.kind === 'direct' ? (
                <PersonAvatar
                  image={AVATARS.maya}
                  name={selectedConversation.title}
                  status="online"
                  size="small"
                />
              ) : (
                <Hash size={23} weight="bold" />
              )}
              <div>
                <div className="conversation-title-line">
                  <h1>
                    {selectedConversation?.kind === 'direct'
                      ? selectedConversation.title
                      : activeChannelName}
                  </h1>
                  {selectedConversation?.kind !== 'direct' ? (
                    <Star size={17} weight="fill" />
                  ) : null}
                </div>
                <p>
                  {selectedConversation?.kind === 'direct'
                    ? selectedConversation.presence
                    : 'Build, ship, and improve Scuttlebutt.'}
                </p>
              </div>
            </div>
            <div className="conversation-header-actions">
              <IconButton label="Notifications">
                <Bell size={19} />
              </IconButton>
              <IconButton label="Pinned messages">
                <PushPin size={19} />
              </IconButton>
              <button
                type="button"
                className="member-count-button"
                onClick={() => setMembersVisible((visible) => !visible)}
                aria-pressed={membersVisible}
              >
                <Users size={19} /> 12
              </button>
              <label className="header-search">
                <MagnifyingGlass size={18} />
                <span className="visually-hidden">Search this conversation</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                />
                <kbd>/</kbd>
              </label>
            </div>
          </header>

          <div className="conversation-body">
            <div
              className="timeline"
              data-testid={E2E_SELECTORS.timeline}
              role="log"
              aria-live="polite"
              aria-label="Message timeline"
            >
              {selectedConversation?.channelKind === 'voice' ? (
                <VoicePreviewPanel
                  localUser={{
                    avatar: '/scuttlebutt-mark.webp',
                    identity: 'local-user',
                    name: 'Local user',
                  }}
                  roomName={selectedConversation.voiceRoomId ?? selectedConversation.id}
                />
              ) : (
                <>
                  {isLoading ? <p className="timeline-state">Loading messages…</p> : null}
                  {!isLoading && filteredMessages.length === 0 ? (
                    <p className="timeline-state">No messages match this search.</p>
                  ) : null}
                  {!isLoading && filteredMessages.length > 0 ? (
                    <div className="date-divider">
                      <span>Today</span>
                    </div>
                  ) : null}
                  {filteredMessages.map((message) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      onDelete={(nextMessage) => void handleDelete(nextMessage)}
                      onEdit={(nextMessage) => {
                        setEditingMessage(nextMessage);
                        setReplyTo(undefined);
                        setComposer(nextMessage.body);
                      }}
                      onReact={(nextMessage, emoji) => void handleReact(nextMessage, emoji)}
                      onReply={(nextMessage) =>
                        setReplyTo({
                          id: nextMessage.id,
                          author: nextMessage.senderName,
                          body: nextMessage.body,
                        })
                      }
                      onRetry={(nextMessage) =>
                        void repository
                          .retryMessage(selectedConversationId, nextMessage.id)
                          .then(refreshMessages)
                      }
                    />
                  ))}
                  <div className="typing-indicator" aria-live="polite">
                    {composer.trim() && !editingMessage ? (
                      <>
                        <Waveform size={15} /> You’re typing a reply
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {notice ? (
              <p
                className={`notice notice-${notice.tone}`}
                role={notice.tone === 'error' ? 'alert' : 'status'}
              >
                {notice.text}
              </p>
            ) : null}

            {selectedConversation?.channelKind === 'voice' ? null : (
              <form
                className="composer-shell"
                data-testid={E2E_SELECTORS.composer}
                onSubmit={(event) => void handleSubmit(event)}
              >
                {editingMessage || replyTo ? (
                  <div className="composer-context">
                    <span>
                      <strong>
                        {editingMessage ? 'Editing message' : `Replying to ${replyTo?.author}`}
                      </strong>
                      {replyTo ? ` · ${replyTo.body}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessage(undefined);
                        setReplyTo(undefined);
                        if (editingMessage) setComposer('');
                      }}
                      aria-label="Cancel composer context"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : null}
                {attachments.length > 0 ? (
                  <div className="attachment-draft-list" aria-label="Attachments ready to send">
                    {attachments.map((attachment) => (
                      <span className="attachment-chip" key={attachment.id}>
                        <FileText size={15} /> {attachment.name}{' '}
                        <small>{formatFileSize(attachment.size)}</small>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((current) =>
                              current.filter(({ id }) => id !== attachment.id),
                            )
                          }
                          aria-label={`Remove ${attachment.name}`}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <label className="composer-input-wrap" htmlFor="message-composer-input">
                  <span className="visually-hidden">Write a message</span>
                  <textarea
                    id="message-composer-input"
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Message #${activeChannelName}`}
                    rows={1}
                    disabled={!selectedConversationId || isLoading}
                  />
                </label>
                <div className="composer-footer">
                  <div className="composer-tools">
                    <label className="composer-tool" title="Attach files">
                      <Plus size={20} />
                      <span className="visually-hidden">Attach files</span>
                      <input type="file" multiple onChange={handleFiles} />
                    </label>
                    <button type="button" className="composer-tool" aria-label="Formatting">
                      <span>Aa</span>
                    </button>
                    <button type="button" className="composer-tool" aria-label="Mention someone">
                      <strong>@</strong>
                    </button>
                    <button type="button" className="composer-tool" aria-label="Code snippet">
                      <Code size={19} />
                    </button>
                    <label className="composer-tool" title="Attach a file">
                      <Paperclip size={19} />
                      <span className="visually-hidden">Attach a file</span>
                      <input type="file" onChange={handleFiles} />
                    </label>
                  </div>
                  <div className="composer-submit-group">
                    <button type="button" className="composer-tool" aria-label="Add emoji">
                      <Smiley size={19} />
                    </button>
                    <button
                      type="submit"
                      className="send-button"
                      data-testid={E2E_SELECTORS.sendMessage}
                      disabled={isSending || (!composer.trim() && attachments.length === 0)}
                      aria-label="Send message"
                    >
                      <PaperPlaneRight size={20} weight="fill" />
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>

        {membersVisible ? (
          <aside className="members-sidebar" aria-label="Community members">
            <MemberGroup
              title="Online"
              count={5}
              members={MEMBERS.filter(({ status }) => status === 'online')}
            />
            <MemberGroup
              title="Idle"
              count={2}
              members={MEMBERS.filter(({ status }) => status === 'idle')}
            />
            <MemberGroup
              title="Offline"
              count={2}
              members={MEMBERS.filter(({ status }) => status === 'offline')}
            />
            <button
              type="button"
              className="invite-button"
              onClick={() =>
                setNotice({
                  tone: 'info',
                  text: 'Invite creation is ready for the friend-code API.',
                })
              }
            >
              <Users size={17} /> Invite members
            </button>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function MemberGroup({
  count,
  members,
  title,
}: {
  count: number;
  members: Member[];
  title: string;
}) {
  return (
    <section className="member-group">
      <h2>
        {title} — {count}
      </h2>
      <div className="member-list">
        {members.map((member) => (
          <button type="button" className={`member-row member-${member.status}`} key={member.name}>
            <PersonAvatar image={member.avatar} name={member.name} status={member.status} />
            <span>
              <strong>{member.name}</strong>
              <small>{member.note}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
