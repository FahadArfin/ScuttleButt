import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { APP_NAME } from '@scuttlebutt/shared-types';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

import {
  createDemoMessagingRepository,
  type AttachmentDraft,
  type Conversation,
  type Message,
  type MessagingRepository,
  type ReplyReference,
} from './messaging.js';

interface AppProps {
  repository?: MessagingRepository;
}

interface Notice {
  tone: 'error' | 'info';
  text: string;
}

const DRAFT_STORAGE_PREFIX = 'scuttlebutt:draft:';
const QUICK_REACTIONS = ['❤️', '👍', '✨'];

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageRow({
  message,
  onDelete,
  onEdit,
  onReact,
  onReply,
  onRetry,
}: {
  message: Message;
  onDelete: (message: Message) => void;
  onEdit: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
}) {
  return (
    <article
      className={`message-row ${message.own ? 'message-row-own' : ''}`}
      data-testid={E2E_SELECTORS.message}
      data-message-id={message.id}
    >
      <div className="message-avatar" aria-hidden="true">
        {message.senderInitials}
      </div>
      <div className="message-content">
        <div className="message-heading">
          <strong>{message.senderName}</strong>
          <time>{message.sentAt}</time>
          {message.edited ? <span className="message-edited">edited</span> : null}
        </div>
        {message.replyTo ? (
          <div className="reply-snippet" aria-label={`Replying to ${message.replyTo.author}`}>
            <span>{message.replyTo.author}</span>
            <p>{message.replyTo.body}</p>
          </div>
        ) : null}
        <div className="message-bubble">
          <p>{message.body || ' '}</p>
          {message.attachments.length > 0 ? (
            <div className="message-attachments" aria-label="Message attachments">
              {message.attachments.map((attachment) => (
                <div className="message-attachment" key={attachment.id}>
                  <span className="attachment-icon" aria-hidden="true">
                    ↗
                  </span>
                  <span>
                    <strong>{attachment.name}</strong>
                    <small>{formatFileSize(attachment.size)}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="message-actions">
          <button
            type="button"
            onClick={() => onReply(message)}
            aria-label={`Reply to ${message.senderName}`}
          >
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
          {message.own ? (
            <>
              <button type="button" onClick={() => onEdit(message)} aria-label="Edit message">
                Edit
              </button>
              <button type="button" onClick={() => onDelete(message)} aria-label="Delete message">
                Delete
              </button>
            </>
          ) : null}
        </div>
        {Object.keys(message.reactions).length > 0 ? (
          <div className="reaction-list" aria-label="Message reactions">
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <button
                type="button"
                className="reaction-pill"
                key={emoji}
                onClick={() => onReact(message, emoji)}
              >
                {emoji} <span>{count}</span>
              </button>
            ))}
          </div>
        ) : null}
        {message.status === 'failed' ? (
          <div className="message-failure" role="alert">
            <span>Not sent</span>
            <button type="button" onClick={() => onRetry(message)}>
              Retry
            </button>
          </div>
        ) : message.own ? (
          <span className="message-delivery">Delivered</span>
        ) : null}
      </div>
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

  const selectedConversation = conversations.find(({ id }) => id === selectedConversationId);
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return messages;
    }
    return messages.filter((message) =>
      `${message.senderName} ${message.body}`.toLowerCase().includes(query),
    );
  }, [messages, search]);

  useEffect(() => {
    let mounted = true;
    void repository.getConversations().then((nextConversations) => {
      if (!mounted) {
        return;
      }
      setConversations(nextConversations);
      setSelectedConversationId(nextConversations[0]?.id ?? '');
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [repository]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }
    let mounted = true;
    setIsLoading(true);
    void Promise.all([
      repository.getMessages(selectedConversationId),
      repository.markRead(selectedConversationId),
    ]).then(([nextMessages]) => {
      if (!mounted) {
        return;
      }
      setMessages(nextMessages);
      setIsLoading(false);
      void repository.getConversations().then(setConversations);
    });
    return () => {
      mounted = false;
    };
  }, [repository, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || typeof window === 'undefined') {
      return;
    }
    setComposer(
      window.localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${selectedConversationId}`) ?? '',
    );
    setReplyTo(undefined);
    setEditingMessage(undefined);
    setAttachments([]);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || typeof window === 'undefined') {
      return;
    }
    const storageKey = `${DRAFT_STORAGE_PREFIX}${selectedConversationId}`;
    if (composer) {
      window.localStorage.setItem(storageKey, composer);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }, [composer, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }
    void repository.setTyping(selectedConversationId, composer.trim().length > 0);
  }, [composer, repository, selectedConversationId]);

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setSearch('');
    setNotice(undefined);
  };

  const refreshMessages = async () => {
    if (!selectedConversationId) {
      return;
    }
    setMessages(await repository.getMessages(selectedConversationId));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversationId || (!composer.trim() && attachments.length === 0) || isSending) {
      return;
    }

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
    if (!selectedConversationId) {
      return;
    }
    await repository.deleteMessage(selectedConversationId, message.id);
    setNotice({ tone: 'info', text: 'Message deleted.' });
    await refreshMessages();
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyTo(undefined);
    setComposer(message.body);
  };

  const handleReact = async (message: Message, emoji: string) => {
    if (!selectedConversationId) {
      return;
    }
    await repository.reactToMessage(selectedConversationId, message.id, emoji);
    await refreshMessages();
  };

  const handleRetry = async (message: Message) => {
    if (!selectedConversationId) {
      return;
    }
    await repository.retryMessage(selectedConversationId, message.id);
    setNotice({ tone: 'info', text: 'Message sent.' });
    await refreshMessages();
  };

  return (
    <main className="app-shell" data-testid={E2E_SELECTORS.appShell}>
      <header className="app-topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            S
          </div>
          <div>
            <p className="brand-name">{APP_NAME}</p>
            <p className="brand-context">Private conversations, your infrastructure</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="connection-pill">
            <span className="connection-dot" aria-hidden="true" />
            Local workspace
          </span>
          <button type="button" className="avatar-button" aria-label="Open your profile">
            FA
          </button>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="conversation-sidebar" aria-label="Conversations">
          <div className="sidebar-heading">
            <div>
              <p className="section-kicker">Workspace</p>
              <h2>Messages</h2>
            </div>
            <button
              type="button"
              className="new-conversation-button"
              aria-label="Start a new conversation"
              onClick={() =>
                setNotice({
                  tone: 'info',
                  text: 'Friend-code invites will create new conversations here.',
                })
              }
            >
              +
            </button>
          </div>
          <label className="search-field">
            <span className="visually-hidden">Search conversations</span>
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages"
            />
            <kbd>⌘ K</kbd>
          </label>
          <nav
            className="conversation-nav"
            data-testid={E2E_SELECTORS.conversationList}
            aria-label="Conversation list"
          >
            {conversations.map((conversation) => (
              <button
                type="button"
                className={`conversation-button ${conversation.id === selectedConversationId ? 'conversation-button-active' : ''}`}
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                aria-current={conversation.id === selectedConversationId ? 'page' : undefined}
              >
                <span className={`conversation-avatar conversation-avatar-${conversation.kind}`}>
                  {conversation.avatarLabel}
                </span>
                <span className="conversation-copy">
                  <span className="conversation-title-row">
                    <strong>
                      {conversation.kind === 'channel'
                        ? `# ${conversation.title}`
                        : conversation.title}
                    </strong>
                    <time>{conversation.updatedAt}</time>
                  </span>
                  <span className="conversation-preview">{conversation.preview}</span>
                </span>
                {conversation.unreadCount > 0 ? (
                  <span className="unread-badge">{conversation.unreadCount}</span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="privacy-lock" aria-hidden="true">
              ⌑
            </span>
            <span>End-to-end encryption ready</span>
          </div>
        </aside>

        <section className="conversation-main" aria-label="Active conversation">
          <header className="conversation-header">
            <div className="conversation-header-title">
              <span
                className={`conversation-avatar conversation-avatar-${selectedConversation?.kind ?? 'channel'}`}
                aria-hidden="true"
              >
                {selectedConversation?.avatarLabel ?? '#'}
              </span>
              <div>
                <h1>
                  {selectedConversation
                    ? selectedConversation.kind === 'channel'
                      ? `# ${selectedConversation.title}`
                      : selectedConversation.title
                    : 'Messages'}
                </h1>
                <p>{selectedConversation?.presence ?? 'Choose a conversation to begin'}</p>
              </div>
            </div>
            <div className="conversation-header-actions">
              <span className="encryption-label">
                <span aria-hidden="true">▣</span> Encrypted
              </span>
              <button type="button" className="icon-button" aria-label="Search this conversation">
                ⌕
              </button>
              <button type="button" className="icon-button" aria-label="More conversation options">
                •••
              </button>
            </div>
          </header>

          <div
            className="timeline"
            data-testid={E2E_SELECTORS.timeline}
            role="log"
            aria-live="polite"
            aria-label="Message timeline"
          >
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
                onEdit={handleEdit}
                onReact={(nextMessage, emoji) => void handleReact(nextMessage, emoji)}
                onReply={(nextMessage) =>
                  setReplyTo({
                    id: nextMessage.id,
                    author: nextMessage.senderName,
                    body: nextMessage.body,
                  })
                }
                onRetry={(nextMessage) => void handleRetry(nextMessage)}
              />
            ))}
            <div className="typing-indicator" aria-live="polite">
              {composer.trim() && !editingMessage ? (
                <>
                  <span className="typing-dots" aria-hidden="true">
                    •••
                  </span>{' '}
                  You’re typing a reply
                </>
              ) : null}
            </div>
          </div>

          {notice ? (
            <p
              className={`notice notice-${notice.tone}`}
              role={notice.tone === 'error' ? 'alert' : 'status'}
            >
              {notice.text}
            </p>
          ) : null}

          <form
            className="composer-shell"
            data-testid={E2E_SELECTORS.composer}
            onSubmit={(event) => void handleSubmit(event)}
          >
            {editingMessage ? (
              <div className="composer-context">
                <span>
                  <strong>Editing message</strong> · changes are saved to this conversation
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(undefined);
                    setComposer('');
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {replyTo ? (
              <div className="composer-context">
                <span>
                  <strong>Replying to {replyTo.author}</strong> · {replyTo.body}
                </span>
                <button type="button" onClick={() => setReplyTo(undefined)}>
                  Cancel
                </button>
              </div>
            ) : null}
            {attachments.length > 0 ? (
              <div className="attachment-draft-list" aria-label="Attachments ready to send">
                {attachments.map((attachment) => (
                  <span className="attachment-chip" key={attachment.id}>
                    {attachment.name} <small>{formatFileSize(attachment.size)}</small>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter(({ id }) => id !== attachment.id),
                        )
                      }
                      aria-label={`Remove ${attachment.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="composer-input-row">
              <label className="visually-hidden" htmlFor="message-composer-input">
                Write a message
              </label>
              <textarea
                id="message-composer-input"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  selectedConversation
                    ? `Message ${selectedConversation.title}`
                    : 'Choose a conversation'
                }
                rows={1}
                disabled={!selectedConversationId || isLoading}
              />
              <button
                type="submit"
                className="send-button"
                data-testid={E2E_SELECTORS.sendMessage}
                disabled={isSending || (!composer.trim() && attachments.length === 0)}
              >
                {isSending ? '…' : 'Send'}
              </button>
            </div>
            <div className="composer-footer">
              <div className="composer-tools">
                <label className="tool-button" title="Attach files">
                  <span aria-hidden="true">＋</span>
                  <span className="visually-hidden">Attach files</span>
                  <input type="file" multiple onChange={handleFiles} />
                </label>
                <button type="button" className="tool-button" aria-label="Add emoji">
                  ☺
                </button>
                <button type="button" className="tool-button" aria-label="Record voice message">
                  ◉
                </button>
              </div>
              <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
            </div>
          </form>
        </section>

        <aside className="details-sidebar" aria-label="Conversation details">
          <div className="details-heading">
            <p className="section-kicker">Conversation</p>
            <button type="button" className="icon-button" aria-label="Close details">
              ×
            </button>
          </div>
          <div className="details-avatar">{selectedConversation?.avatarLabel ?? '#'}</div>
          <h2>{selectedConversation?.title ?? 'Messages'}</h2>
          <p className="details-subtitle">
            {selectedConversation?.kind === 'channel'
              ? 'A quiet place for the team to gather.'
              : selectedConversation?.presence}
          </p>
          <div className="details-stat-grid">
            <div>
              <strong>{selectedConversation?.members ?? 0}</strong>
              <span>Members</span>
            </div>
            <div>
              <strong>Private</strong>
              <span>Visibility</span>
            </div>
          </div>
          <div className="details-section">
            <h3>Shared space</h3>
            <button type="button" className="detail-link">
              <span>⌁</span> Files and links <span>›</span>
            </button>
            <button type="button" className="detail-link">
              <span>☆</span> Pinned messages <span>›</span>
            </button>
          </div>
          <div className="details-section">
            <h3>Notifications</h3>
            <button type="button" className="notification-toggle" aria-pressed="true">
              <span className="toggle-on" /> Mentions and replies
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
