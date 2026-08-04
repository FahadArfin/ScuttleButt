import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  ArrowLeft,
  Bell,
  BellSlash,
  Camera,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChatCircleText,
  ChatCenteredDots,
  Check,
  Circle,
  Code,
  Confetti,
  Compass,
  Copy,
  EyeSlash,
  FileText,
  Flower,
  FrameCorners,
  GearSix,
  Hash,
  Headphones,
  Crown,
  Leaf,
  LockSimple,
  MagicWand,
  MagnifyingGlass,
  MapPin,
  Microphone,
  MinusCircle,
  Moon,
  Mountains,
  MonitorArrowUp,
  Paperclip,
  PaperPlaneRight,
  PaintBrush,
  Planet,
  PhoneDisconnect,
  Plus,
  PushPin,
  Repeat,
  Smiley,
  Sparkle,
  SpeakerHigh,
  Star,
  StarFour,
  UserPlus,
  Users,
  UploadSimple,
  VideoCameraSlash,
  Waveform,
  X,
} from '@phosphor-icons/react';
import { APP_NAME } from '@scuttlebutt/shared-types';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

import { MessageRow, PersonAvatar } from './App.js';
import {
  clearAuthSession,
  getStoredGoogleCredential,
  updateStoredAuthUser,
  type SignedInUser,
} from './auth.js';
import { optimizeAvatar } from './image-utils.js';
import { disablePushNotifications, syncPushNotifications } from './push-notifications.js';
import { MediaPicker, type MediaAsset } from './media-picker.js';
import {
  loadFriendState,
  respondToFriendRequest,
  sendFriendRequest,
  updatePresence,
  type FriendState,
} from './friends.js';
import { inviteFriendToGroup } from './groups.js';
import {
  createDemoMessagingRepository,
  createSyncedMessagingRepository,
  loadSyncedWorkspace,
  saveSyncedWorkspace,
  type AttachmentDraft,
  type Conversation,
  type Message,
  type MessagingRepository,
  type ReplyReference,
} from './messaging.js';
import {
  VOICE_QUICK_ACTION_EVENT,
  VoicePreviewPanel,
  type VoiceQuickAction,
} from './voice-preview.js';
import {
  DM_STORAGE_KEY,
  GROUP_STORAGE_KEY,
  conversationForChannel,
  loadStoredDms,
  loadStoredGroups,
  serverSettingsFor,
  slugify,
  createDefaultServerSettings,
  type AppSurface,
  type CustomEmote,
  type CustomSound,
  type DialogMode,
  type ForumPost,
  type ServerEvent,
  type ServerEventFrequency,
  type WorkspaceChannel,
  type WorkspaceChannelKind,
  type WorkspaceCategory,
  type WorkspaceGroup,
  type WorkspaceMember,
} from './workspace.js';
import { ServerSettingsDialog, type ServerSettingsSection } from './server-settings.js';
import {
  ApplicationSettingsDialog,
  loadApplicationPreferences,
  saveApplicationPreferences,
  type ApplicationPreferences,
} from './application-settings.js';
import {
  normalizePresenceStatus,
  normalizePresenceIndicatorStatus,
  presenceLabel,
  publicPresenceStatus,
  PRESENCE_DESCRIPTIONS,
  PRESENCE_LABELS,
  PRESENCE_STATUSES,
  type PresenceStatus,
} from './presence.js';

interface WorkspaceAppProps {
  repository?: MessagingRepository;
  user: SignedInUser;
}

interface Notice {
  tone: 'error' | 'info';
  text: string;
}

const DRAFT_STORAGE_PREFIX = 'scuttlebutt:draft:';
const FRIEND_CODE_STORAGE_KEY = 'scuttlebutt:friend-code';
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PROFILE_STORAGE_KEY = 'scuttlebutt:profile:v2';
const HIDDEN_MUTED_GROUPS_STORAGE_KEY = 'scuttlebutt:hidden-muted-groups:v1';
const SHOW_SERVER_PROFILE_BANNER = true;
const SHOW_GROUP_WORKSPACE_HEADER = false;

export const PROFILE_EFFECTS = ['none', 'sparkle', 'cosmos', 'neon', 'pop'] as const;
export type ProfileEffect = (typeof PROFILE_EFFECTS)[number];

export const PROFILE_FRAMES = ['none', 'orbit', 'lavender', 'gold', 'pixel'] as const;
export type ProfileFrame = (typeof PROFILE_FRAMES)[number];

export const AVATAR_DECORATIONS = ['none', 'halo', 'sparkle', 'crown', 'leaves'] as const;
export type AvatarDecoration = (typeof AVATAR_DECORATIONS)[number];

export const DISPLAY_NAME_STYLES = ['default', 'strong', 'neon', 'typewriter', 'pop'] as const;
export type DisplayNameStyle = (typeof DISPLAY_NAME_STYLES)[number];

const PROFILE_BANNER_COLORS = [
  '#5865f2',
  '#ef9b45',
  '#c83b83',
  '#2d9fd3',
  '#43c8b7',
  '#6b8f22',
  '#9a4fc6',
  '#303744',
] as const;

export interface UserProfile {
  avatar: string;
  avatarDecoration: AvatarDecoration;
  bannerColor: string;
  bio: string;
  displayNameColor: string;
  displayNameStyle: DisplayNameStyle;
  displayName: string;
  presence: PresenceStatus;
  profileEffect: ProfileEffect;
  profileFrame: ProfileFrame;
  status: string;
}

interface ChannelDraft {
  allowedRoleIds: string[];
  categoryId?: string;
  isPrivate: boolean;
  kind: WorkspaceChannelKind;
  name: string;
}

function loadProfile(user: SignedInUser): UserProfile {
  const fallback: UserProfile = {
    avatar: user.avatarUrl ?? '',
    avatarDecoration: 'none',
    bannerColor: user.backgroundColor,
    bio: user.bio,
    displayNameColor: '#eef1ff',
    displayNameStyle: 'default',
    displayName: user.name,
    presence: user.presence,
    profileEffect: 'none',
    profileFrame: 'none',
    status: 'Online',
  };
  try {
    const storageKey = `${PROFILE_STORAGE_KEY}:${user.id}`;
    const storedProfile = JSON.parse(
      localStorage.getItem(storageKey) ??
        (user.id === 'local-user' ? localStorage.getItem(PROFILE_STORAGE_KEY) : null) ??
        '{}',
    ) as Partial<UserProfile>;
    const normalized: UserProfile = {
      ...fallback,
      ...storedProfile,
      avatarDecoration: AVATAR_DECORATIONS.includes(
        storedProfile.avatarDecoration as AvatarDecoration,
      )
        ? (storedProfile.avatarDecoration as AvatarDecoration)
        : fallback.avatarDecoration,
      displayNameStyle: DISPLAY_NAME_STYLES.includes(
        storedProfile.displayNameStyle as DisplayNameStyle,
      )
        ? (storedProfile.displayNameStyle as DisplayNameStyle)
        : fallback.displayNameStyle,
      profileEffect: PROFILE_EFFECTS.includes(storedProfile.profileEffect as ProfileEffect)
        ? (storedProfile.profileEffect as ProfileEffect)
        : fallback.profileEffect,
      profileFrame: PROFILE_FRAMES.includes(storedProfile.profileFrame as ProfileFrame)
        ? (storedProfile.profileFrame as ProfileFrame)
        : fallback.profileFrame,
      presence: normalizePresenceStatus(storedProfile.presence ?? user.presence),
    };
    return normalized;
  } catch {
    return fallback;
  }
}

function loadFriendCode(): string {
  const stored = window.localStorage.getItem(FRIEND_CODE_STORAGE_KEY);
  if (stored) return stored;
  const values = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(
    values,
    (value) => FRIEND_CODE_ALPHABET[value % FRIEND_CODE_ALPHABET.length],
  ).join('');
  window.localStorage.setItem(FRIEND_CODE_STORAGE_KEY, code);
  return code;
}

function IconButton({
  children,
  label,
  onClick,
  pressed,
  tone = 'default',
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  tone?: 'danger' | 'default';
}) {
  return (
    <button
      type="button"
      className={`icon-button ${tone === 'danger' ? 'icon-button-danger' : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}

function groupIcon(icon: WorkspaceGroup['icon']): ReactNode {
  if (icon === 'orbit') return <Planet size={24} weight="duotone" />;
  if (icon === 'garden') return <Leaf size={24} weight="duotone" />;
  if (icon === 'summit') return <Mountains size={24} weight="duotone" />;
  return <ChatCenteredDots size={24} weight="duotone" />;
}

type ServerThemeStyle = CSSProperties & {
  '--server-banner-color'?: string;
};

function serverThemeStyle(group?: WorkspaceGroup): ServerThemeStyle {
  return group ? { '--server-banner-color': serverSettingsFor(group).bannerColor } : {};
}

function ServerProfileIcon({
  className = '',
  group,
}: {
  className?: string;
  group: WorkspaceGroup;
}) {
  const settings = serverSettingsFor(group);
  return (
    <span
      className={`server-profile-icon ${className}`}
      style={{ backgroundColor: settings.bannerColor }}
    >
      {settings.iconUrl ? <img src={settings.iconUrl} alt="" /> : groupIcon(group.icon)}
    </span>
  );
}

function PresenceIcon({ status, size = 16 }: { status: PresenceStatus; size?: number }) {
  if (status === 'idle') return <Moon size={size} weight="fill" />;
  if (status === 'dnd') return <MinusCircle size={size} weight="fill" />;
  if (status === 'invisible') return <EyeSlash size={size} weight="bold" />;
  return <Circle size={size} weight="fill" />;
}

function ProfileEffectIcon({ effect, size = 20 }: { effect: ProfileEffect; size?: number }) {
  if (effect === 'sparkle') return <Sparkle size={size} weight="fill" />;
  if (effect === 'cosmos') return <Planet size={size} weight="duotone" />;
  if (effect === 'neon') return <MagicWand size={size} weight="duotone" />;
  if (effect === 'pop') return <Confetti size={size} weight="duotone" />;
  return <Circle size={size} weight="bold" />;
}

function ProfileFrameIcon({ frame, size = 20 }: { frame: ProfileFrame; size?: number }) {
  if (frame === 'orbit') return <Planet size={size} weight="duotone" />;
  if (frame === 'lavender') return <Flower size={size} weight="duotone" />;
  if (frame === 'gold') return <StarFour size={size} weight="fill" />;
  if (frame === 'pixel') return <FrameCorners size={size} weight="bold" />;
  return <Circle size={size} weight="bold" />;
}

function AvatarDecorationIcon({
  decoration,
  size = 18,
}: {
  decoration: AvatarDecoration;
  size?: number;
}) {
  if (decoration === 'halo') return <Circle size={size} weight="bold" />;
  if (decoration === 'sparkle') return <Sparkle size={size} weight="fill" />;
  if (decoration === 'crown') return <Crown size={size} weight="fill" />;
  if (decoration === 'leaves') return <Leaf size={size} weight="fill" />;
  return <Circle size={size} weight="bold" />;
}

function DisplayNameStyleIcon({ style, size = 20 }: { style: DisplayNameStyle; size?: number }) {
  if (style === 'strong') return <Star size={size} weight="fill" />;
  if (style === 'neon') return <Sparkle size={size} weight="fill" />;
  if (style === 'typewriter') return <PaintBrush size={size} weight="duotone" />;
  if (style === 'pop') return <Confetti size={size} weight="duotone" />;
  return <Circle size={size} weight="bold" />;
}

function profileEffectLabel(effect: ProfileEffect): string {
  return {
    none: 'None',
    sparkle: 'Sparkle',
    cosmos: 'Cosmos',
    neon: 'Neon',
    pop: 'Pop',
  }[effect];
}

function profileFrameLabel(frame: ProfileFrame): string {
  return {
    none: 'None',
    orbit: 'Orbit',
    lavender: 'Lavender',
    gold: 'Gold',
    pixel: 'Pixel',
  }[frame];
}

function avatarDecorationLabel(decoration: AvatarDecoration): string {
  return {
    none: 'None',
    halo: 'Halo',
    sparkle: 'Sparkle',
    crown: 'Crown',
    leaves: 'Leaves',
  }[decoration];
}

function displayNameStyleLabel(style: DisplayNameStyle): string {
  return {
    default: 'Default',
    strong: 'Strong',
    neon: 'Neon',
    typewriter: 'Typewriter',
    pop: 'Pop',
  }[style];
}

function DecoratedProfileAvatar({
  className = '',
  profile,
  size = 'large',
  status,
}: {
  className?: string;
  profile: UserProfile;
  size?: 'large' | 'medium' | 'small';
  status?: ReturnType<typeof publicPresenceStatus>;
}) {
  return (
    <span
      className={`decorated-profile-avatar decorated-profile-avatar-${size} ${className}`.trim()}
    >
      <span className={`profile-avatar-frame profile-frame-${profile.profileFrame}`}>
        <PersonAvatar
          image={profile.avatar}
          name={profile.displayName}
          size={size}
          status={status}
        />
      </span>
      {profile.avatarDecoration !== 'none' ? (
        <span
          className={`profile-avatar-decoration profile-decoration-${profile.avatarDecoration}`}
          aria-hidden="true"
        >
          <AvatarDecorationIcon decoration={profile.avatarDecoration} />
        </span>
      ) : null}
    </span>
  );
}

function ProfilePreview({ profile, compact = false }: { profile: UserProfile; compact?: boolean }) {
  return (
    <div className={`profile-card-preview ${compact ? 'profile-card-preview-compact' : ''}`}>
      <div
        className={`profile-preview-banner profile-effect-${profile.profileEffect}`}
        style={{ backgroundColor: profile.bannerColor }}
      >
        {profile.profileEffect !== 'none' ? (
          <span
            className="profile-effect-mark"
            aria-label={`${profileEffectLabel(profile.profileEffect)} effect`}
          >
            <ProfileEffectIcon effect={profile.profileEffect} size={compact ? 22 : 30} />
          </span>
        ) : null}
      </div>
      <div className="profile-preview-body">
        <DecoratedProfileAvatar profile={profile} className="profile-preview-avatar" />
        <h3
          className={`profile-display-name profile-display-name-${profile.displayNameStyle}`}
          style={{ color: profile.displayNameColor }}
        >
          {profile.displayName || 'Your name'}
        </h3>
        <span>{profile.status || 'Online'}</span>
        <hr />
        <strong>About me</strong>
        <p>{profile.bio || 'Tell friends a little about yourself.'}</p>
      </div>
    </div>
  );
}

function canViewWorkspaceChannel(
  group: WorkspaceGroup,
  channel: WorkspaceChannel,
  userId: string,
): boolean {
  if (!channel.isPrivate || group.ownerId === userId) return true;
  const member = group.members?.find(({ id }) => id === userId);
  const memberRoleIds = member?.roleIds ?? [];
  const allowedRoleIds = channel.allowedRoleIds ?? [];
  return (
    allowedRoleIds.includes('everyone') || memberRoleIds.some((id) => allowedRoleIds.includes(id))
  );
}

function formatEventFrequency(frequency: ServerEventFrequency): string {
  if (frequency === 'daily') return 'Daily';
  if (frequency === 'weekly') return 'Weekly';
  if (frequency === 'monthly') return 'Monthly';
  return 'Does not repeat';
}

function formatEventLocation(event: ServerEvent): string {
  return event.locationType === 'voice' ? `Voice channel · ${event.location}` : event.location;
}

interface NotificationSummary {
  hasDirectActivity: boolean;
  unreadCount: number;
}

function notificationSummaryForGroup(
  group: WorkspaceGroup,
  conversations: Conversation[],
): NotificationSummary {
  const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  return group.channels.reduce<NotificationSummary>(
    (summary, channel) => {
      if (channel.muted) return summary;
      const conversation = byId.get(channel.conversationId);
      const unreadCount = conversation?.unreadCount ?? 0;
      return {
        hasDirectActivity:
          summary.hasDirectActivity || Boolean(unreadCount > 0 && conversation?.hasMention),
        unreadCount: summary.unreadCount + unreadCount,
      };
    },
    { hasDirectActivity: false, unreadCount: 0 },
  );
}

function formatReadTime(value?: string): string {
  if (!value) return 'your last visit';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'your last visit';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function NotificationMarker({ direct = false, label }: { direct?: boolean; label: string }) {
  return (
    <span
      aria-label={label}
      className={`notification-marker ${direct ? 'notification-marker-direct' : 'notification-marker-activity'}`}
      role="status"
      title={label}
    >
      {direct ? '@' : null}
    </span>
  );
}

export function WorkspaceApp({ repository: repositoryProp, user }: WorkspaceAppProps) {
  const googleCredential = user.id === 'local-user' ? null : getStoredGoogleCredential();
  const [repository] = useState<MessagingRepository>(
    () =>
      repositoryProp ??
      (googleCredential
        ? createSyncedMessagingRepository(googleCredential, { id: user.id, name: user.name })
        : createDemoMessagingRepository({ id: user.id, name: user.name })),
  );
  const [groups, setGroups] = useState<WorkspaceGroup[]>(loadStoredGroups);
  const [customDms, setCustomDms] = useState<Conversation[]>(loadStoredDms);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [activeSurface, setActiveSurface] = useState<AppSurface>('groups');
  const [activeGroupId, setActiveGroupId] = useState('scuttlebutt-labs');
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
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [applicationSettingsOpen, setApplicationSettingsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>();
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelDialogKind, setChannelDialogKind] = useState<WorkspaceChannelKind>('text');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [hiddenMutedGroups, setHiddenMutedGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem(HIDDEN_MUTED_GROUPS_STORAGE_KEY) ?? '{}',
      ) as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);
  const [friendDialogOpen, setFriendDialogOpen] = useState(false);
  const [groupInviteOpen, setGroupInviteOpen] = useState(false);
  const [assetDialog, setAssetDialog] = useState<'emote' | 'sound'>();
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverSettingsSection, setServerSettingsSection] =
    useState<ServerSettingsSection>('profile');
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [friendState, setFriendState] = useState<FriendState>({
    friendCode: user.friendCode ?? loadFriendCode(),
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [profile, setProfile] = useState(() => loadProfile(user));
  const [applicationPreferences, setApplicationPreferences] = useState(() =>
    loadApplicationPreferences(user.id),
  );
  const handledNotificationLinkRef = useRef(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(!googleCredential);
  const [cloudWorkspaceExists, setCloudWorkspaceExists] = useState(false);
  const selectedConversation = conversations.find(({ id }) => id === selectedConversationId);
  const directMessages = conversations.filter(
    ({ id, kind }) => kind === 'direct' && !id.startsWith('friend-'),
  );
  const friendCode = friendState.friendCode;
  const activeGroup = groups.find(({ id }) => id === activeGroupId) ?? groups[0];
  const hideMutedChannels = Boolean(activeGroup && hiddenMutedGroups[activeGroup.id]);
  const canManageActiveGroup = Boolean(
    activeGroup && (!activeGroup.ownerId || activeGroup.ownerId === user.id),
  );
  const members = useMemo<WorkspaceMember[]>(() => {
    const localMember: WorkspaceMember = {
      id: user.id,
      avatar: profile.avatar,
      name: profile.displayName,
      note: 'You',
      status: publicPresenceStatus(profile.presence),
    };
    const friendsById = new Map(friendState.friends.map((friend) => [friend.id, friend]));
    const groupMembers = (activeGroup?.members ?? [])
      .filter(({ id }) => id !== user.id)
      .map((member) => {
        const friend = friendsById.get(member.id);
        return friend
          ? {
              ...member,
              avatar: friend.avatarUrl ?? member.avatar,
              name: friend.name,
              status: friend.presence,
            }
          : { ...member, status: normalizePresenceIndicatorStatus(member.status) };
      });
    return [localMember, ...groupMembers];
  }, [
    activeGroup?.members,
    friendState.friends,
    profile.avatar,
    profile.displayName,
    profile.presence,
    user.id,
  ]);
  const availableSounds = useMemo(() => groups.flatMap(({ sounds = [] }) => sounds), [groups]);
  const availableEmotes = useMemo(() => groups.flatMap(({ emotes = [] }) => emotes), [groups]);
  const joinedVoice = groups
    .flatMap((group) => group.channels.map((channel) => ({ channel, group })))
    .find(({ channel }) => channel.kind === 'voice' && channel.participantIds.includes(user.id));
  const selectedChannel = activeGroup?.channels.find(
    ({ conversationId }) => conversationId === selectedConversationId,
  );
  const activeUnreadCount =
    selectedChannel?.muted || !selectedConversation ? 0 : selectedConversation.unreadCount;
  const showNewMessagesBanner = Boolean(
    activeUnreadCount > 0 &&
    selectedConversation &&
    selectedConversation.channelKind !== 'voice' &&
    selectedConversation.channelKind !== 'forum',
  );
  const showConversation =
    Boolean(selectedConversation) && (activeSurface === 'dms' || activeSurface === 'groups');
  const isVoiceConversation = selectedConversation?.channelKind === 'voice';
  const showMembers = membersVisible && activeSurface === 'groups' && showConversation;
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) =>
      `${message.senderName} ${message.body}`.toLowerCase().includes(query),
    );
  }, [messages, search]);

  useEffect(() => {
    if (!googleCredential) return;
    let mounted = true;
    void loadSyncedWorkspace<{ dms: Conversation[]; groups: WorkspaceGroup[] }>(googleCredential)
      .then((workspace) => {
        if (!mounted) return;
        if (workspace) {
          setGroups(workspace.groups);
          setCustomDms(workspace.dms.filter(({ id }) => !id.startsWith('friend-')));
          setCloudWorkspaceExists(true);
        }
        setWorkspaceReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setNotice({ tone: 'error', text: 'Cloud workspace could not be loaded.' });
        setWorkspaceReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [googleCredential]);

  useEffect(() => {
    if (!googleCredential) return;
    let mounted = true;
    const refresh = () => {
      void Promise.all([
        loadFriendState(googleCredential),
        loadSyncedWorkspace<{ dms: Conversation[]; groups: WorkspaceGroup[] }>(googleCredential),
      ])
        .then(([state, workspace]) => {
          if (!mounted) return;
          setFriendState(state);
          if (workspace) {
            setGroups((current) =>
              JSON.stringify(current) === JSON.stringify(workspace.groups)
                ? current
                : workspace.groups,
            );
          }
          void repository.getConversations().then(setConversations);
        })
        .catch(() => undefined);
    };
    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [googleCredential, repository]);

  useEffect(() => {
    if (!googleCredential) return;
    void syncPushNotifications(googleCredential).catch(() => undefined);
  }, [googleCredential]);

  useEffect(() => {
    if (!workspaceReady) return;
    let mounted = true;
    const prepareWorkspace = async () => {
      await Promise.all([
        ...groups.flatMap((group) =>
          group.channels.map((channel) =>
            repository.createConversation(conversationForChannel(group, channel)),
          ),
        ),
        ...customDms.map((conversation) => repository.createConversation(conversation)),
      ]);
      const nextConversations = await repository.getConversations();
      if (!mounted) return;
      setConversations(nextConversations);
      setSelectedConversationId(
        nextConversations.find(({ id }) => id === 'lounge')?.id ?? nextConversations[0]?.id ?? '',
      );
      setIsLoading(false);
    };
    void prepareWorkspace();
    return () => {
      mounted = false;
    };
  }, [repository, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady || handledNotificationLinkRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get('conversation');
    if (!conversationId) {
      handledNotificationLinkRef.current = true;
      return;
    }
    const conversation = conversations.find(({ id }) => id === conversationId);
    if (!conversation) return;

    const surface: AppSurface =
      params.get('surface') === 'dms' || conversation.kind === 'direct' ? 'dms' : 'groups';
    setSelectedConversationId(conversationId);
    setActiveSurface(surface);
    if (surface === 'groups') {
      const group = groups.find(({ channels }) =>
        channels.some(
          ({ conversationId: channelConversationId }) => channelConversationId === conversationId,
        ),
      );
      if (group) setActiveGroupId(group.id);
    }
    handledNotificationLinkRef.current = true;
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${window.location.hash}`,
    );
  }, [conversations, groups, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady) return;
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups));
    window.localStorage.setItem(DM_STORAGE_KEY, JSON.stringify(customDms));
    if (googleCredential) {
      if (!cloudWorkspaceExists && groups.length === 0 && customDms.length === 0) return undefined;
      const persistedGroups = groups.map((group) => ({
        ...group,
        channels: group.channels.map((channel) => ({ ...channel, participantIds: [] })),
      }));
      const timeout = window.setTimeout(() => {
        void saveSyncedWorkspace(googleCredential, {
          groups: persistedGroups,
          dms: customDms,
        })
          .then(() => setCloudWorkspaceExists(true))
          .catch(() =>
            setNotice({ tone: 'error', text: 'Workspace changes could not be synchronized.' }),
          );
      }, 250);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [cloudWorkspaceExists, customDms, googleCredential, groups, workspaceReady]);

  useEffect(() => {
    window.localStorage.setItem(`${PROFILE_STORAGE_KEY}:${user.id}`, JSON.stringify(profile));
  }, [profile, user.id]);

  useEffect(() => {
    window.localStorage.setItem(HIDDEN_MUTED_GROUPS_STORAGE_KEY, JSON.stringify(hiddenMutedGroups));
  }, [hiddenMutedGroups]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    let mounted = true;
    setIsLoading(true);
    void repository.getMessages(selectedConversationId).then((nextMessages) => {
      if (!mounted) return;
      setMessages(nextMessages);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [repository, selectedConversationId]);

  useEffect(() => {
    if (!googleCredential || !selectedConversationId) return;
    const interval = window.setInterval(() => {
      void repository.getMessages(selectedConversationId).then(setMessages);
      void repository.getConversations().then(setConversations);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [googleCredential, repository, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    setComposer(
      window.localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${selectedConversationId}`) ?? '',
    );
    setReplyTo(undefined);
    setEditingMessage(undefined);
    setAttachments([]);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const storageKey = `${DRAFT_STORAGE_PREFIX}${selectedConversationId}`;
    if (composer) window.localStorage.setItem(storageKey, composer);
    else window.localStorage.removeItem(storageKey);
    void repository.setTyping(selectedConversationId, composer.trim().length > 0);
  }, [composer, repository, selectedConversationId]);

  const refreshMessages = async () => {
    if (selectedConversationId) {
      setMessages(await repository.getMessages(selectedConversationId));
    }
  };

  const refreshConversations = async () => {
    setConversations(await repository.getConversations());
  };

  const markConversationRead = async (conversationId = selectedConversationId) => {
    const conversation = conversations.find(({ id }) => id === conversationId);
    if (!conversation || (conversation.unreadCount === 0 && !conversation.hasMention)) return;
    const lastReadAt = new Date().toISOString();
    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId
          ? { ...item, unreadCount: 0, hasMention: false, lastReadAt }
          : item,
      ),
    );
    try {
      await repository.markRead(conversationId);
    } catch (error) {
      await refreshConversations();
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Messages could not be marked as read.',
      });
    }
  };

  const handleComposerChange = (value: string) => {
    setComposer(value);
    if (value.trim() && showNewMessagesBanner) {
      void markConversationRead();
    }
  };

  const selectConversation = (conversationId: string, surface: AppSurface) => {
    setSelectedConversationId(conversationId);
    setActiveSurface(surface);
    setSearch('');
    setNotice(undefined);
    setMobileNavigationOpen(false);
  };

  const openGroup = (groupId: string) => {
    const group = groups.find(({ id }) => id === groupId);
    if (!group) return;
    setActiveGroupId(group.id);
    setActiveSurface('groups');
    setWorkspaceMenuOpen(false);
    const firstChannel = group.channels.find(({ kind }) => kind === 'text') ?? group.channels[0];
    setSelectedConversationId(firstChannel?.conversationId ?? '');
    setNotice(undefined);
  };

  const openDms = () => {
    setActiveSurface('dms');
    setWorkspaceMenuOpen(false);
    setSelectedConversationId('');
    setMobileNavigationOpen(true);
    setNotice(undefined);
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
      } else {
        await repository.sendMessage(selectedConversationId, composer.trim(), {
          attachments,
          replyTo,
        });
      }
      setComposer('');
      setAttachments([]);
      setReplyTo(undefined);
      setEditingMessage(undefined);
      await markConversationRead();
      await refreshMessages();
      setNotice({ tone: 'info', text: editingMessage ? 'Message updated.' : 'Message sent.' });
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

  const handleMediaSelect = (asset: MediaAsset) => {
    if (asset.value) {
      setComposer((current) => `${current}${current ? ' ' : ''}${asset.value}`);
      return;
    }
    if (!asset.url || (asset.kind !== 'gif' && asset.kind !== 'sticker')) return;
    const mediaKind = asset.kind;
    setAttachments((current) => {
      if (current.some((attachment) => attachment.id === `media-${asset.id}`)) return current;
      return [
        ...current,
        {
          alt: asset.label,
          id: `media-${asset.id}`,
          kind: mediaKind,
          mimeType: mediaKind === 'gif' ? 'image/gif' : 'image/webp',
          name: asset.label,
          previewUrl: asset.previewUrl ?? asset.url,
          size: 0,
          source: asset.source ?? 'GIPHY',
          url: asset.url,
        },
      ];
    });
    setNotice({
      tone: 'info',
      text: `${asset.kind === 'gif' ? 'GIF' : 'Sticker'} added to your message.`,
    });
  };

  const handleDelete = async (message: Message) => {
    await repository.deleteMessage(selectedConversationId, message.id);
    await refreshMessages();
  };

  const handleReact = async (message: Message, emoji: string) => {
    await repository.reactToMessage(selectedConversationId, message.id, emoji);
    await refreshMessages();
  };

  const createFromDialog = async (rawName: string) => {
    const name = rawName.trim();
    const slug = slugify(name);
    if (!dialogMode || !name || !slug) return;

    if (dialogMode === 'dm') {
      const conversation: Conversation = {
        id: `dm-${slug}-${Date.now()}`,
        title: name,
        kind: 'direct',
        avatarLabel: name
          .split(/\s+/)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        presence: 'Available',
        preview: 'Start a private conversation.',
        updatedAt: 'Now',
        unreadCount: 0,
        encrypted: true,
        members: 2,
      };
      await repository.createConversation(conversation);
      setCustomDms((current) => [...current, conversation]);
      await refreshConversations();
      setActiveSurface('dms');
      setSelectedConversationId(conversation.id);
    } else if (dialogMode === 'group') {
      const groupId = `${slug}-${Date.now()}`;
      const channel: WorkspaceChannel = {
        id: 'general',
        name: 'general',
        kind: 'text',
        conversationId: `${groupId}-general`,
        participantIds: [],
      };
      const group: WorkspaceGroup = {
        id: groupId,
        name,
        description: 'A locally hosted Scuttlebutt group.',
        icon: 'chat',
        ownerId: user.id,
        settings: createDefaultServerSettings(),
        channels: [channel],
      };
      await repository.createConversation(conversationForChannel(group, channel));
      setGroups((current) => [...current, group]);
      await refreshConversations();
      setActiveGroupId(group.id);
      setActiveSurface('groups');
      setSelectedConversationId(channel.conversationId);
    } else if (activeGroup) {
      const kind = dialogMode === 'voice-channel' ? 'voice' : 'text';
      const timestamp = Date.now();
      const channel: WorkspaceChannel = {
        id: `${slug}-${timestamp}`,
        name: kind === 'text' ? slug : name,
        kind,
        conversationId: `${activeGroup.id}-${kind}-${slug}-${timestamp}`,
        participantIds: [],
      };
      await repository.createConversation(conversationForChannel(activeGroup, channel));
      setGroups((current) =>
        current.map((group) =>
          group.id === activeGroup.id
            ? { ...group, channels: [...group.channels, channel] }
            : group,
        ),
      );
      await refreshConversations();
      setActiveSurface('groups');
      setSelectedConversationId(channel.conversationId);
    }

    setDialogMode(undefined);
    setNotice({ tone: 'info', text: `${name} created locally.` });
  };

  const openChannelDialog = (kind: WorkspaceChannelKind = 'text') => {
    setWorkspaceMenuOpen(false);
    setChannelDialogKind(kind);
    setChannelDialogOpen(true);
  };

  const createChannel = async (draft: ChannelDraft) => {
    if (!activeGroup) return;
    const name = draft.name.trim();
    const slug = slugify(name);
    if (!name || !slug) return;
    const timestamp = Date.now();
    const channel: WorkspaceChannel = {
      id: `${slug}-${timestamp}`,
      name: draft.kind === 'text' ? slug : name,
      kind: draft.kind,
      conversationId: `${activeGroup.id}-${draft.kind}-${slug}-${timestamp}`,
      participantIds: [],
      categoryId: draft.categoryId,
      isPrivate: draft.isPrivate,
      allowedRoleIds: draft.isPrivate ? draft.allowedRoleIds : undefined,
      forumPosts: draft.kind === 'forum' ? [] : undefined,
    };
    await repository.createConversation(conversationForChannel(activeGroup, channel));
    setGroups((current) =>
      current.map((group) =>
        group.id === activeGroup.id ? { ...group, channels: [...group.channels, channel] } : group,
      ),
    );
    await refreshConversations();
    setChannelDialogOpen(false);
    setActiveSurface('groups');
    setSelectedConversationId(channel.conversationId);
    setNotice({
      tone: 'info',
      text: `${name} ${draft.kind === 'forum' ? 'forum' : draft.kind} channel created.`,
    });
  };

  const createCategory = (rawName: string) => {
    if (!activeGroup) return;
    const name = rawName.trim();
    const slug = slugify(name);
    if (!name || !slug) return;
    const category: WorkspaceCategory = { id: `${slug}-${Date.now()}`, name };
    setGroups((current) =>
      current.map((group) =>
        group.id === activeGroup.id
          ? { ...group, categories: [...(group.categories ?? []), category] }
          : group,
      ),
    );
    setCategoryDialogOpen(false);
    setNotice({ tone: 'info', text: `${name} category created.` });
  };

  const toggleHideMutedChannels = () => {
    if (!activeGroup) return;
    setHiddenMutedGroups((current) => ({
      ...current,
      [activeGroup.id]: !current[activeGroup.id],
    }));
  };

  const toggleChannelMuted = (channelId: string) => {
    if (!activeGroup) return;
    setGroups((current) =>
      current.map((group) =>
        group.id !== activeGroup.id
          ? group
          : {
              ...group,
              channels: group.channels.map((channel) =>
                channel.id === channelId ? { ...channel, muted: !channel.muted } : channel,
              ),
            },
      ),
    );
  };

  const createForumPost = (channelId: string, title: string, body: string) => {
    if (!activeGroup) return;
    const post: ForumPost = {
      id: `post-${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      authorAvatar: profile.avatar,
      authorId: user.id,
      authorName: profile.displayName,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    setGroups((current) =>
      current.map((group) =>
        group.id !== activeGroup.id
          ? group
          : {
              ...group,
              channels: group.channels.map((channel) =>
                channel.id === channelId
                  ? { ...channel, forumPosts: [...(channel.forumPosts ?? []), post] }
                  : channel,
              ),
            },
      ),
    );
    setNotice({ tone: 'info', text: 'Forum post created.' });
  };

  const addForumReply = (channelId: string, postId: string, body: string) => {
    if (!activeGroup || !body.trim()) return;
    const reply = {
      id: `reply-${Date.now()}`,
      body: body.trim(),
      authorAvatar: profile.avatar,
      authorId: user.id,
      authorName: profile.displayName,
      createdAt: new Date().toISOString(),
    };
    setGroups((current) =>
      current.map((group) =>
        group.id !== activeGroup.id
          ? group
          : {
              ...group,
              channels: group.channels.map((channel) =>
                channel.id !== channelId
                  ? channel
                  : {
                      ...channel,
                      forumPosts: (channel.forumPosts ?? []).map((post) =>
                        post.id === postId ? { ...post, replies: [...post.replies, reply] } : post,
                      ),
                    },
              ),
            },
      ),
    );
  };

  const createServerEvent = async (event: ServerEvent) => {
    if (!activeGroup) return;
    setGroups((current) =>
      current.map((group) =>
        group.id === activeGroup.id
          ? { ...group, events: [...(group.events ?? []), event] }
          : group,
      ),
    );
    if (event.postChannelId) {
      const postChannel = activeGroup.channels.find(({ id }) => id === event.postChannelId);
      if (postChannel) {
        await repository.createConversation(conversationForChannel(activeGroup, postChannel));
        await repository.sendMessage(
          postChannel.conversationId,
          `📅 ${event.title}\n${new Date(`${event.startDate}T${event.startTime}`).toLocaleString()} · ${formatEventLocation(event)}\n${event.description || 'Join us for this event.'}${event.frequency !== 'once' ? `\nRepeats: ${formatEventFrequency(event.frequency)}` : ''}`,
        );
        if (postChannel.conversationId === selectedConversationId) await refreshMessages();
      }
    }
    setEventsOpen(false);
    setNotice({ tone: 'info', text: `${event.title} was added to ${activeGroup.name}.` });
  };

  const updateVoiceConnection = (connected: boolean) => {
    if (!selectedChannel || !activeGroup) return;
    setGroups((current) =>
      current.map((group) =>
        group.id !== activeGroup.id
          ? group
          : {
              ...group,
              channels: group.channels.map((channel) =>
                channel.id !== selectedChannel.id
                  ? channel
                  : {
                      ...channel,
                      participantIds: connected
                        ? Array.from(new Set([...channel.participantIds, user.id]))
                        : channel.participantIds.filter((id) => id !== user.id),
                    },
              ),
            },
      ),
    );
  };

  const leaveVoiceChannel = () => {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        channels: group.channels.map((channel) => ({
          ...channel,
          participantIds: channel.participantIds.filter((id) => id !== user.id),
        })),
      })),
    );
    setLocalSpeaking(false);
  };

  const runVoiceQuickAction = (action: VoiceQuickAction) => {
    if (joinedVoice && selectedConversationId !== joinedVoice.channel.conversationId) {
      setActiveGroupId(joinedVoice.group.id);
      setActiveSurface('groups');
      setSelectedConversationId(joinedVoice.channel.conversationId);
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent(VOICE_QUICK_ACTION_EVENT, { detail: action })),
        0,
      );
      return;
    }
    window.dispatchEvent(new CustomEvent(VOICE_QUICK_ACTION_EVENT, { detail: action }));
  };

  const joinVoiceChannel = (conversationId: string) => {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        channels: group.channels.map((channel) => ({
          ...channel,
          participantIds:
            channel.conversationId === conversationId
              ? Array.from(new Set([...channel.participantIds, user.id]))
              : channel.participantIds.filter((id) => id !== user.id),
        })),
      })),
    );
    selectConversation(conversationId, 'groups');
    setVoiceChatOpen(false);
    setNotice({ tone: 'info', text: 'Joined voice channel.' });
  };

  const addFriendByCode = async (rawCode: string) => {
    const code = rawCode.replace(/[\s-]/g, '').toUpperCase();
    if (!new RegExp(`^[${FRIEND_CODE_ALPHABET}]{6}$`).test(code)) {
      setNotice({ tone: 'error', text: 'Enter a valid 6-character friend code.' });
      return;
    }
    if (code === friendCode) {
      setNotice({ tone: 'error', text: 'That is your own friend code.' });
      return;
    }
    if (!googleCredential) {
      setNotice({ tone: 'error', text: 'Sign in with Google to add friends.' });
      return;
    }
    try {
      const { recipient } = await sendFriendRequest(googleCredential, code);
      setFriendState(await loadFriendState(googleCredential));
      setFriendDialogOpen(false);
      setActiveSurface('dms');
      setSelectedConversationId('');
      setNotice({ tone: 'info', text: `Friend request sent to ${recipient.name}.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Friend request could not be sent.',
      });
    }
  };

  const handleFriendResponse = async (requesterId: string, action: 'accept' | 'decline') => {
    if (!googleCredential) return;
    try {
      await respondToFriendRequest(googleCredential, requesterId, action);
      setFriendState(await loadFriendState(googleCredential));
      await refreshConversations();
      setNotice({
        tone: 'info',
        text: action === 'accept' ? 'Friend request accepted.' : 'Friend request declined.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Friend request could not be updated.',
      });
    }
  };

  const handleGroupInvite = async (friendId: string) => {
    if (!googleCredential || !activeGroup) return;
    const friend = friendState.friends.find(({ id }) => id === friendId);
    if (!friend) return;
    try {
      const groupWithMember: WorkspaceGroup = {
        ...activeGroup,
        members: [
          ...(activeGroup.members ?? []).filter(({ id }) => id !== friend.id),
          {
            avatar: friend.avatarUrl ?? '',
            id: friend.id,
            name: friend.name,
            note: 'Member',
            status: friend.presence,
          },
        ],
      };
      const savedGroup = await inviteFriendToGroup(googleCredential, friendId, groupWithMember);
      setGroups((current) =>
        current.map((group) => (group.id === savedGroup.id ? savedGroup : group)),
      );
      setGroupInviteOpen(false);
      setNotice({ tone: 'info', text: `${friend.name} was invited to ${activeGroup.name}.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'The group invitation failed.',
      });
    }
  };

  const addGroupAsset = (type: 'emote' | 'sound', name: string, dataUrl: string) => {
    if (!activeGroup) return;
    const safeName = name
      .trim()
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 24);
    if (!safeName) return;
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== activeGroup.id) return group;
        if (type === 'sound') {
          const sound: CustomSound = {
            dataUrl,
            id: crypto.randomUUID(),
            name: safeName,
            sourceGroupId: group.id,
            sourceGroupName: group.name,
          };
          return { ...group, sounds: [...(group.sounds ?? []), sound] };
        }
        const emote: CustomEmote = {
          dataUrl,
          id: crypto.randomUUID(),
          name: safeName,
          sourceGroupId: group.id,
          sourceGroupName: group.name,
        };
        return { ...group, emotes: [...(group.emotes ?? []), emote] };
      }),
    );
    setAssetDialog(undefined);
    setNotice({
      tone: 'info',
      text: `${safeName} was added to ${activeGroup.name}'s ${type === 'sound' ? 'soundboard' : 'emotes'}.`,
    });
  };

  const openServerSettings = (section: ServerSettingsSection = 'profile') => {
    if (!activeGroup || !canManageActiveGroup) {
      setNotice({ tone: 'error', text: 'Only the server owner can manage these settings.' });
      return;
    }
    setWorkspaceMenuOpen(false);
    setServerSettingsSection(section);
    setServerSettingsOpen(true);
  };

  const updateApplicationPreferences = (next: ApplicationPreferences) => {
    setApplicationPreferences(next);
    saveApplicationPreferences(user.id, next);
  };

  const logOut = () => {
    if (googleCredential) void disablePushNotifications(googleCredential);
    clearAuthSession();
    window.location.reload();
  };

  const selectPresence = async (next: PresenceStatus) => {
    const previous = profile.presence;
    setProfile((current) => ({ ...current, presence: next }));
    setPresenceMenuOpen(false);
    setProfileOpen(false);
    if (!googleCredential) {
      setNotice({ tone: 'info', text: `Your status is now ${PRESENCE_LABELS[next]}.` });
      return;
    }
    try {
      await updatePresence(googleCredential, next);
      updateStoredAuthUser({ ...user, presence: next });
      setNotice({ tone: 'info', text: `Your status is now ${PRESENCE_LABELS[next]}.` });
    } catch (reason) {
      setProfile((current) => ({ ...current, presence: previous }));
      setNotice({
        tone: 'error',
        text: reason instanceof Error ? reason.message : 'Your status could not be updated.',
      });
    }
  };

  const saveServerSettings = (nextGroup: WorkspaceGroup) => {
    setGroups((current) => current.map((group) => (group.id === nextGroup.id ? nextGroup : group)));
    setServerSettingsOpen(false);
    setNotice({ tone: 'info', text: `${nextGroup.name} settings saved.` });
  };

  const deleteActiveGroup = () => {
    if (!activeGroup) return;
    const remaining = groups.filter(({ id }) => id !== activeGroup.id);
    setGroups(remaining);
    setServerSettingsOpen(false);
    setActiveGroupId(remaining[0]?.id ?? '');
    setActiveSurface(remaining.length ? 'groups' : 'explore');
    setSelectedConversationId(remaining[0]?.channels[0]?.conversationId ?? '');
    setNotice({ tone: 'info', text: `${activeGroup.name} was deleted.` });
  };

  const activeChannelName = selectedChannel?.name ?? selectedConversation?.title ?? 'conversation';
  const activeServerSettings = activeGroup ? serverSettingsFor(activeGroup) : undefined;
  const hideGroupWorkspaceHeader =
    activeSurface === 'groups' && Boolean(activeGroup) && !SHOW_GROUP_WORKSPACE_HEADER;
  const groupSidebarLayoutClass =
    activeSurface === 'groups' && activeGroup
      ? SHOW_SERVER_PROFILE_BANNER
        ? 'workspace-sidebar-group-banner'
        : hideGroupWorkspaceHeader
          ? 'workspace-sidebar-group-compact'
          : 'workspace-sidebar-group-header'
      : '';

  return (
    <main
      className="app-shell"
      data-testid={E2E_SELECTORS.appShell}
      data-app-theme={applicationPreferences.theme}
      data-density={applicationPreferences.density}
      data-high-contrast={applicationPreferences.highContrast ? 'true' : 'false'}
      data-reduced-motion={applicationPreferences.reducedMotion ? 'true' : 'false'}
      data-text-size={applicationPreferences.textSize}
    >
      <section
        className={`app-window ${activeSurface === 'groups' && activeGroup ? 'server-profile-themed' : ''} ${showMembers ? '' : 'members-collapsed'} ${mobileNavigationOpen ? 'mobile-navigation-open' : 'mobile-conversation-open'}`}
        style={serverThemeStyle(activeSurface === 'groups' ? activeGroup : undefined)}
      >
        <ServerRail
          activeGroupId={activeGroupId}
          activeSurface={activeSurface}
          conversations={conversations}
          groups={groups}
          onCreateGroup={() => setDialogMode('group')}
          onExplore={() => {
            setActiveSurface('explore');
            setSelectedConversationId('');
          }}
          onOpenDms={openDms}
          onOpenGroup={openGroup}
        />

        <aside
          className={`workspace-sidebar ${groupSidebarLayoutClass}`}
          aria-label="Workspace navigation"
        >
          {activeSurface === 'groups' && activeGroup && SHOW_SERVER_PROFILE_BANNER ? (
            <div
              className="group-server-banner group-server-banner-top"
              style={{
                backgroundColor: activeServerSettings?.bannerColor,
                backgroundImage: activeServerSettings?.bannerUrl
                  ? `linear-gradient(90deg, rgb(0 0 0 / 68%), rgb(0 0 0 / 12%)), url(${activeServerSettings.bannerUrl})`
                  : undefined,
                backgroundPosition: activeServerSettings
                  ? `${activeServerSettings.bannerPosition.x}% ${activeServerSettings.bannerPosition.y}%`
                  : undefined,
              }}
            >
              <ServerProfileIcon className="group-server-banner-icon" group={activeGroup} />
              <div>
                <strong>{activeGroup.name}</strong>
                <span>{activeGroup.description}</span>
              </div>
            </div>
          ) : null}
          {!hideGroupWorkspaceHeader ? (
            <>
              <header className="workspace-titlebar workspace-titlebar-interactive">
                <div>
                  <strong>{activeSurface === 'dms' ? 'Direct Messages' : activeGroup?.name}</strong>
                  <span>
                    {activeSurface === 'dms'
                      ? 'Private conversations and group DMs.'
                      : activeGroup?.description}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Workspace menu"
                  aria-expanded={workspaceMenuOpen}
                  onClick={() => setWorkspaceMenuOpen((open) => !open)}
                >
                  <CaretDown size={17} />
                </button>
                {workspaceMenuOpen ? (
                  <div className="workspace-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => setDialogMode('group')}>
                      Create group
                    </button>
                    {activeSurface === 'groups' ? (
                      <>
                        {canManageActiveGroup ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openServerSettings('profile')}
                          >
                            Server Settings
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setWorkspaceMenuOpen(false);
                            setGroupInviteOpen(true);
                          }}
                        >
                          Invite to server
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => openChannelDialog('text')}
                        >
                          Create channel
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setWorkspaceMenuOpen(false);
                            setCategoryDialogOpen(true);
                          }}
                        >
                          Create category
                        </button>
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={hideMutedChannels}
                          onClick={toggleHideMutedChannels}
                        >
                          {hideMutedChannels ? 'Show muted channels' : 'Hide muted channels'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setWorkspaceMenuOpen(false);
                            setEventsOpen(true);
                          }}
                        >
                          Events
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setWorkspaceMenuOpen(false);
                            setAssetDialog('sound');
                          }}
                        >
                          Add soundboard sound
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setWorkspaceMenuOpen(false);
                            setAssetDialog('emote');
                          }}
                        >
                          Add custom emote
                        </button>
                      </>
                    ) : null}
                    {activeSurface !== 'groups' ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          setNotice({
                            tone: 'info',
                            text: 'Workspace settings are available inside a server.',
                          })
                        }
                      >
                        Workspace settings
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </header>

              <div className="workspace-trust-row">
                <span>
                  <span className="status-dot" /> Local server
                </span>
                <span>
                  <LockSimple size={14} weight="bold" /> Encrypted
                </span>
              </div>
            </>
          ) : null}

          <div className="workspace-scroll">
            {activeSurface === 'dms' || activeSurface === 'threads' ? (
              <DirectMessageNavigation
                activeSurface={activeSurface}
                conversations={directMessages}
                pendingFriendCount={friendState.incoming.length}
                selectedConversationId={selectedConversationId}
                onCreate={() => setDialogMode('dm')}
                onHome={() => {
                  setActiveSurface('dms');
                  setSelectedConversationId('');
                  setMobileNavigationOpen(false);
                }}
                onSelect={(id) => selectConversation(id, 'dms')}
                onThreads={() => {
                  setActiveSurface('threads');
                  setSelectedConversationId('');
                }}
              />
            ) : null}

            {activeSurface === 'groups' && activeGroup ? (
              <GroupNavigation
                conversations={conversations}
                group={activeGroup}
                currentUserId={user.id}
                localAvatar={profile.avatar}
                localSpeaking={localSpeaking}
                members={members}
                selectedConversationId={selectedConversationId}
                canManage={canManageActiveGroup}
                hideMutedChannels={hideMutedChannels}
                onCreateChannel={() => openChannelDialog('text')}
                onCreateCategory={() => setCategoryDialogOpen(true)}
                onCreateForum={() => openChannelDialog('forum')}
                onEvents={() => setEventsOpen(true)}
                onInvite={() => setGroupInviteOpen(true)}
                onToggleHideMuted={toggleHideMutedChannels}
                onToggleMute={toggleChannelMuted}
                onSettings={() => openServerSettings('profile')}
                onCreateText={() => openChannelDialog('text')}
                onCreateVoice={() => openChannelDialog('voice')}
                onJoinVoice={joinVoiceChannel}
                onSelectText={(id) => selectConversation(id, 'groups')}
              />
            ) : null}

            {activeSurface === 'explore' ? (
              <nav className="primary-nav" aria-label="Explore destinations">
                <button type="button" className="primary-nav-item primary-nav-item-active">
                  <Compass size={19} /> Discover groups
                </button>
                <button
                  type="button"
                  className="primary-nav-item"
                  onClick={() => setDialogMode('group')}
                >
                  <Plus size={19} /> Create a group
                </button>
              </nav>
            ) : null}
          </div>

          {joinedVoice ? (
            <VoiceConnectionPanel
              channelName={joinedVoice.channel.name}
              groupName={joinedVoice.group.name}
              onAction={runVoiceQuickAction}
              onLeave={leaveVoiceChannel}
            />
          ) : null}

          <footer className="user-panel">
            <button
              type="button"
              className="user-identity"
              onClick={() => {
                setProfileOpen((open) => !open);
                setPresenceMenuOpen(false);
              }}
              aria-expanded={profileOpen}
            >
              <DecoratedProfileAvatar
                profile={profile}
                status={publicPresenceStatus(profile.presence)}
              />
              <span>
                <strong>{profile.displayName}</strong>
                <small className={`user-presence-${profile.presence}`}>
                  {presenceLabel(profile.presence)}
                </small>
              </span>
            </button>
            <IconButton
              label={muted ? 'Unmute microphone' : 'Mute microphone'}
              pressed={muted}
              tone="danger"
              onClick={() => setMuted((current) => !current)}
            >
              <Microphone size={18} />
            </IconButton>
            <IconButton
              label={deafened ? 'Undeafen' : 'Deafen'}
              pressed={deafened}
              tone="danger"
              onClick={() => setDeafened((current) => !current)}
            >
              <Headphones size={18} />
            </IconButton>
            <IconButton
              label="User settings"
              onClick={() => {
                setProfileOpen(false);
                setPresenceMenuOpen(false);
                setApplicationSettingsOpen(true);
              }}
            >
              <GearSix size={18} />
            </IconButton>
            {profileOpen ? (
              <div className="profile-popover" role="dialog" aria-label="Profile menu">
                <div
                  className={`profile-popover-preview profile-effect-${profile.profileEffect}`}
                  style={{ backgroundColor: profile.bannerColor }}
                >
                  <DecoratedProfileAvatar profile={profile} />
                  {profile.profileEffect !== 'none' ? (
                    <span className="profile-effect-mark" aria-hidden="true">
                      <ProfileEffectIcon effect={profile.profileEffect} size={20} />
                    </span>
                  ) : null}
                </div>
                <div className="profile-popover-name-row">
                  <strong
                    className={`profile-display-name profile-display-name-${profile.displayNameStyle}`}
                    style={{ color: profile.displayNameColor }}
                  >
                    {profile.displayName}
                  </strong>
                  <button
                    type="button"
                    className="profile-name-copy"
                    aria-label={`Copy display name ${profile.displayName}`}
                    title="Copy display name"
                    onClick={() => {
                      void navigator.clipboard.writeText(profile.displayName);
                      setNotice({ tone: 'info', text: 'Display name copied.' });
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <span>{profile.bio}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setPresenceMenuOpen(false);
                    setProfileDialogOpen(true);
                  }}
                >
                  <Camera size={16} /> Edit profile
                </button>
                <div className="presence-menu-anchor">
                  <button
                    type="button"
                    className="presence-menu-trigger"
                    aria-haspopup="menu"
                    aria-expanded={presenceMenuOpen}
                    onClick={() => setPresenceMenuOpen((open) => !open)}
                  >
                    <span className={`presence-menu-icon presence-${profile.presence}`}>
                      <PresenceIcon status={profile.presence} />
                    </span>
                    <span className="presence-menu-copy">
                      <strong>{presenceLabel(profile.presence)}</strong>
                      {profile.presence !== 'online' ? (
                        <small>{PRESENCE_DESCRIPTIONS[profile.presence]}</small>
                      ) : null}
                    </span>
                    <CaretRight size={16} />
                  </button>
                  {presenceMenuOpen ? (
                    <div className="presence-menu" role="menu" aria-label="Set your status">
                      {PRESENCE_STATUSES.map((status) => (
                        <button
                          type="button"
                          className={`presence-menu-item ${status === profile.presence ? 'active' : ''}`}
                          key={status}
                          role="menuitemradio"
                          aria-checked={status === profile.presence}
                          onClick={() => void selectPresence(status)}
                        >
                          <span className={`presence-menu-icon presence-${status}`}>
                            <PresenceIcon status={status} />
                          </span>
                          <span className="presence-menu-copy">
                            <strong>{PRESENCE_LABELS[status]}</strong>
                            {status !== 'online' ? (
                              <small>{PRESENCE_DESCRIPTIONS[status]}</small>
                            ) : null}
                          </span>
                          {status === profile.presence ? <Check size={16} weight="bold" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </footer>
        </aside>

        <section className="conversation-main" aria-label="Active conversation">
          {showConversation && selectedConversation ? (
            <>
              <ConversationHeader
                activeChannelName={activeChannelName}
                activeGroup={activeGroup}
                memberCount={members.length}
                membersVisible={showMembers}
                notificationsEnabled={notificationsEnabled}
                search={search}
                selectedConversation={selectedConversation}
                onBack={() => setMobileNavigationOpen(true)}
                onMembersToggle={() => setMembersVisible((visible) => !visible)}
                onNotificationsToggle={() => setNotificationsEnabled((enabled) => !enabled)}
                onPinned={() =>
                  setNotice({ tone: 'info', text: 'There are no pinned messages yet.' })
                }
                onSearch={setSearch}
                onVoiceChatToggle={() => setVoiceChatOpen((open) => !open)}
                voiceChatOpen={voiceChatOpen}
              />

              <div className="conversation-body">
                <div
                  className="timeline"
                  data-testid={E2E_SELECTORS.timeline}
                  role="log"
                  aria-live="polite"
                  aria-label="Message timeline"
                >
                  {showNewMessagesBanner && selectedConversation ? (
                    <div className="new-messages-banner" role="status">
                      <span>
                        {activeUnreadCount} new message{activeUnreadCount === 1 ? '' : 's'} since{' '}
                        {formatReadTime(selectedConversation.lastReadAt)}
                      </span>
                      <button type="button" onClick={() => void markConversationRead()}>
                        Mark as read <Check size={15} weight="bold" />
                      </button>
                    </div>
                  ) : null}
                  {selectedConversation.channelKind === 'voice' ? (
                    <div className="voice-room-layout">
                      <div className="voice-room-stage">
                        <VoicePreviewPanel
                          key={selectedConversation.id}
                          connected={selectedChannel?.participantIds.includes(user.id) ?? false}
                          localUser={{
                            avatar: profile.avatar,
                            identity: user.id,
                            name: profile.displayName,
                          }}
                          roomName={selectedChannel?.name ?? selectedConversation.title}
                          participants={(selectedChannel?.participantIds ?? [])
                            .map((id) => members.find((member) => member.id === id))
                            .filter((member): member is WorkspaceMember => Boolean(member))
                            .map((member) => ({
                              avatar: member.id === user.id ? profile.avatar : member.avatar,
                              identity: member.id,
                              isSpeaking: false,
                              name: member.name,
                            }))}
                          onConnectionChange={updateVoiceConnection}
                          onSpeakingChange={setLocalSpeaking}
                          sounds={availableSounds}
                        />
                      </div>
                    </div>
                  ) : selectedConversation.channelKind === 'forum' && selectedChannel ? (
                    <ForumChannelView
                      channel={selectedChannel}
                      currentUserId={user.id}
                      localAvatar={profile.avatar}
                      localUserName={profile.displayName}
                      onCreatePost={(title, body) =>
                        createForumPost(selectedChannel.id, title, body)
                      }
                      onReply={(postId, body) => addForumReply(selectedChannel.id, postId, body)}
                    />
                  ) : (
                    <MessageList
                      composer={composer}
                      editingMessage={editingMessage}
                      isLoading={isLoading}
                      messages={filteredMessages}
                      emotes={availableEmotes}
                      ownAvatar={profile.avatar}
                      onDelete={(message) => void handleDelete(message)}
                      onEdit={(message) => {
                        setEditingMessage(message);
                        setReplyTo(undefined);
                        setComposer(message.body);
                      }}
                      onReact={(message, emoji) => void handleReact(message, emoji)}
                      onReply={(message) =>
                        setReplyTo({
                          id: message.id,
                          author: message.senderName,
                          body: message.body,
                        })
                      }
                      onRetry={(message) =>
                        void repository
                          .retryMessage(selectedConversationId, message.id)
                          .then(refreshMessages)
                      }
                    />
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

                {!isVoiceConversation && selectedConversation.channelKind !== 'forum' ? (
                  <Composer
                    activeChannelName={activeChannelName}
                    attachments={attachments}
                    composer={composer}
                    editingMessage={editingMessage}
                    isLoading={isLoading}
                    isSending={isSending}
                    replyTo={replyTo}
                    emotes={availableEmotes}
                    onCancelContext={() => {
                      setEditingMessage(undefined);
                      setReplyTo(undefined);
                      if (editingMessage) setComposer('');
                    }}
                    onChange={handleComposerChange}
                    onFiles={handleFiles}
                    onInsert={(value) =>
                      setComposer((current) => `${current}${current ? ' ' : ''}${value}`)
                    }
                    onMediaSelect={handleMediaSelect}
                    onOpenEmojiSettings={
                      activeSurface === 'groups' && canManageActiveGroup
                        ? () => openServerSettings('emoji')
                        : undefined
                    }
                    onKeyDown={handleComposerKeyDown}
                    onRemoveAttachment={(id) =>
                      setAttachments((current) => current.filter((item) => item.id !== id))
                    }
                    onSubmit={handleSubmit}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <LandingPanel
              groups={groups}
              surface={activeSurface}
              onCreateDm={() => setDialogMode('dm')}
              onCreateGroup={() => setDialogMode('group')}
              friendCode={friendCode}
              friendState={friendState}
              onAddFriend={() => setFriendDialogOpen(true)}
              onFriendResponse={(id, action) => void handleFriendResponse(id, action)}
              onOpenGroup={openGroup}
            />
          )}
        </section>

        {showMembers && isVoiceConversation ? (
          voiceChatOpen ? (
            <VoiceChatSidebar
              activeChannelName={activeChannelName}
              attachments={attachments}
              composer={composer}
              editingMessage={editingMessage}
              emotes={availableEmotes}
              isLoading={isLoading}
              isSending={isSending}
              messages={filteredMessages}
              ownAvatar={profile.avatar}
              replyTo={replyTo}
              onClose={() => setVoiceChatOpen(false)}
              onDelete={(message) => void handleDelete(message)}
              onEdit={(message) => {
                setEditingMessage(message);
                setReplyTo(undefined);
                setComposer(message.body);
              }}
              onReact={(message, emoji) => void handleReact(message, emoji)}
              onReply={(message) =>
                setReplyTo({ id: message.id, author: message.senderName, body: message.body })
              }
              onRetry={(message) =>
                void repository
                  .retryMessage(selectedConversationId, message.id)
                  .then(refreshMessages)
              }
              onCancelContext={() => {
                setEditingMessage(undefined);
                setReplyTo(undefined);
                if (editingMessage) setComposer('');
              }}
              onChange={handleComposerChange}
              onFiles={handleFiles}
              onInsert={(value) =>
                setComposer((current) => `${current}${current ? ' ' : ''}${value}`)
              }
              onMediaSelect={handleMediaSelect}
              onOpenEmojiSettings={
                activeSurface === 'groups' && canManageActiveGroup
                  ? () => openServerSettings('emoji')
                  : undefined
              }
              onKeyDown={handleComposerKeyDown}
              onRemoveAttachment={(id) =>
                setAttachments((current) => current.filter((item) => item.id !== id))
              }
              onSubmit={handleSubmit}
            />
          ) : (
            <VoiceMembersSidebar
              currentUserId={user.id}
              localAvatar={profile.avatar}
              localSpeaking={localSpeaking}
              participants={(selectedChannel?.participantIds ?? [])
                .map((id) => members.find((member) => member.id === id))
                .filter((member): member is WorkspaceMember => Boolean(member))}
            />
          )
        ) : showMembers ? (
          <MembersSidebar
            members={members}
            onInvite={() => setGroupInviteOpen(true)}
            onNotice={setNotice}
          />
        ) : null}
      </section>

      {dialogMode ? (
        <CreationDialog
          mode={dialogMode}
          groupName={activeGroup?.name}
          onCancel={() => setDialogMode(undefined)}
          onCreate={(name) => void createFromDialog(name)}
        />
      ) : null}
      {channelDialogOpen && activeGroup ? (
        <ChannelCreationDialog
          group={activeGroup}
          initialKind={channelDialogKind}
          onCancel={() => setChannelDialogOpen(false)}
          onCreate={(draft) => void createChannel(draft)}
        />
      ) : null}
      {categoryDialogOpen && activeGroup ? (
        <CategoryCreationDialog
          groupName={activeGroup.name}
          onCancel={() => setCategoryDialogOpen(false)}
          onCreate={createCategory}
        />
      ) : null}
      {eventsOpen && activeGroup ? (
        <EventsPanel
          group={activeGroup}
          currentUserId={user.id}
          onCancel={() => setEventsOpen(false)}
          onCreate={(event) => void createServerEvent(event)}
        />
      ) : null}
      {friendDialogOpen ? (
        <FriendCodeDialog
          friendCode={friendCode}
          onCancel={() => setFriendDialogOpen(false)}
          onSubmit={(code) => void addFriendByCode(code)}
        />
      ) : null}
      {profileDialogOpen ? (
        <ProfileSettingsDialog
          profile={profile}
          onCancel={() => setProfileDialogOpen(false)}
          onSave={(nextProfile) => {
            setProfile(nextProfile);
            setProfileDialogOpen(false);
            setNotice({ tone: 'info', text: 'Profile updated on this device.' });
          }}
        />
      ) : null}
      {applicationSettingsOpen ? (
        <ApplicationSettingsDialog
          credential={googleCredential}
          onChange={updateApplicationPreferences}
          onClose={() => setApplicationSettingsOpen(false)}
          onEditProfile={() => {
            setApplicationSettingsOpen(false);
            setProfileDialogOpen(true);
          }}
          onLogout={logOut}
          preferences={applicationPreferences}
          profile={profile}
          user={user}
        />
      ) : null}
      {groupInviteOpen && activeGroup ? (
        <GroupInviteDialog
          friends={friendState.friends}
          group={activeGroup}
          onCancel={() => setGroupInviteOpen(false)}
          onInvite={(friendId) => void handleGroupInvite(friendId)}
        />
      ) : null}
      {assetDialog && activeGroup ? (
        <GroupAssetDialog
          groupName={activeGroup.name}
          type={assetDialog}
          onCancel={() => setAssetDialog(undefined)}
          onSave={addGroupAsset}
        />
      ) : null}
      {serverSettingsOpen && activeGroup ? (
        <ServerSettingsDialog
          currentUserAvatar={profile.avatar}
          currentUserId={user.id}
          currentUserName={profile.displayName}
          group={activeGroup}
          initialSection={serverSettingsSection}
          onCancel={() => setServerSettingsOpen(false)}
          onDelete={deleteActiveGroup}
          onInvite={() => {
            setServerSettingsOpen(false);
            setGroupInviteOpen(true);
          }}
          onSave={saveServerSettings}
        />
      ) : null}
    </main>
  );
}

function VoiceConnectionPanel({
  channelName,
  groupName,
  onAction,
  onLeave,
}: {
  channelName: string;
  groupName: string;
  onAction: (action: VoiceQuickAction) => void;
  onLeave: () => void;
}) {
  return (
    <section className="voice-connection-panel" aria-label="Voice connection controls">
      <div className="voice-connection-status">
        <span className="voice-connection-mark">
          <Waveform size={20} weight="bold" />
        </span>
        <span>
          <strong>Voice Connected</strong>
          <small>
            {channelName} / {groupName}
          </small>
        </span>
        <button type="button" aria-label="Disconnect from voice" onClick={onLeave}>
          <PhoneDisconnect size={19} weight="fill" />
        </button>
      </div>
      <div className="voice-quick-actions">
        <button type="button" aria-label="Toggle camera" onClick={() => onAction('camera')}>
          <VideoCameraSlash size={20} />
        </button>
        <button
          type="button"
          aria-label="Share screen or application"
          onClick={() => onAction('share')}
        >
          <MonitorArrowUp size={20} />
        </button>
        <button type="button" aria-label="Open soundboard" onClick={() => onAction('soundboard')}>
          <Confetti size={20} />
        </button>
        <button type="button" aria-label="Open voice settings" onClick={() => onAction('settings')}>
          <GearSix size={20} />
        </button>
      </div>
    </section>
  );
}

function ServerRail({
  activeGroupId,
  activeSurface,
  conversations,
  groups,
  onCreateGroup,
  onExplore,
  onOpenDms,
  onOpenGroup,
}: {
  activeGroupId: string;
  activeSurface: AppSurface;
  conversations: Conversation[];
  groups: WorkspaceGroup[];
  onCreateGroup: () => void;
  onExplore: () => void;
  onOpenDms: () => void;
  onOpenGroup: (id: string) => void;
}) {
  return (
    <aside className="server-rail" aria-label="Application tabs">
      <button
        type="button"
        className={`server-mark server-mark-brand ${activeSurface === 'dms' ? 'server-mark-active' : ''}`}
        aria-label="Direct messages"
        onClick={onOpenDms}
      >
        <img src="/scuttlebutt-mark.webp" alt="" />
        <span className="visually-hidden">{APP_NAME}</span>
      </button>
      <div className="server-rail-divider" />
      {groups.map((group) =>
        (() => {
          const summary = notificationSummaryForGroup(group, conversations);
          return (
            <button
              type="button"
              className={`server-mark ${activeSurface === 'groups' && activeGroupId === group.id ? 'server-mark-active' : ''}`}
              aria-label={`${group.name} group${summary.unreadCount > 0 ? `, ${summary.unreadCount} unread` : ''}`}
              title={group.name}
              key={group.id}
              style={serverThemeStyle(group)}
              onClick={() => onOpenGroup(group.id)}
            >
              <ServerProfileIcon group={group} />
              {summary.unreadCount > 0 ? (
                <NotificationMarker
                  direct={summary.hasDirectActivity}
                  label={
                    summary.hasDirectActivity
                      ? `${group.name} has a mention or reply for you`
                      : `${group.name} has unread activity`
                  }
                />
              ) : null}
            </button>
          );
        })(),
      )}
      <button
        type="button"
        className="server-mark server-mark-add"
        aria-label="Create a group"
        onClick={onCreateGroup}
      >
        <Plus size={23} />
      </button>
      <button
        type="button"
        className={`server-mark server-mark-explore ${activeSurface === 'explore' ? 'server-mark-active' : ''}`}
        aria-label="Explore groups"
        onClick={onExplore}
      >
        <Compass size={22} />
      </button>
    </aside>
  );
}

function DirectMessageNavigation({
  activeSurface,
  conversations,
  onCreate,
  onHome,
  onSelect,
  onThreads,
  pendingFriendCount,
  selectedConversationId,
}: {
  activeSurface: AppSurface;
  conversations: Conversation[];
  onCreate: () => void;
  onHome: () => void;
  onSelect: (id: string) => void;
  onThreads: () => void;
  pendingFriendCount: number;
  selectedConversationId: string;
}) {
  return (
    <>
      <nav className="primary-nav" aria-label="Direct message destinations">
        <button
          type="button"
          className={`primary-nav-item ${activeSurface === 'dms' && !selectedConversationId ? 'primary-nav-item-active' : ''}`}
          onClick={onHome}
        >
          <Users size={19} weight="fill" /> Friends
          {pendingFriendCount > 0 ? (
            <strong className="nav-request-count">{pendingFriendCount}</strong>
          ) : null}
        </button>
        <button
          type="button"
          className={`primary-nav-item ${activeSurface === 'threads' ? 'primary-nav-item-active' : ''}`}
          onClick={onThreads}
        >
          <ChatCenteredDots size={19} /> Threads
        </button>
      </nav>
      <div className="nav-section">
        <div className="nav-section-heading">
          <span>Direct messages</span>
          <button type="button" aria-label="Start a direct message" onClick={onCreate}>
            <Plus size={16} />
          </button>
        </div>
        <div className="dm-list" data-testid={E2E_SELECTORS.conversationList}>
          {conversations.map((conversation) => (
            <button
              type="button"
              className={`dm-button ${conversation.id === selectedConversationId ? 'dm-button-active' : ''} ${conversation.unreadCount > 0 ? 'dm-button-unread' : ''}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            >
              <PersonAvatar
                image={conversation.avatarUrl}
                name={conversation.title}
                status="online"
                size="small"
              />
              <span>{conversation.title}</span>
              {conversation.unreadCount > 0 ? (
                <strong className={conversation.hasMention ? 'dm-mention-count' : undefined}>
                  {conversation.hasMention ? '@' : conversation.unreadCount}
                </strong>
              ) : null}
            </button>
          ))}
          <button type="button" className="dm-button" onClick={onCreate}>
            <span className="group-avatar">
              <Plus size={15} />
            </span>
            <span>New conversation</span>
          </button>
        </div>
      </div>
    </>
  );
}

function GroupNavigation({
  canManage,
  conversations,
  currentUserId,
  group,
  hideMutedChannels,
  localAvatar,
  localSpeaking,
  members,
  onCreateCategory,
  onCreateChannel,
  onCreateForum,
  onEvents,
  onInvite,
  onToggleHideMuted,
  onToggleMute,
  onCreateText,
  onCreateVoice,
  onJoinVoice,
  onSettings,
  onSelectText,
  selectedConversationId,
}: {
  canManage: boolean;
  conversations: Conversation[];
  currentUserId: string;
  group: WorkspaceGroup;
  hideMutedChannels: boolean;
  localAvatar: string;
  localSpeaking: boolean;
  members: WorkspaceMember[];
  onCreateCategory: () => void;
  onCreateChannel: () => void;
  onCreateForum: () => void;
  onEvents: () => void;
  onInvite: () => void;
  onToggleHideMuted: () => void;
  onToggleMute: (channelId: string) => void;
  onCreateText: () => void;
  onCreateVoice: () => void;
  onJoinVoice: (id: string) => void;
  onSettings: () => void;
  onSelectText: (id: string) => void;
  selectedConversationId: string;
}) {
  const [contextMenu, setContextMenu] = useState<{
    channelId?: string;
    x: number;
    y: number;
  }>();
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const visibleChannels = group.channels.filter(
    (channel) =>
      canViewWorkspaceChannel(group, channel, currentUserId) &&
      (!hideMutedChannels || !channel.muted),
  );
  const categories = group.categories ?? [];
  const contextChannel = contextMenu?.channelId
    ? group.channels.find(({ id }) => id === contextMenu.channelId)
    : undefined;

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeMenu = () => setContextMenu(undefined);
    window.addEventListener('click', closeMenu);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('resize', closeMenu);
    };
  }, [contextMenu]);

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    const channelId = target.closest<HTMLElement>('[data-channel-id]')?.dataset.channelId;
    setContextMenu({
      channelId,
      x: Math.min(Math.max(8, event.clientX), Math.max(8, window.innerWidth - 232)),
      y: Math.min(Math.max(8, event.clientY), Math.max(8, window.innerHeight - 190)),
    });
  };

  const runContextAction = (action: () => void) => {
    setContextMenu(undefined);
    action();
  };

  const selectChannel = (conversationId: string) => {
    onSelectText(conversationId);
  };
  const joinVoice = (conversationId: string) => {
    onJoinVoice(conversationId);
  };

  const renderChannelSections = (
    channels: WorkspaceChannel[],
    showHeadings = true,
    sectionPrefix = 'root',
  ) => {
    const textChannels = channels.filter(({ kind }) => kind === 'text');
    const forumChannels = channels.filter(({ kind }) => kind === 'forum');
    const voiceChannels = channels.filter(({ kind }) => kind === 'voice');
    const renderSection = (
      sectionChannels: WorkspaceChannel[],
      type: 'text' | 'voice' | 'forum',
      title: string,
      onCreate: () => void,
    ) => {
      const sectionKey = `${sectionPrefix}-${type}`;
      const collapsed = showHeadings ? (collapsedSections[sectionKey] ?? false) : false;
      return (
        <ChannelSection
          channels={sectionChannels}
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onCreate={onCreate}
          onSelect={type === 'voice' ? joinVoice : selectChannel}
          onToggleMute={onToggleMute}
          showHeading={showHeadings}
          title={title}
          type={type}
          collapsed={collapsed}
          collapseId={showHeadings ? `channel-section-${sectionKey}` : undefined}
          onToggleCollapse={
            showHeadings
              ? () =>
                  setCollapsedSections((current) => ({
                    ...current,
                    [sectionKey]: !collapsed,
                  }))
              : undefined
          }
          localAvatar={localAvatar}
          localSpeaking={localSpeaking}
          currentUserId={currentUserId}
          members={members}
        />
      );
    };
    return (
      <>
        {renderSection(textChannels, 'text', 'Text channels', onCreateText)}
        {forumChannels.length || !showHeadings
          ? renderSection(forumChannels, 'forum', 'Forum channels', onCreateForum)
          : null}
        {renderSection(voiceChannels, 'voice', 'Voice channels', onCreateVoice)}
      </>
    );
  };

  return (
    <div className="group-channel-navigation" onContextMenu={handleContextMenu}>
      <div className="community-heading">
        <div className="community-heading-title">
          <ServerProfileIcon className="community-heading-icon" group={group} />
          <span className="community-heading-name">{group.name}</span>
        </div>
        {canManage ? (
          <button type="button" aria-label="Server settings" onClick={onSettings}>
            <GearSix size={16} />
          </button>
        ) : null}
        <button type="button" aria-label="Add a group channel" onClick={onCreateText}>
          <Plus size={16} />
        </button>
      </div>
      <button type="button" className="server-events-button" onClick={onEvents}>
        <CalendarBlank size={18} />
        <span>Events</span>
        <span className="server-events-count">{group.events?.length ?? 0}</span>
      </button>
      {renderChannelSections(visibleChannels.filter((channel) => !channel.categoryId))}
      {categories.map((category) => {
        const categoryChannels = visibleChannels.filter(
          ({ categoryId }) => categoryId === category.id,
        );
        const collapsed = collapsedCategories[category.id] ?? category.collapsed ?? false;
        return (
          <section className="channel-category" key={category.id}>
            <div className="channel-category-heading">
              <button
                type="button"
                aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${category.name}`}
                aria-expanded={!collapsed}
                aria-controls={`category-channels-${category.id}`}
                onClick={() =>
                  setCollapsedCategories((current) => ({
                    ...current,
                    [category.id]: !collapsed,
                  }))
                }
              >
                {collapsed ? <CaretRight size={13} /> : <CaretDown size={13} />}
                <span>{category.name}</span>
              </button>
              <button
                type="button"
                aria-label={`Add channel to ${category.name}`}
                onClick={onCreateChannel}
              >
                <Plus size={15} />
              </button>
            </div>
            <div
              id={`category-channels-${category.id}`}
              className="category-channel-list"
              hidden={collapsed}
            >
              {renderChannelSections(categoryChannels, false, `category-${category.id}`)}
            </div>
          </section>
        );
      })}
      {contextMenu ? (
        <div
          className="channel-context-menu"
          role="menu"
          aria-label={`${group.name} channel actions`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              contextChannel
                ? runContextAction(() => onToggleMute(contextChannel.id))
                : runContextAction(onToggleHideMuted)
            }
          >
            {contextChannel?.muted ? <BellSlash size={16} /> : <Bell size={16} />}
            <span>
              {contextChannel
                ? contextChannel.muted
                  ? 'Unmute channel'
                  : 'Mute channel'
                : hideMutedChannels
                  ? 'Show muted channels'
                  : 'Hide muted channels'}
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => runContextAction(onCreateChannel)}>
            <Plus size={16} />
            <span>Create Channel</span>
          </button>
          <button type="button" role="menuitem" onClick={() => runContextAction(onCreateCategory)}>
            <Plus size={16} />
            <span>Create category</span>
          </button>
          <button type="button" role="menuitem" onClick={() => runContextAction(onInvite)}>
            <UserPlus size={16} />
            <span>Invite to server</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ChannelSection({
  channels,
  collapsed = false,
  collapseId,
  conversations,
  currentUserId,
  localAvatar,
  localSpeaking,
  members,
  onCreate,
  onSelect,
  onToggleCollapse,
  onToggleMute,
  selectedConversationId,
  showHeading = true,
  title,
  type,
}: {
  channels: WorkspaceChannel[];
  collapsed?: boolean;
  collapseId?: string;
  conversations: Conversation[];
  currentUserId: string;
  localAvatar: string;
  localSpeaking: boolean;
  members: WorkspaceMember[];
  onCreate: () => void;
  onSelect: (conversationId: string) => void;
  onToggleCollapse?: () => void;
  onToggleMute: (channelId: string) => void;
  selectedConversationId: string;
  showHeading?: boolean;
  title?: string;
  type: 'text' | 'voice' | 'forum';
}) {
  const sectionTitle = title ?? (type === 'voice' ? 'Voice channels' : 'Text channels');
  return (
    <div
      className={`nav-section channel-section ${type === 'voice' ? 'voice-section' : ''} ${showHeading ? '' : 'channel-section-compact'}`}
    >
      {showHeading ? (
        <div className="nav-section-heading">
          <button
            type="button"
            className="nav-section-heading-toggle"
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${sectionTitle}`}
            aria-expanded={!collapsed}
            aria-controls={collapseId}
            onClick={onToggleCollapse}
          >
            {collapsed ? <CaretRight size={13} /> : <CaretDown size={13} />}
            <span>{sectionTitle}</span>
          </button>
          <button type="button" aria-label={`Add a ${type} channel`} onClick={onCreate}>
            <Plus size={16} />
          </button>
        </div>
      ) : null}
      <div id={collapseId} className="channel-section-content" hidden={collapsed}>
        {channels.length === 0 && type !== 'voice' ? (
          <p className="channel-empty">No channels yet</p>
        ) : null}
        {channels.map((channel) => {
          const active = selectedConversationId === channel.conversationId;
          const conversation = conversations.find(({ id }) => id === channel.conversationId);
          const unreadCount = channel.muted ? 0 : (conversation?.unreadCount ?? 0);
          const hasDirectActivity = Boolean(unreadCount > 0 && conversation?.hasMention);
          const unreadLabel = hasDirectActivity
            ? `${channel.name} has a mention or reply for you`
            : `${channel.name} has ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`;
          if (type === 'text' || type === 'forum') {
            return (
              <div className="channel-button-row" data-channel-id={channel.id} key={channel.id}>
                <button
                  type="button"
                  className={`channel-button ${active ? 'channel-button-active' : ''} ${unreadCount > 0 ? 'channel-button-unread' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSelect(channel.conversationId)}
                >
                  {type === 'forum' ? (
                    <ChatCircleText size={18} weight={active ? 'bold' : 'regular'} />
                  ) : (
                    <Hash size={18} weight={active ? 'bold' : 'regular'} />
                  )}
                  <span>{channel.name}</span>
                  {channel.isPrivate ? <LockSimple size={14} /> : null}
                  {channel.muted ? <BellSlash size={14} /> : null}
                  {unreadCount > 0 ? (
                    <NotificationMarker direct={hasDirectActivity} label={unreadLabel} />
                  ) : null}
                </button>
                <button
                  type="button"
                  className="channel-mute-button"
                  aria-label={channel.muted ? `Unmute ${channel.name}` : `Mute ${channel.name}`}
                  aria-pressed={channel.muted}
                  onClick={() => onToggleMute(channel.id)}
                >
                  {channel.muted ? <BellSlash size={14} /> : <Bell size={14} />}
                </button>
              </div>
            );
          }
          const participants = channel.participantIds
            .map((id) => members.find((member) => member.id === id))
            .filter((member): member is WorkspaceMember => Boolean(member));
          return (
            <div
              className={`voice-channel-card ${active ? 'voice-channel-card-active' : ''}`}
              data-channel-id={channel.id}
              key={channel.id}
            >
              <button
                type="button"
                className="voice-channel-name"
                onClick={() => onSelect(channel.conversationId)}
              >
                <SpeakerHigh size={18} weight="fill" />
                <span>
                  <strong>{channel.name}</strong>
                  <small>
                    {participants.length ? `${participants.length} connected` : 'Empty room'}
                  </small>
                </span>
                <Users size={15} />
                <b>{participants.length}</b>
                {unreadCount > 0 ? (
                  <NotificationMarker direct={hasDirectActivity} label={unreadLabel} />
                ) : null}
              </button>
              <button
                type="button"
                className="voice-channel-mute-button"
                aria-label={channel.muted ? `Unmute ${channel.name}` : `Mute ${channel.name}`}
                aria-pressed={channel.muted}
                onClick={() => onToggleMute(channel.id)}
              >
                {channel.muted ? <BellSlash size={14} /> : <Bell size={14} />}
              </button>
              {participants.length > 0 ? (
                <div className="voice-connected-list" aria-label={`${channel.name} participants`}>
                  {participants.map((participant) => (
                    <button
                      type="button"
                      key={participant.id}
                      className={
                        participant.id === currentUserId && localSpeaking
                          ? 'voice-user-speaking'
                          : ''
                      }
                      onClick={() => onSelect(channel.conversationId)}
                    >
                      <PersonAvatar
                        image={participant.id === currentUserId ? localAvatar : participant.avatar}
                        name={participant.name}
                        status={participant.status}
                        size="small"
                      />
                      <span>{participant.name}</span>
                      <Microphone size={13} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConversationHeader({
  activeChannelName,
  activeGroup,
  memberCount,
  membersVisible,
  notificationsEnabled,
  onBack,
  onMembersToggle,
  onNotificationsToggle,
  onPinned,
  onSearch,
  onVoiceChatToggle,
  search,
  selectedConversation,
  voiceChatOpen,
}: {
  activeChannelName: string;
  activeGroup?: WorkspaceGroup;
  memberCount: number;
  membersVisible: boolean;
  notificationsEnabled: boolean;
  onBack: () => void;
  onMembersToggle: () => void;
  onNotificationsToggle: () => void;
  onPinned: () => void;
  onSearch: (value: string) => void;
  onVoiceChatToggle: () => void;
  search: string;
  selectedConversation: Conversation;
  voiceChatOpen: boolean;
}) {
  return (
    <header className="conversation-header">
      <div className="conversation-header-title">
        <button
          type="button"
          className="mobile-conversation-back"
          aria-label="Back to conversations"
          onClick={onBack}
        >
          <ArrowLeft size={22} weight="bold" />
        </button>
        {selectedConversation.kind === 'direct' ? (
          <PersonAvatar
            image={selectedConversation.avatarUrl}
            name={selectedConversation.title}
            status="online"
            size="small"
          />
        ) : selectedConversation.channelKind === 'voice' ? (
          <SpeakerHigh size={23} weight="fill" />
        ) : selectedConversation.channelKind === 'forum' ? (
          <ChatCircleText size={23} weight="bold" />
        ) : (
          <Hash size={23} weight="bold" />
        )}
        <div>
          <div className="conversation-title-line">
            <h1>
              {selectedConversation.kind === 'direct'
                ? selectedConversation.title
                : activeChannelName}
            </h1>
            {selectedConversation.kind !== 'direct' ? <Star size={17} weight="fill" /> : null}
          </div>
          <p>
            {selectedConversation.kind === 'direct'
              ? selectedConversation.presence
              : selectedConversation.channelKind === 'voice'
                ? 'Voice, video, screen sharing, and meeting chat.'
                : selectedConversation.channelKind === 'forum'
                  ? 'Create posts and keep each discussion focused.'
                  : `${activeGroup?.name ?? 'Scuttlebutt'} · Build, ship, and improve.`}
          </p>
        </div>
      </div>
      <div className="conversation-header-actions">
        {selectedConversation.channelKind === 'voice' ? (
          <IconButton
            label={voiceChatOpen ? 'Close voice chat' : 'Open voice chat'}
            pressed={voiceChatOpen}
            onClick={onVoiceChatToggle}
          >
            <ChatCenteredDots size={20} weight="fill" />
          </IconButton>
        ) : null}
        <IconButton
          label={notificationsEnabled ? 'Mute notifications' : 'Enable notifications'}
          pressed={notificationsEnabled}
          onClick={onNotificationsToggle}
        >
          <Bell size={19} />
        </IconButton>
        <IconButton label="Pinned messages" onClick={onPinned}>
          <PushPin size={19} />
        </IconButton>
        <button
          type="button"
          className="member-count-button"
          onClick={onMembersToggle}
          aria-pressed={membersVisible}
        >
          <Users size={19} /> {memberCount}
        </button>
        <label className="header-search">
          <MagnifyingGlass size={18} />
          <span className="visually-hidden">Search this conversation</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search"
          />
          <kbd>/</kbd>
        </label>
      </div>
    </header>
  );
}

function ForumChannelView({
  channel,
  currentUserId,
  localAvatar,
  localUserName,
  onCreatePost,
  onReply,
}: {
  channel: WorkspaceChannel;
  currentUserId: string;
  localAvatar: string;
  localUserName: string;
  onCreatePost: (title: string, body: string) => void;
  onReply: (postId: string, body: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>();
  const [replyDraft, setReplyDraft] = useState('');
  const posts = channel.forumPosts ?? [];
  const filteredPosts = posts.filter((post) =>
    `${post.title} ${post.body}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="forum-view">
      <div className="forum-toolbar">
        <label className="forum-search">
          <MagnifyingGlass size={18} />
          <span className="visually-hidden">Search or create a post</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search or create a post..."
          />
        </label>
        <button type="button" className="forum-new-post" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New Post
        </button>
      </div>
      <div className="forum-get-started">
        <strong>Get Started</strong>
        <span>Keep each topic focused so everyone can find the conversation later.</span>
      </div>
      <div className="forum-post-list">
        {filteredPosts.length === 0 ? (
          <div className="forum-empty-state">
            <ChatCircleText size={34} />
            <strong>{posts.length ? 'No matching posts' : 'No posts yet'}</strong>
            <span>Start a discussion for this channel.</span>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const selected = selectedPostId === post.id;
            return (
              <article
                className={`forum-post-card ${selected ? 'forum-post-card-active' : ''} ${post.authorId === currentUserId ? 'forum-post-own' : ''}`}
                key={post.id}
              >
                <button
                  type="button"
                  className="forum-post-summary"
                  onClick={() => setSelectedPostId(selected ? undefined : post.id)}
                >
                  <div className="forum-post-heading">
                    <strong>{post.title}</strong>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p>{post.body}</p>
                  <div className="forum-post-meta">
                    <PersonAvatar image={post.authorAvatar} name={post.authorName} size="small" />
                    <span>{post.authorName}</span>
                    <span>·</span>
                    <span>
                      {post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}
                    </span>
                  </div>
                </button>
                {selected ? (
                  <div className="forum-thread">
                    {post.replies.map((reply) => (
                      <div className="forum-reply" key={reply.id}>
                        <PersonAvatar
                          image={reply.authorAvatar}
                          name={reply.authorName}
                          size="small"
                        />
                        <div>
                          <strong>{reply.authorName}</strong>
                          <p>{reply.body}</p>
                        </div>
                      </div>
                    ))}
                    <form
                      className="forum-reply-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!replyDraft.trim()) return;
                        onReply(post.id, replyDraft);
                        setReplyDraft('');
                      }}
                    >
                      <PersonAvatar image={localAvatar} name={localUserName} size="small" />
                      <input
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder="Reply to this post"
                        aria-label={`Reply to ${post.title}`}
                      />
                      <button type="submit" disabled={!replyDraft.trim()} aria-label="Send reply">
                        <PaperPlaneRight size={17} weight="fill" />
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      {createOpen ? (
        <ForumPostDialog
          onCancel={() => setCreateOpen(false)}
          onCreate={(title, body) => {
            onCreatePost(title, body);
            setCreateOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ForumPostDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (title: string, body: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="creation-dialog forum-post-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forum-post-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(title, body);
        }}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">Forum post</p>
            <h2 id="forum-post-dialog-title">Start a discussion</h2>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <label>
          <span>Post title</span>
          <input
            autoFocus
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you working on?"
          />
        </label>
        <label>
          <span>Details</span>
          <textarea
            value={body}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add context for the discussion"
          />
        </label>
        <div className="creation-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!title.trim() || !body.trim()}>
            Create post
          </button>
        </div>
      </form>
    </div>
  );
}

function ChannelCreationDialog({
  group,
  initialKind,
  onCancel,
  onCreate,
}: {
  group: WorkspaceGroup;
  initialKind: WorkspaceChannelKind;
  onCancel: () => void;
  onCreate: (draft: ChannelDraft) => void;
}) {
  const [kind, setKind] = useState<WorkspaceChannelKind>(initialKind);
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([]);
  const roles = serverSettingsFor(group).roles;

  const toggleRole = (roleId: string) => {
    setAllowedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="creation-dialog channel-creation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-creation-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate({ kind, name, isPrivate, categoryId: categoryId || undefined, allowedRoleIds });
        }}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">{group.name}</p>
            <h2 id="channel-creation-title">Create Channel</h2>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <fieldset className="channel-type-fieldset">
          <legend>Channel Type</legend>
          {(
            [
              ['text', 'Text', 'Send messages, images, GIFs, emoji, opinions, and puns'],
              ['voice', 'Voice', 'Hang out together with voice, video, and screen share'],
              ['forum', 'Forum', 'Create a space for organized discussions'],
            ] as const
          ).map(([value, label, description]) => (
            <label className="channel-type-option" key={value}>
              <input
                type="radio"
                name="channel-type"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              {value === 'text' ? (
                <Hash size={19} />
              ) : value === 'voice' ? (
                <SpeakerHigh size={19} />
              ) : (
                <ChatCircleText size={19} />
              )}
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label>
          <span>{kind === 'voice' ? 'Channel Name' : 'Channel Name'}</span>
          <input
            value={name}
            maxLength={48}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              kind === 'voice' ? 'Team Standup' : kind === 'forum' ? 'vibe-coding' : 'new-channel'
            }
          />
        </label>
        <label className="channel-category-select">
          <span>Category</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">No category</option>
            {(group.categories ?? []).map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="channel-private-toggle">
          <span>
            <strong>
              <LockSimple size={15} /> Private Channel
            </strong>
            <small>Only selected members and roles will be able to view this channel.</small>
          </span>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
          />
        </label>
        {isPrivate ? (
          <fieldset className="channel-role-fieldset">
            <legend>Who can access this channel?</legend>
            {roles.map((role) => (
              <label key={role.id}>
                <input
                  type="checkbox"
                  checked={allowedRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                />
                <span style={{ color: role.color }}>{role.name}</span>
              </label>
            ))}
            {!allowedRoleIds.length ? (
              <small>Only the server owner can see it until a role is selected.</small>
            ) : null}
          </fieldset>
        ) : null}
        <div className="creation-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>
            Create Channel
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoryCreationDialog({
  groupName,
  onCancel,
  onCreate,
}: {
  groupName: string;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="creation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-creation-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name);
        }}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">{groupName}</p>
            <h2 id="category-creation-title">Create Category</h2>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <label>
          <span>Category Name</span>
          <input
            autoFocus
            value={name}
            maxLength={48}
            onChange={(event) => setName(event.target.value)}
            placeholder="Information"
          />
        </label>
        <p>Group related text, forum, and voice channels under one collapsible heading.</p>
        <div className="creation-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>
            Create Category
          </button>
        </div>
      </form>
    </div>
  );
}

function EventsPanel({
  currentUserId,
  group,
  onCancel,
  onCreate,
}: {
  currentUserId: string;
  group: WorkspaceGroup;
  onCancel: () => void;
  onCreate: (event: ServerEvent) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [locationType, setLocationType] = useState<'external' | 'voice'>('voice');
  const voiceChannels = group.channels.filter(({ kind }) => kind === 'voice');
  const textChannels = group.channels.filter(({ kind }) => kind === 'text');
  const [voiceChannelId, setVoiceChannelId] = useState(voiceChannels[0]?.id ?? '');
  const [externalLocation, setExternalLocation] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('19:00');
  const [frequency, setFrequency] = useState<ServerEventFrequency>('once');
  const [description, setDescription] = useState('');
  const [postChannelId, setPostChannelId] = useState(textChannels[0]?.id ?? '');
  const [coverImage, setCoverImage] = useState('');
  const [error, setError] = useState('');

  const selectedVoice = voiceChannels.find(({ id }) => id === voiceChannelId);
  const location = locationType === 'voice' ? (selectedVoice?.name ?? '') : externalLocation.trim();

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      setCoverImage(await optimizeAvatar(file));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cover image could not be processed.');
    }
  };

  const nextStep = () => {
    if (step === 1 && !location) {
      setError(locationType === 'voice' ? 'Choose a voice channel.' : 'Add an event location.');
      return;
    }
    if (step === 2 && (!title.trim() || !startDate || !startTime)) {
      setError('Add an event topic, date, and time.');
      return;
    }
    setError('');
    setStep((current) => (current === 3 ? 3 : ((current + 1) as 1 | 2 | 3)));
  };

  const create = () => {
    if (!location || !title.trim()) return;
    onCreate({
      id: `event-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      startDate,
      startTime,
      frequency,
      locationType,
      location,
      postChannelId: postChannelId || undefined,
      coverImage: coverImage || undefined,
      createdAt: new Date().toISOString(),
      createdBy: currentUserId,
    });
  };

  return (
    <div className="events-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="events-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="events-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="events-panel-header">
          <div>
            <p className="section-kicker">{group.name}</p>
            <h2 id="events-title">
              <CalendarBlank size={22} /> Events
            </h2>
          </div>
          <button type="button" aria-label="Close events" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>
        {!creating ? (
          <>
            <div className="events-panel-toolbar">
              <span>
                {group.events?.length
                  ? `${group.events.length} upcoming event${group.events.length === 1 ? '' : 's'}`
                  : 'No upcoming events'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setStep(1);
                }}
              >
                <Plus size={16} /> Create Event
              </button>
            </div>
            {group.events?.length ? (
              <div className="events-list">
                {group.events.map((event) => (
                  <article className="event-card" key={event.id}>
                    {event.coverImage ? (
                      <img src={event.coverImage} alt="" />
                    ) : (
                      <span className="event-card-icon">
                        <CalendarBlank size={25} />
                      </span>
                    )}
                    <div>
                      <strong>{event.title}</strong>
                      <span>
                        {new Date(`${event.startDate}T${event.startTime}`).toLocaleString()}
                      </span>
                      <span>
                        <MapPin size={14} /> {formatEventLocation(event)}
                      </span>
                      {event.frequency !== 'once' ? (
                        <span>
                          <Repeat size={14} /> {formatEventFrequency(event.frequency)}
                        </span>
                      ) : null}
                      {event.description ? <p>{event.description}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="events-empty-state">
                <CalendarBlank size={42} />
                <strong>There are no upcoming events.</strong>
                <span>
                  Schedule an event for a voice channel, external link, or in-person location.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="event-wizard">
            <div className="event-wizard-steps" aria-label="Event creation steps">
              {['Location', 'Event Info', 'Review'].map((label, index) => (
                <span
                  className={step === index + 1 ? 'active' : step > index + 1 ? 'complete' : ''}
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
            {step === 1 ? (
              <div className="event-wizard-step">
                <h3>Where is your event?</h3>
                <p>So no one gets lost on where to go.</p>
                <label className="event-location-option">
                  <input
                    type="radio"
                    checked={locationType === 'voice'}
                    onChange={() => setLocationType('voice')}
                  />
                  <SpeakerHigh size={20} />
                  <span>
                    <strong>Voice Channel</strong>
                    <small>Hang out with voice, video, screenshare, and Go Live.</small>
                  </span>
                </label>
                {locationType === 'voice' ? (
                  <label className="event-select-field">
                    <span>Select a channel</span>
                    <select
                      value={voiceChannelId}
                      onChange={(event) => setVoiceChannelId(event.target.value)}
                    >
                      <option value="">Choose a voice channel</option>
                      {voiceChannels.map((channel) => (
                        <option value={channel.id} key={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="event-location-option">
                  <input
                    type="radio"
                    checked={locationType === 'external'}
                    onChange={() => setLocationType('external')}
                  />
                  <MapPin size={20} />
                  <span>
                    <strong>Somewhere Else</strong>
                    <small>Text channel, external link, or in-person location.</small>
                  </span>
                </label>
                {locationType === 'external' ? (
                  <input
                    className="event-location-input"
                    value={externalLocation}
                    onChange={(event) => setExternalLocation(event.target.value)}
                    placeholder="Add a location, link, or something."
                  />
                ) : null}
              </div>
            ) : null}
            {step === 2 ? (
              <div className="event-wizard-step">
                <h3>What's your event about?</h3>
                <p>Fill out the details of your event.</p>
                <label>
                  <span>Event Topic *</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What's your event?"
                  />
                </label>
                <div className="event-two-column">
                  <label>
                    <span>Start Date *</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Start Time *</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  <span>Event Frequency *</span>
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value as ServerEventFrequency)}
                  >
                    <option value="once">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell people a little more about your event."
                  />
                </label>
                <label>
                  <span>Post announcement in</span>
                  <select
                    value={postChannelId}
                    onChange={(event) => setPostChannelId(event.target.value)}
                  >
                    <option value="">Do not post</option>
                    {textChannels.map((channel) => (
                      <option value={channel.id} key={channel.id}>
                        # {channel.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="event-cover-upload">
                  <span>Cover Image</span>
                  <small>Optional image for the event card.</small>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleCoverChange(event)}
                  />
                </label>
                {coverImage ? (
                  <img className="event-cover-preview" src={coverImage} alt="Event cover preview" />
                ) : null}
              </div>
            ) : step === 3 ? (
              <div className="event-wizard-step event-review-step">
                <div className="event-review-card">
                  <div className="event-review-date">
                    <CalendarBlank size={20} />
                    <strong>{new Date(`${startDate}T${startTime}`).toLocaleString()}</strong>
                  </div>
                  <h3>{title || 'Untitled event'}</h3>
                  <p>{description || 'No description added.'}</p>
                  <span>
                    <MapPin size={15} />{' '}
                    {formatEventLocation({ location, locationType } as ServerEvent)}
                  </span>
                  {frequency !== 'once' ? (
                    <span>
                      <Repeat size={15} /> {formatEventFrequency(frequency)}
                    </span>
                  ) : null}
                </div>
                <p className="event-review-note">
                  This event will be visible to members of {group.name}.
                </p>
              </div>
            ) : null}
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="event-wizard-actions">
              <button
                type="button"
                onClick={() => {
                  if (step === 1) setCreating(false);
                  else setStep((current) => (current - 1) as 1 | 2 | 3);
                }}
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 3 ? (
                <button type="button" onClick={nextStep}>
                  Next
                </button>
              ) : (
                <button type="button" onClick={create}>
                  Create Event
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MessageList({
  composer,
  editingMessage,
  emotes,
  isLoading,
  messages,
  ownAvatar,
  onDelete,
  onEdit,
  onReact,
  onReply,
  onRetry,
}: {
  composer: string;
  editingMessage?: Message;
  emotes: CustomEmote[];
  isLoading: boolean;
  messages: Message[];
  ownAvatar: string;
  onDelete: (message: Message) => void;
  onEdit: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
}) {
  return (
    <>
      {isLoading ? <p className="timeline-state">Loading messages…</p> : null}
      {!isLoading && messages.length === 0 ? (
        <p className="timeline-state">No messages yet. Start the conversation.</p>
      ) : null}
      {!isLoading && messages.length > 0 ? (
        <div className="date-divider">
          <span>Today</span>
        </div>
      ) : null}
      {messages.map((message) => (
        <MessageRow
          avatar={ownAvatar}
          emotes={emotes}
          key={message.id}
          message={message}
          onDelete={onDelete}
          onEdit={onEdit}
          onReact={onReact}
          onReply={onReply}
          onRetry={onRetry}
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
  );
}

function Composer({
  activeChannelName,
  attachments,
  composer,
  editingMessage,
  emotes,
  isLoading,
  isSending,
  onCancelContext,
  onChange,
  onFiles,
  onInsert,
  onKeyDown,
  onMediaSelect,
  onOpenEmojiSettings,
  onRemoveAttachment,
  onSubmit,
  replyTo,
}: {
  activeChannelName: string;
  attachments: AttachmentDraft[];
  composer: string;
  editingMessage?: Message;
  emotes: CustomEmote[];
  isLoading: boolean;
  isSending: boolean;
  onCancelContext: () => void;
  onChange: (value: string) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onInsert: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onMediaSelect: (asset: MediaAsset) => void;
  onOpenEmojiSettings?: () => void;
  onRemoveAttachment: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  replyTo?: ReplyReference;
}) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  return (
    <form className="composer-shell" data-testid={E2E_SELECTORS.composer} onSubmit={onSubmit}>
      {editingMessage || replyTo ? (
        <div className="composer-context">
          <span>
            <strong>{editingMessage ? 'Editing message' : `Replying to ${replyTo?.author}`}</strong>
            {replyTo ? ` · ${replyTo.body}` : ''}
          </span>
          <button type="button" onClick={onCancelContext} aria-label="Cancel composer context">
            <X size={15} />
          </button>
        </div>
      ) : null}
      {attachments.length > 0 ? (
        <div className="attachment-draft-list" aria-label="Attachments ready to send">
          {attachments.map((attachment) => (
            <span className="attachment-chip" key={attachment.id}>
              <FileText size={15} /> {attachment.name}
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message ${activeChannelName}`}
          rows={1}
          disabled={isLoading}
        />
      </label>
      <div className="composer-footer">
        <div className="composer-tools">
          <label className="composer-tool" title="Attach files">
            <Plus size={20} />
            <span className="visually-hidden">Attach files</span>
            <input type="file" multiple onChange={onFiles} />
          </label>
          <button
            type="button"
            className="composer-tool"
            aria-label="Formatting"
            onClick={() => onInsert('**bold**')}
          >
            <span>Aa</span>
          </button>
          <button
            type="button"
            className="composer-tool"
            aria-label="Mention someone"
            onClick={() => onInsert('@Maya')}
          >
            <strong>@</strong>
          </button>
          <button
            type="button"
            className="composer-tool"
            aria-label="Code snippet"
            onClick={() => onInsert('`code`')}
          >
            <Code size={19} />
          </button>
          <label className="composer-tool" title="Attach a file">
            <Paperclip size={19} />
            <span className="visually-hidden">Attach a file</span>
            <input type="file" onChange={onFiles} />
          </label>
        </div>
        <div className="composer-submit-group">
          <div className="composer-emote-wrap">
            <button
              type="button"
              className="composer-tool"
              aria-label="Add emoji or custom emote"
              aria-expanded={mediaPickerOpen}
              onClick={() => setMediaPickerOpen((open) => !open)}
            >
              <Smiley size={19} />
            </button>
            {mediaPickerOpen ? (
              <MediaPicker
                emotes={emotes}
                onManageEmoji={onOpenEmojiSettings}
                onSelect={(asset) => {
                  onMediaSelect(asset);
                  setMediaPickerOpen(false);
                }}
              />
            ) : null}
          </div>
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
  );
}

function LandingPanel({
  friendCode,
  friendState,
  groups,
  onAddFriend,
  onCreateDm,
  onCreateGroup,
  onFriendResponse,
  onOpenGroup,
  surface,
}: {
  friendCode: string;
  friendState: FriendState;
  groups: WorkspaceGroup[];
  onAddFriend: () => void;
  onCreateDm: () => void;
  onCreateGroup: () => void;
  onFriendResponse: (id: string, action: 'accept' | 'decline') => void;
  onOpenGroup: (groupId: string) => void;
  surface: AppSurface;
}) {
  const isThreads = surface === 'threads';
  const isExplore = surface === 'explore';
  return (
    <div className="landing-panel">
      <div className="landing-hero">
        <span className="landing-icon">
          {isThreads ? (
            <ChatCenteredDots size={30} />
          ) : isExplore ? (
            <Compass size={30} />
          ) : (
            <Users size={30} />
          )}
        </span>
        <div>
          <p className="section-kicker">
            {isThreads ? 'Inbox' : isExplore ? 'Community' : 'Scuttlebutt'}
          </p>
          <h1>{isThreads ? 'Threads' : isExplore ? 'Explore groups' : 'Your conversations'}</h1>
          <p>
            {isThreads
              ? 'Replies from every conversation will collect here.'
              : isExplore
                ? 'Open a group you belong to or create a locally hosted one.'
                : 'Direct messages stay separate from your group workspaces.'}
          </p>
        </div>
      </div>
      {isThreads ? (
        <div className="landing-card-grid">
          <article className="landing-card">
            <ChatCenteredDots size={22} />
            <strong>No unread threads</strong>
            <span>Replies and mentions will appear here as conversations grow.</span>
          </article>
        </div>
      ) : (
        <>
          {!isExplore ? (
            <section className="friend-hub" aria-label="Friends">
              <div className="friend-hub-heading">
                <div>
                  <h2>Friends</h2>
                  <p>Requests must be accepted before a direct message opens.</p>
                </div>
                {friendState.incoming.length > 0 ? (
                  <span>{friendState.incoming.length} pending</span>
                ) : null}
              </div>
              {friendState.incoming.length > 0 ? (
                <div className="friend-request-list">
                  {friendState.incoming.map((friend) => (
                    <article className="friend-request-row" key={friend.id}>
                      <PersonAvatar
                        image={friend.avatarUrl}
                        name={friend.name}
                        status={friend.presence}
                      />
                      <span>
                        <strong>{friend.name}</strong>
                        <small>Incoming friend request</small>
                      </span>
                      <button
                        type="button"
                        className="friend-accept"
                        aria-label={`Accept ${friend.name}`}
                        onClick={() => onFriendResponse(friend.id, 'accept')}
                      >
                        <Check size={18} weight="bold" />
                      </button>
                      <button
                        type="button"
                        className="friend-decline"
                        aria-label={`Decline ${friend.name}`}
                        onClick={() => onFriendResponse(friend.id, 'decline')}
                      >
                        <X size={18} weight="bold" />
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
              {friendState.friends.length > 0 ? (
                <div className="friend-list-grid">
                  {friendState.friends.map((friend) => (
                    <article className="friend-list-card" key={friend.id}>
                      <PersonAvatar
                        image={friend.avatarUrl}
                        name={friend.name}
                        status={friend.presence}
                      />
                      <span>
                        <strong>{friend.name}</strong>
                        <small>{friend.bio || 'Friend'}</small>
                      </span>
                      <ChatCenteredDots size={19} />
                    </article>
                  ))}
                </div>
              ) : friendState.incoming.length === 0 ? (
                <p className="friend-empty">
                  No friends yet. Share your code or add someone below.
                </p>
              ) : null}
              {friendState.outgoing.length > 0 ? (
                <div className="outgoing-requests">
                  <strong>Outgoing requests</strong>
                  <span>{friendState.outgoing.map(({ name }) => name).join(', ')}</span>
                </div>
              ) : null}
            </section>
          ) : null}
          <div className="landing-card-grid">
            {!isExplore ? (
              <article className="landing-card friend-code-card">
                <span className="landing-card-icon">
                  <UserPlus size={23} />
                </span>
                <strong>Add friends by code</strong>
                <span className="friend-code-value">{friendCode}</span>
                <div className="friend-code-actions">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(friendCode)}
                  >
                    <Copy size={16} /> Copy
                  </button>
                  <button type="button" onClick={onAddFriend}>
                    <UserPlus size={16} /> Add friend
                  </button>
                </div>
              </article>
            ) : null}
            {groups.map((group) => (
              <button
                type="button"
                className="landing-card landing-card-button"
                key={group.id}
                onClick={() => onOpenGroup(group.id)}
              >
                <span className="landing-card-icon">
                  <ServerProfileIcon className="landing-server-profile-icon" group={group} />
                </span>
                <strong>{group.name}</strong>
                <span>{group.description}</span>
                <small>{group.channels.length} channels</small>
              </button>
            ))}
            <button
              type="button"
              className="landing-card landing-card-button landing-card-create"
              onClick={isExplore ? onCreateGroup : onCreateDm}
            >
              <Plus size={24} />
              <strong>{isExplore ? 'Create a group' : 'Start a DM'}</strong>
              <span>
                {isExplore
                  ? 'Create channels and invite people.'
                  : 'Open a private local conversation.'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type ProfilePickerMode = 'decoration' | 'display-name' | 'effect' | 'frame';
type ProfilePickerValue = AvatarDecoration | DisplayNameStyle | ProfileEffect | ProfileFrame;

const PROFILE_NAME_COLORS = [
  '#eef1ff',
  '#f2bd55',
  '#f86fbb',
  '#5bd8c4',
  '#65a7ff',
  '#b77cff',
  '#ff6c9d',
] as const;

function ProfileSettingsDialog({
  profile,
  onCancel,
  onSave,
}: {
  profile: UserProfile;
  onCancel: () => void;
  onSave: (profile: UserProfile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState('');
  const [pickerMode, setPickerMode] = useState<ProfilePickerMode>();
  const [pickerValue, setPickerValue] = useState<ProfilePickerValue>('none');
  const [pickerColor, setPickerColor] = useState(profile.displayNameColor);
  const update = <Key extends keyof UserProfile>(key: Key, value: UserProfile[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPEG, GIF, or WebP image.');
      return;
    }
    try {
      update('avatar', await optimizeAvatar(file));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The image could not be prepared.');
    }
  };
  const openPicker = (mode: ProfilePickerMode) => {
    setPickerMode(mode);
    setPickerColor(draft.displayNameColor);
    if (mode === 'decoration') setPickerValue(draft.avatarDecoration);
    if (mode === 'display-name') setPickerValue(draft.displayNameStyle);
    if (mode === 'effect') setPickerValue(draft.profileEffect);
    if (mode === 'frame') setPickerValue(draft.profileFrame);
  };
  const applyPicker = () => {
    if (
      pickerMode === 'decoration' &&
      AVATAR_DECORATIONS.includes(pickerValue as AvatarDecoration)
    ) {
      update('avatarDecoration', pickerValue as AvatarDecoration);
    }
    if (
      pickerMode === 'display-name' &&
      DISPLAY_NAME_STYLES.includes(pickerValue as DisplayNameStyle)
    ) {
      update('displayNameStyle', pickerValue as DisplayNameStyle);
      update('displayNameColor', pickerColor);
    }
    if (pickerMode === 'effect' && PROFILE_EFFECTS.includes(pickerValue as ProfileEffect)) {
      update('profileEffect', pickerValue as ProfileEffect);
    }
    if (pickerMode === 'frame' && PROFILE_FRAMES.includes(pickerValue as ProfileFrame)) {
      update('profileFrame', pickerValue as ProfileFrame);
    }
    setPickerMode(undefined);
  };
  return (
    <>
      <div
        className="modal-backdrop profile-settings-backdrop"
        role="presentation"
        onMouseDown={onCancel}
      >
        <form
          className="profile-settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-settings-title"
          onMouseDown={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <header>
            <div>
              <p className="section-kicker">My account</p>
              <h2 id="profile-settings-title">Edit profile</h2>
              <p className="profile-settings-subtitle">
                Make your profile feel like yours. Changes are saved to this account on this device.
              </p>
            </div>
            <button type="button" aria-label="Close profile settings" onClick={onCancel}>
              <X size={20} />
            </button>
          </header>
          <div className="profile-editor-layout">
            <div className="profile-edit-fields">
              <section className="avatar-upload-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="profile-field-label">Avatar & decoration</span>
                    <small>Show a profile picture with a frame and a small finishing touch.</small>
                  </div>
                  <DecoratedProfileAvatar profile={draft} size="large" />
                </div>
                <div className="profile-avatar-actions">
                  <label className="profile-upload-button">
                    <UploadSimple size={17} /> Upload image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleAvatar}
                    />
                  </label>
                  <button type="button" onClick={() => update('avatar', '')}>
                    Reset
                  </button>
                  <button type="button" onClick={() => openPicker('decoration')}>
                    <Sparkle size={16} /> {avatarDecorationLabel(draft.avatarDecoration)} decoration
                  </button>
                </div>
                <small>
                  PNG, JPEG, GIF, or WebP. Large images are resized automatically to 2 MB.
                </small>
                {error ? <p role="alert">{error}</p> : null}
              </section>

              <section className="profile-customization-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="profile-field-label">Banner color</span>
                    <small>Pick a color that appears behind your profile picture.</small>
                  </div>
                  <span className="profile-color-value">{draft.bannerColor.toUpperCase()}</span>
                </div>
                <div className="profile-banner-palette" role="group" aria-label="Banner colors">
                  {PROFILE_BANNER_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`profile-color-swatch ${draft.bannerColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Use ${color} banner color`}
                      aria-pressed={draft.bannerColor === color}
                      onClick={() => update('bannerColor', color)}
                    />
                  ))}
                  <label className="profile-custom-color" title="Choose a custom banner color">
                    <PaintBrush size={17} />
                    <input
                      type="color"
                      value={draft.bannerColor}
                      aria-label="Custom banner color"
                      onChange={(event) => update('bannerColor', event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="profile-customization-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="profile-field-label">Profile look</span>
                    <small>Choose how your profile appears in popovers and conversations.</small>
                  </div>
                  <PaintBrush size={19} aria-hidden="true" />
                </div>
                <div className="profile-customization-grid">
                  <button
                    type="button"
                    className="profile-customization-card"
                    onClick={() => openPicker('effect')}
                  >
                    <span
                      className={`profile-customization-icon profile-effect-${draft.profileEffect}`}
                    >
                      <ProfileEffectIcon effect={draft.profileEffect} />
                    </span>
                    <span>
                      <strong>Profile effect</strong>
                      <small>{profileEffectLabel(draft.profileEffect)}</small>
                    </span>
                    <CaretRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="profile-customization-card"
                    onClick={() => openPicker('frame')}
                  >
                    <span
                      className={`profile-customization-icon profile-frame-${draft.profileFrame}`}
                    >
                      <ProfileFrameIcon frame={draft.profileFrame} />
                    </span>
                    <span>
                      <strong>Profile frame</strong>
                      <small>{profileFrameLabel(draft.profileFrame)}</small>
                    </span>
                    <CaretRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="profile-customization-card"
                    onClick={() => openPicker('display-name')}
                  >
                    <span
                      className={`profile-customization-icon profile-display-name-${draft.displayNameStyle}`}
                    >
                      <DisplayNameStyleIcon style={draft.displayNameStyle} />
                    </span>
                    <span>
                      <strong>Display name style</strong>
                      <small>{displayNameStyleLabel(draft.displayNameStyle)}</small>
                    </span>
                    <CaretRight size={16} />
                  </button>
                </div>
              </section>

              <label>
                <span className="profile-field-label">Display name</span>
                <input
                  value={draft.displayName}
                  maxLength={32}
                  onChange={(event) => update('displayName', event.target.value)}
                />
              </label>
              <label>
                <span className="profile-field-label">About me</span>
                <textarea
                  value={draft.bio}
                  maxLength={190}
                  rows={4}
                  onChange={(event) => update('bio', event.target.value)}
                />
                <small>{draft.bio.length}/190</small>
              </label>
              <label>
                <span className="profile-field-label">Status text</span>
                <input
                  value={draft.status}
                  maxLength={40}
                  onChange={(event) => update('status', event.target.value)}
                />
              </label>
            </div>
            <aside aria-label="Profile preview">
              <p className="profile-preview-label">Live preview</p>
              <ProfilePreview profile={draft} />
              <div className="profile-preview-note">
                Your banner, effect, frame, decoration, and name style update here as you choose
                them.
              </div>
            </aside>
          </div>
          <footer>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" disabled={!draft.displayName.trim()}>
              Save changes
            </button>
          </footer>
        </form>
      </div>
      {pickerMode ? (
        <ProfilePickerDialog
          color={pickerColor}
          draft={draft}
          mode={pickerMode}
          value={pickerValue}
          onApply={applyPicker}
          onCancel={() => setPickerMode(undefined)}
          onChange={setPickerValue}
          onColorChange={setPickerColor}
        />
      ) : null}
    </>
  );
}

function ProfilePickerDialog({
  color,
  draft,
  mode,
  value,
  onApply,
  onCancel,
  onChange,
  onColorChange,
}: {
  color: string;
  draft: UserProfile;
  mode: ProfilePickerMode;
  value: ProfilePickerValue;
  onApply: () => void;
  onCancel: () => void;
  onChange: (value: ProfilePickerValue) => void;
  onColorChange: (color: string) => void;
}) {
  const previewProfile: UserProfile = {
    ...draft,
    avatarDecoration: mode === 'decoration' ? (value as AvatarDecoration) : draft.avatarDecoration,
    displayNameColor: mode === 'display-name' ? color : draft.displayNameColor,
    displayNameStyle:
      mode === 'display-name' ? (value as DisplayNameStyle) : draft.displayNameStyle,
    profileEffect: mode === 'effect' ? (value as ProfileEffect) : draft.profileEffect,
    profileFrame: mode === 'frame' ? (value as ProfileFrame) : draft.profileFrame,
  };
  const title =
    mode === 'display-name'
      ? 'Change display name style'
      : mode === 'effect'
        ? 'Change profile effect'
        : mode === 'frame'
          ? 'Change profile frame'
          : 'Change avatar decoration';
  const description =
    mode === 'display-name'
      ? 'Choose a style and color for your name.'
      : mode === 'effect'
        ? 'Add a little movement and personality to your profile banner.'
        : mode === 'frame'
          ? 'Choose a frame that wraps around your avatar.'
          : 'Add a small accent around your avatar.';
  return (
    <div
      className="modal-backdrop profile-picker-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        className="profile-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="section-kicker">Profile customization</p>
            <h2 id="profile-picker-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" aria-label={`Close ${title}`} onClick={onCancel}>
            <X size={20} />
          </button>
        </header>
        <div className="profile-picker-layout">
          <div className="profile-picker-options">
            {mode === 'display-name' ? (
              <>
                <span className="profile-picker-label">Choose style</span>
                <div className="profile-picker-grid profile-name-style-grid">
                  {DISPLAY_NAME_STYLES.map((style) => (
                    <button
                      type="button"
                      key={style}
                      className={`profile-picker-option profile-name-style-option profile-display-name-${style} ${value === style ? 'selected' : ''}`}
                      aria-pressed={value === style}
                      onClick={() => onChange(style)}
                    >
                      <DisplayNameStyleIcon style={style} />
                      <strong>{displayNameStyleLabel(style)}</strong>
                    </button>
                  ))}
                </div>
                <span className="profile-picker-label">Choose color</span>
                <div className="profile-name-color-grid">
                  {PROFILE_NAME_COLORS.map((nameColor) => (
                    <button
                      type="button"
                      key={nameColor}
                      className={`profile-name-color ${color === nameColor ? 'selected' : ''}`}
                      style={{ backgroundColor: nameColor }}
                      aria-label={`Use ${nameColor} display name color`}
                      aria-pressed={color === nameColor}
                      onClick={() => onColorChange(nameColor)}
                    />
                  ))}
                </div>
              </>
            ) : null}
            {mode === 'effect' ? (
              <ProfilePickerOptions
                value={value}
                options={[
                  { id: 'none' as const, label: 'None', detail: 'Keep it clean.' },
                  { id: 'sparkle' as const, label: 'Sparkle', detail: 'A bright little accent.' },
                  { id: 'cosmos' as const, label: 'Cosmos', detail: 'A space-inspired banner.' },
                  { id: 'neon' as const, label: 'Neon', detail: 'Electric edges and energy.' },
                  { id: 'pop' as const, label: 'Pop', detail: 'A playful celebration.' },
                ]}
                icon={(id) => <ProfileEffectIcon effect={id} size={25} />}
                onChange={onChange}
              />
            ) : null}
            {mode === 'frame' ? (
              <ProfilePickerOptions
                value={value}
                options={[
                  { id: 'none' as const, label: 'None', detail: 'Keep your avatar classic.' },
                  { id: 'orbit' as const, label: 'Orbit', detail: 'A rounded planet frame.' },
                  { id: 'lavender' as const, label: 'Lavender', detail: 'A soft violet frame.' },
                  { id: 'gold' as const, label: 'Gold', detail: 'A warm star frame.' },
                  { id: 'pixel' as const, label: 'Pixel', detail: 'A crisp corner frame.' },
                ]}
                icon={(id) => <ProfileFrameIcon frame={id} size={25} />}
                onChange={onChange}
              />
            ) : null}
            {mode === 'decoration' ? (
              <ProfilePickerOptions
                value={value}
                options={[
                  { id: 'none' as const, label: 'None', detail: 'No avatar decoration.' },
                  { id: 'halo' as const, label: 'Halo', detail: 'A simple ring of light.' },
                  { id: 'sparkle' as const, label: 'Sparkle', detail: 'A small bright accent.' },
                  { id: 'crown' as const, label: 'Crown', detail: 'A little royal detail.' },
                  { id: 'leaves' as const, label: 'Leaves', detail: 'A natural touch.' },
                ]}
                icon={(id) => <AvatarDecorationIcon decoration={id} size={25} />}
                onChange={onChange}
              />
            ) : null}
          </div>
          <div className="profile-picker-preview">
            <span className="profile-picker-label">Preview</span>
            <ProfilePreview profile={previewProfile} compact />
          </div>
        </div>
        <footer>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onApply}>
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProfilePickerOptions<
  Option extends { id: ProfilePickerValue; label: string; detail: string },
>({
  icon,
  onChange,
  options,
  value,
}: {
  icon: (id: Option['id']) => ReactNode;
  onChange: (value: ProfilePickerValue) => void;
  options: Option[];
  value: ProfilePickerValue;
}) {
  return (
    <div className="profile-picker-grid">
      {options.map((option) => (
        <button
          type="button"
          className={`profile-picker-option ${value === option.id ? 'selected' : ''}`}
          key={option.id}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          <span className="profile-picker-option-icon">{icon(option.id)}</span>
          <span>
            <strong>{option.label}</strong>
            <small>{option.detail}</small>
          </span>
          {value === option.id ? <Check size={17} weight="bold" /> : null}
        </button>
      ))}
    </div>
  );
}

function VoiceMembersSidebar({
  currentUserId,
  localAvatar,
  localSpeaking,
  participants,
}: {
  currentUserId: string;
  localAvatar: string;
  localSpeaking: boolean;
  participants: WorkspaceMember[];
}) {
  return (
    <aside className="members-sidebar voice-members-sidebar" aria-label="Voice channel members">
      <div className="voice-sidebar-heading">
        <SpeakerHigh size={19} weight="fill" />
        <div>
          <strong>In this call</strong>
          <span>{participants.length} connected</span>
        </div>
      </div>
      <div className="voice-member-list">
        {participants.map((participant) => {
          const speaking = participant.id === currentUserId && localSpeaking;
          return (
            <article
              className={`voice-member-card ${speaking ? 'voice-member-speaking' : ''}`}
              key={participant.id}
            >
              <PersonAvatar
                image={participant.id === currentUserId ? localAvatar : participant.avatar}
                name={participant.name}
                status={participant.status}
                size="large"
              />
              <span>
                <strong>{participant.name}</strong>
                <small>{speaking ? 'Speaking now' : 'Listening'}</small>
              </span>
              <Microphone size={16} weight="fill" />
            </article>
          );
        })}
      </div>
      <div className="voice-sidebar-security">
        <LockSimple size={16} /> Encrypted media session
      </div>
    </aside>
  );
}

function VoiceChatSidebar({
  activeChannelName,
  attachments,
  composer,
  editingMessage,
  emotes,
  isLoading,
  isSending,
  messages,
  ownAvatar,
  onCancelContext,
  onChange,
  onClose,
  onDelete,
  onEdit,
  onFiles,
  onInsert,
  onKeyDown,
  onMediaSelect,
  onOpenEmojiSettings,
  onReact,
  onRemoveAttachment,
  onReply,
  onRetry,
  onSubmit,
  replyTo,
}: {
  activeChannelName: string;
  attachments: AttachmentDraft[];
  composer: string;
  editingMessage?: Message;
  emotes: CustomEmote[];
  isLoading: boolean;
  isSending: boolean;
  messages: Message[];
  ownAvatar: string;
  onCancelContext: () => void;
  onChange: (value: string) => void;
  onClose: () => void;
  onDelete: (message: Message) => void;
  onEdit: (message: Message) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onInsert: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onMediaSelect: (asset: MediaAsset) => void;
  onOpenEmojiSettings?: () => void;
  onReact: (message: Message, emoji: string) => void;
  onRemoveAttachment: (id: string) => void;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  replyTo?: ReplyReference;
}) {
  return (
    <aside className="voice-chat-sidebar" aria-label={`${activeChannelName} voice chat`}>
      <header>
        <ChatCenteredDots size={19} weight="fill" />
        <div>
          <strong>{activeChannelName}</strong>
          <span>Voice channel chat</span>
        </div>
        <button type="button" aria-label="Close voice chat" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="voice-chat-messages">
        <MessageList
          composer={composer}
          editingMessage={editingMessage}
          emotes={emotes}
          isLoading={isLoading}
          messages={messages}
          ownAvatar={ownAvatar}
          onDelete={onDelete}
          onEdit={onEdit}
          onReact={onReact}
          onReply={onReply}
          onRetry={onRetry}
        />
      </div>
      <Composer
        activeChannelName={activeChannelName}
        attachments={attachments}
        composer={composer}
        editingMessage={editingMessage}
        emotes={emotes}
        isLoading={isLoading}
        isSending={isSending}
        replyTo={replyTo}
        onCancelContext={onCancelContext}
        onChange={onChange}
        onFiles={onFiles}
        onInsert={onInsert}
        onKeyDown={onKeyDown}
        onMediaSelect={onMediaSelect}
        onOpenEmojiSettings={onOpenEmojiSettings}
        onRemoveAttachment={onRemoveAttachment}
        onSubmit={onSubmit}
      />
    </aside>
  );
}

function FriendCodeDialog({
  friendCode,
  onCancel,
  onSubmit,
}: {
  friendCode: string;
  onCancel: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="creation-dialog friend-code-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-code-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(code);
        }}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">Friends</p>
            <h2 id="friend-code-title">Add a friend</h2>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p>
          Enter their private six-character code. They will receive a request before you can message
          each other.
        </p>
        <label>
          <span>Friend code</span>
          <input
            autoFocus
            maxLength={6}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            placeholder="A7K9Q2"
          />
        </label>
        <div className="your-friend-code">
          <span>Your code</span>
          <strong>{friendCode}</strong>
          <button type="button" onClick={() => void navigator.clipboard.writeText(friendCode)}>
            <Copy size={16} /> Copy
          </button>
        </div>
        <div className="creation-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={code.length !== 6}>
            Send request
          </button>
        </div>
      </form>
    </div>
  );
}

function MembersSidebar({
  members,
  onInvite,
  onNotice,
}: {
  members: WorkspaceMember[];
  onInvite: () => void;
  onNotice: (notice: Notice) => void;
}) {
  return (
    <aside className="members-sidebar" aria-label="Community members">
      {(['online', 'idle', 'dnd', 'offline'] as const).map((status) => {
        const statusMembers = members.filter((member) => member.status === status);
        return (
          <section className="member-group" key={status}>
            <h2>
              {presenceLabel(status)} — {statusMembers.length}
            </h2>
            <div className="member-list">
              {statusMembers.map((member) => (
                <button
                  type="button"
                  className={`member-row member-${member.status}`}
                  key={member.id}
                  onClick={() =>
                    onNotice({
                      tone: 'info',
                      text: `Open Direct Messages to chat with ${member.name}.`,
                    })
                  }
                >
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
      })}
      <button type="button" className="invite-button" onClick={onInvite}>
        <Users size={17} /> Invite members
      </button>
    </aside>
  );
}

function GroupInviteDialog({
  friends,
  group,
  onCancel,
  onInvite,
}: {
  friends: FriendState['friends'];
  group: WorkspaceGroup;
  onCancel: () => void;
  onInvite: (friendId: string) => void;
}) {
  const memberIds = new Set((group.members ?? []).map(({ id }) => id));
  const available = friends.filter(({ id }) => !memberIds.has(id));
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="creation-dialog group-invite-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-invite-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">{group.name}</p>
            <h2 id="group-invite-title">Invite friends</h2>
          </div>
          <button type="button" aria-label="Close invite dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p>Invited friends receive access to this server’s text and voice channels.</p>
        <div className="group-invite-list">
          {available.map((friend) => (
            <div className="group-invite-row" key={friend.id}>
              <PersonAvatar image={friend.avatarUrl} name={friend.name} status={friend.presence} />
              <span>
                <strong>{friend.name}</strong>
                <small>Friend</small>
              </span>
              <button type="button" onClick={() => onInvite(friend.id)}>
                Invite
              </button>
            </div>
          ))}
          {available.length === 0 ? <p>No additional friends are available to invite.</p> : null}
        </div>
      </section>
    </div>
  );
}

function GroupAssetDialog({
  groupName,
  onCancel,
  onSave,
  type,
}: {
  groupName: string;
  onCancel: () => void;
  onSave: (type: 'emote' | 'sound', name: string, dataUrl: string) => void;
  type: 'emote' | 'sound';
}) {
  const [name, setName] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');
  const maxBytes = type === 'sound' ? 1_500_000 : 512_000;
  const accept =
    type === 'sound'
      ? 'audio/mpeg,audio/wav,audio/ogg,audio/webm'
      : 'image/png,image/jpeg,image/gif,image/webp';
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > maxBytes || !file.type.startsWith(type === 'sound' ? 'audio/' : 'image/')) {
      setError(
        `${type === 'sound' ? 'Sound' : 'Emote'} must be under ${type === 'sound' ? '1.5 MB' : '512 KB'}.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setDataUrl(String(reader.result));
      setName((current) => current || file.name.replace(/\.[^.]+$/, ''));
      setError('');
    });
    reader.readAsDataURL(file);
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="creation-dialog group-asset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-asset-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && dataUrl) onSave(type, name, dataUrl);
        }}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">{groupName}</p>
            <h2 id="group-asset-title">Add custom {type}</h2>
          </div>
          <button type="button" aria-label="Close asset dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <label>
          <span>Name</span>
          <input
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            placeholder={type === 'sound' ? 'airhorn' : 'pepewave'}
          />
        </label>
        <label className="asset-file-field">
          <span>{type === 'sound' ? 'Audio file' : 'Emote image'}</span>
          <input type="file" accept={accept} onChange={chooseFile} />
        </label>
        {dataUrl && type === 'emote' ? (
          <img className="asset-emote-preview" src={dataUrl} alt="Emote preview" />
        ) : null}
        {dataUrl && type === 'sound' ? <audio controls src={dataUrl} /> : null}
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="creation-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || !dataUrl}>
            Add to server
          </button>
        </div>
      </form>
    </div>
  );
}

function CreationDialog({
  groupName,
  mode,
  onCancel,
  onCreate,
}: {
  groupName?: string;
  mode: DialogMode;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const title =
    mode === 'dm'
      ? 'Start a direct message'
      : mode === 'group'
        ? 'Create a group'
        : mode === 'voice-channel'
          ? 'Create a voice channel'
          : 'Create a text channel';
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="creation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creation-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name);
        }}
      >
        <div className="creation-dialog-heading">
          <div>
            <p className="section-kicker">{groupName ?? 'Scuttlebutt'}</p>
            <h2 id="creation-dialog-title">{title}</h2>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <label>
          <span>{mode === 'dm' ? 'Person or group name' : 'Name'}</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              mode === 'voice-channel'
                ? 'Team Standup'
                : mode === 'dm'
                  ? 'Taylor Nguyen'
                  : 'new-channel'
            }
          />
        </label>
        <p>
          This local prototype stores navigation on this device. The repository boundary remains
          ready for server-backed sync.
        </p>
        <div className="creation-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
