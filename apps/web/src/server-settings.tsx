import { useMemo, useState, type ChangeEvent, type PointerEvent, type ReactNode } from 'react';
import {
  Check,
  Copy,
  FileText,
  GearSix,
  MagnifyingGlass,
  Plus,
  UploadSimple,
  Waveform,
  X,
} from '@phosphor-icons/react';

import { PersonAvatar } from './App.js';
import { optimizeAvatar, optimizeBanner } from './image-utils.js';
import {
  serverSettingsFor,
  type CustomEmote,
  type CustomSound,
  type ServerAccessMode,
  type ServerRole,
  type ServerSettings,
  type WorkspaceGroup,
  type WorkspaceMember,
} from './workspace.js';

export type ServerSettingsSection =
  | 'access'
  | 'audit'
  | 'automod'
  | 'bans'
  | 'boosts'
  | 'community'
  | 'engagement'
  | 'emoji'
  | 'integrations'
  | 'invites'
  | 'members'
  | 'profile'
  | 'roles'
  | 'safety'
  | 'soundboard'
  | 'stickers'
  | 'tag'
  | 'template';

interface ServerSettingsDialogProps {
  currentUserAvatar: string;
  currentUserId: string;
  currentUserName: string;
  group: WorkspaceGroup;
  initialSection: ServerSettingsSection;
  onCancel: () => void;
  onDelete: () => void;
  onInvite: () => void;
  onSave: (group: WorkspaceGroup) => void;
}

interface SettingsNavItem {
  id: ServerSettingsSection;
  label: string;
}

const NAV_GROUPS: Array<{ label: string; items: SettingsNavItem[] }> = [
  {
    label: 'Server',
    items: [
      { id: 'profile', label: 'Server Profile' },
      { id: 'tag', label: 'Server Tag' },
      { id: 'engagement', label: 'Engagement' },
      { id: 'boosts', label: 'Boost Perks' },
    ],
  },
  {
    label: 'Expression',
    items: [
      { id: 'emoji', label: 'Emoji' },
      { id: 'stickers', label: 'Stickers' },
      { id: 'soundboard', label: 'Soundboard' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'members', label: 'Members' },
      { id: 'roles', label: 'Roles' },
      { id: 'invites', label: 'Invites' },
      { id: 'access', label: 'Access' },
    ],
  },
  {
    label: 'Apps',
    items: [{ id: 'integrations', label: 'Integrations' }],
  },
  {
    label: 'Moderation',
    items: [
      { id: 'safety', label: 'Safety Setup' },
      { id: 'audit', label: 'Audit Log' },
      { id: 'bans', label: 'Bans' },
      { id: 'automod', label: 'AutoMod' },
    ],
  },
  {
    label: 'Community',
    items: [
      { id: 'community', label: 'Enable Community' },
      { id: 'template', label: 'Server Template' },
    ],
  },
];

const BANNER_COLORS = [
  '#11151b',
  '#ff3d9e',
  '#f0444d',
  '#f28c28',
  '#f1cf36',
  '#8146a2',
  '#24a7e8',
  '#52d8c8',
  '#4d7d12',
  '#3b3e43',
];

const TAG_BADGES = ['*', '+', '~', '!', '?'];
const TAG_COLORS = ['#5865f2', '#23a55a', '#f0a400', '#eb459e', '#ed4245'];

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function assetName(file: File): string {
  return file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 24);
}

function clampBannerPosition(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function SectionHeader({
  description,
  eyebrow,
  title,
}: {
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="server-settings-section-header">
      {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

function SettingsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`server-settings-card ${className}`}>{children}</section>;
}

function ToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="server-settings-toggle-row">
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function EmptyState({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="server-settings-empty">
      <div className="server-settings-empty-art">
        <FileText size={42} weight="duotone" />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

function useSettingsUpdater(draft: WorkspaceGroup, setDraft: (next: WorkspaceGroup) => void) {
  const settings = serverSettingsFor(draft);
  const updateGroup = (patch: Partial<WorkspaceGroup>) => setDraft({ ...draft, ...patch });
  const updateSettings = (patch: Partial<ServerSettings>) =>
    setDraft({ ...draft, settings: { ...settings, ...patch } });
  const updateAccess = (patch: Partial<ServerSettings['access']>) =>
    updateSettings({ access: { ...settings.access, ...patch } });
  const updateEngagement = (patch: Partial<ServerSettings['engagement']>) =>
    updateSettings({ engagement: { ...settings.engagement, ...patch } });
  const updateModeration = (patch: Partial<ServerSettings['moderation']>) =>
    updateSettings({ moderation: { ...settings.moderation, ...patch } });
  const updateTag = (patch: Partial<ServerSettings['serverTag']>) =>
    updateSettings({ serverTag: { ...settings.serverTag, ...patch } });
  return {
    settings,
    updateAccess,
    updateEngagement,
    updateGroup,
    updateModeration,
    updateSettings,
    updateTag,
  };
}

export function ServerSettingsDialog({
  currentUserAvatar,
  currentUserId,
  currentUserName,
  group,
  initialSection,
  onCancel,
  onDelete,
  onInvite,
  onSave,
}: ServerSettingsDialogProps) {
  const [section, setSection] = useState<ServerSettingsSection>(initialSection);
  const [draft, setDraft] = useState<WorkspaceGroup>(() => ({
    ...group,
    ownerId: group.ownerId ?? currentUserId,
    settings: serverSettingsFor(group),
  }));
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [banSearch, setBanSearch] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newRule, setNewRule] = useState('');
  const [newWord, setNewWord] = useState('');
  const [inviteCopied, setInviteCopied] = useState('');
  const [bannerDrag, setBannerDrag] = useState<{
    pointerId: number;
    startPosition: ServerSettings['bannerPosition'];
    startX: number;
    startY: number;
  }>();
  const {
    settings,
    updateAccess,
    updateEngagement,
    updateGroup,
    updateModeration,
    updateSettings,
    updateTag,
  } = useSettingsUpdater(draft, setDraft);

  const storedMembers = draft.members ?? [];
  const members = useMemo<WorkspaceMember[]>(
    () => [
      {
        avatar: currentUserAvatar,
        id: currentUserId,
        name: currentUserName,
        note: 'Owner',
        status: 'online',
      },
      ...storedMembers.filter(({ id }) => id !== currentUserId),
    ],
    [currentUserAvatar, currentUserId, currentUserName, storedMembers],
  );
  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.id}`.toLowerCase().includes(memberSearch.trim().toLowerCase()),
  );
  const selectedNav = NAV_GROUPS.flatMap(({ items }) => items).find(({ id }) => id === section);
  const channels = draft.channels.filter(({ kind }) => kind === 'text');
  const voiceChannels = draft.channels.filter(({ kind }) => kind === 'voice');

  const save = () => {
    setSaving(true);
    onSave({ ...draft, settings: serverSettingsFor(draft) });
  };

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploadError('');
    try {
      const iconUrl = await optimizeAvatar(file);
      updateSettings({ iconUrl });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'The server icon could not be processed.',
      );
    }
  };

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Banner files must be an image.');
      return;
    }
    setUploadError('');
    try {
      const bannerUrl = await optimizeBanner(file);
      updateSettings({ bannerPosition: { x: 50, y: 50 }, bannerUrl });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'The server banner could not be processed.',
      );
    }
  };

  const handleBannerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!settings.bannerUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setBannerDrag({
      pointerId: event.pointerId,
      startPosition: settings.bannerPosition,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  const handleBannerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!bannerDrag || bannerDrag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    updateSettings({
      bannerPosition: {
        x: clampBannerPosition(
          bannerDrag.startPosition.x -
            ((event.clientX - bannerDrag.startX) / Math.max(1, bounds.width)) * 100,
        ),
        y: clampBannerPosition(
          bannerDrag.startPosition.y -
            ((event.clientY - bannerDrag.startY) / Math.max(1, bounds.height)) * 100,
        ),
      },
    });
  };

  const stopBannerDrag = () => setBannerDrag(undefined);

  const handleEmojiUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Emoji must be an image file.');
      return;
    }
    if (file.size > 512 * 1024) {
      setUploadError('Emoji files must be 512 KB or smaller.');
      return;
    }
    if ((draft.emotes ?? []).length >= 50) {
      setUploadError('This server has reached its 50 emoji limit.');
      return;
    }
    try {
      const dataUrl = await readDataUrl(file);
      const emote: CustomEmote = {
        dataUrl,
        id: crypto.randomUUID(),
        name: assetName(file) || `emoji-${(draft.emotes ?? []).length + 1}`,
        sourceGroupId: draft.id,
        sourceGroupName: draft.name,
      };
      setDraft({ ...draft, emotes: [...(draft.emotes ?? []), emote] });
      setUploadError('');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The emoji could not be uploaded.');
    }
  };

  const handleSoundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setUploadError('Soundboard files must be audio.');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setUploadError('Soundboard files must be 1.5 MB or smaller.');
      return;
    }
    try {
      const dataUrl = await readDataUrl(file);
      const sound: CustomSound = {
        dataUrl,
        id: crypto.randomUUID(),
        name: assetName(file) || `sound-${(draft.sounds ?? []).length + 1}`,
        sourceGroupId: draft.id,
        sourceGroupName: draft.name,
      };
      setDraft({ ...draft, sounds: [...(draft.sounds ?? []), sound] });
      setUploadError('');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The sound could not be uploaded.');
    }
  };

  const addRole = () => {
    const name = newRole.trim().slice(0, 32);
    if (!name) return;
    const role: ServerRole = {
      color: '#5865f2',
      id: `role-${Date.now()}`,
      name,
      permissions: ['View channels', 'Send messages'],
    };
    updateSettings({ roles: [...settings.roles, role] });
    setNewRole('');
  };

  const addRule = () => {
    const rule = newRule.trim().slice(0, 140);
    if (!rule) return;
    updateAccess({ rules: [...settings.access.rules, rule] });
    setNewRule('');
  };

  const addCustomWord = () => {
    const word = newWord.trim().toLowerCase().slice(0, 40);
    if (!word || settings.moderation.customWords.includes(word)) return;
    updateModeration({ customWords: [...settings.moderation.customWords, word] });
    setNewWord('');
  };

  const createInvite = async () => {
    const code = `${draft.id.slice(0, 5).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const invite = { code, createdAt: new Date().toISOString(), uses: 0 };
    updateSettings({ invites: [invite, ...settings.invites] });
    setInviteCopied(code);
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}/invite/${code}`);
    } catch {
      // Clipboard access is optional in local development.
    }
  };

  const removeInvite = (code: string) =>
    updateSettings({ invites: settings.invites.filter((invite) => invite.code !== code) });
  const removeEmote = (id: string) =>
    setDraft({ ...draft, emotes: (draft.emotes ?? []).filter((emote) => emote.id !== id) });
  const removeSound = (id: string) =>
    setDraft({ ...draft, sounds: (draft.sounds ?? []).filter((sound) => sound.id !== id) });
  const removeRole = (id: string) =>
    updateSettings({ roles: settings.roles.filter((role) => role.id !== id) });
  const removeRule = (rule: string) =>
    updateAccess({ rules: settings.access.rules.filter((item) => item !== rule) });

  const renderProfile = () => (
    <>
      <SectionHeader
        eyebrow="Server profile"
        title="Customize your server"
        description="Make your server recognizable in invites, member lists, and discovery."
      />
      <SettingsCard className="server-profile-card">
        <div
          className={`server-profile-banner ${settings.bannerUrl ? 'server-profile-banner-draggable' : ''} ${bannerDrag ? 'server-profile-banner-dragging' : ''}`}
          style={{
            backgroundColor: settings.bannerColor,
            backgroundImage: settings.bannerUrl
              ? `linear-gradient(90deg, rgb(0 0 0 / 62%), rgb(0 0 0 / 10%)), url(${settings.bannerUrl})`
              : undefined,
            backgroundPosition: `${settings.bannerPosition.x}% ${settings.bannerPosition.y}%`,
          }}
          aria-label={settings.bannerUrl ? 'Drag to reposition server banner image' : undefined}
          onLostPointerCapture={stopBannerDrag}
          onPointerCancel={stopBannerDrag}
          onPointerDown={handleBannerPointerDown}
          onPointerMove={handleBannerPointerMove}
          onPointerUp={stopBannerDrag}
        />
        {settings.bannerUrl ? (
          <p className="server-banner-position-hint">
            {bannerDrag
              ? 'Release to place the image.'
              : 'Drag the image to choose what appears in the banner.'}
          </p>
        ) : null}
        <div className="server-profile-card-body">
          <PersonAvatar image={settings.iconUrl || undefined} name={draft.name} size="large" />
          <div>
            <strong>{draft.name}</strong>
            <span>
              {members.length} member{members.length === 1 ? '' : 's'}
            </span>
            {settings.traits.length ? <small>{settings.traits.join('  /  ')}</small> : null}
          </div>
        </div>
      </SettingsCard>
      <div className="server-settings-form-grid">
        <label className="server-settings-field">
          <span>Name</span>
          <input
            value={draft.name}
            maxLength={80}
            onChange={(event) => updateGroup({ name: event.target.value })}
          />
        </label>
        <div className="server-settings-field">
          <span>Server icon</span>
          <span className="server-settings-upload-row">
            <label className="server-settings-button server-settings-button-primary">
              <UploadSimple size={16} /> Change server icon
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleIconUpload(event)}
              />
            </label>
            <small>Large images are resized automatically.</small>
          </span>
        </div>
      </div>
      <SettingsCard>
        <h2>Banner</h2>
        <p className="server-settings-muted">
          Choose a color or upload a wide image for the banner behind your server profile.
        </p>
        <div className="server-banner-options">
          {BANNER_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={settings.bannerColor === color ? 'selected' : ''}
              style={{ backgroundColor: color }}
              aria-label={`Use ${color} banner`}
              aria-pressed={settings.bannerColor === color}
              onClick={() => updateSettings({ bannerColor: color })}
            />
          ))}
        </div>
        <div className="server-banner-upload-row">
          <label className="server-settings-button server-settings-button-primary">
            <UploadSimple size={16} /> Upload banner image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handleBannerUpload(event)}
            />
          </label>
          <small>Wide images are resized automatically. Recommended: 3:1, up to 2 MB.</small>
          {settings.bannerUrl ? (
            <>
              <button
                type="button"
                className="server-settings-button"
                onClick={() => updateSettings({ bannerPosition: { x: 50, y: 50 } })}
              >
                Center image
              </button>
              <button
                type="button"
                className="server-settings-button"
                onClick={() => updateSettings({ bannerPosition: { x: 50, y: 50 }, bannerUrl: '' })}
              >
                Remove image
              </button>
            </>
          ) : null}
        </div>
      </SettingsCard>
      <div className="server-settings-form-grid">
        <label className="server-settings-field server-settings-field-wide">
          <span>Description</span>
          <textarea
            value={draft.description}
            maxLength={300}
            onChange={(event) => updateGroup({ description: event.target.value })}
            placeholder="Tell the world a bit about this server."
          />
        </label>
        <label className="server-settings-field">
          <span>Games and interests</span>
          <input
            value={settings.games.join(', ')}
            onChange={(event) =>
              updateSettings({
                games: event.target.value
                  .split(',')
                  .map((game) => game.trim())
                  .filter(Boolean)
                  .slice(0, 10),
              })
            }
            placeholder="Valorant, Minecraft"
          />
        </label>
        <div className="server-settings-field">
          <span>Traits</span>
          <div className="server-traits-grid">
            {Array.from({ length: 5 }, (_, index) => (
              <input
                key={`trait-${index}`}
                value={settings.traits[index] ?? ''}
                maxLength={24}
                placeholder={`Trait ${index + 1}`}
                onChange={(event) => {
                  const traits = [...settings.traits];
                  traits[index] = event.target.value;
                  updateSettings({ traits: traits.filter(Boolean).slice(0, 5) });
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <ToggleRow
        checked={settings.privateProfile}
        label="Private server profile"
        description="Only members can view the profile details."
        onChange={(privateProfile) => updateSettings({ privateProfile })}
      />
      {uploadError ? <p className="server-settings-error">{uploadError}</p> : null}
    </>
  );

  const renderTag = () => (
    <>
      <SectionHeader
        title="Server Tag"
        description="Create a short tag members can display next to their name."
      />
      <SettingsCard>
        <label className="server-settings-field">
          <span>Tag name</span>
          <input
            value={settings.serverTag.name}
            maxLength={4}
            onChange={(event) =>
              updateTag({ name: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
            }
            placeholder="SCUT"
          />
          <small className="server-settings-muted">Use up to four letters or numbers.</small>
        </label>
        <div className="server-tag-preview" style={{ borderColor: settings.serverTag.color }}>
          <span style={{ color: settings.serverTag.color }}>{settings.serverTag.badge}</span>
          <strong>{settings.serverTag.name || 'TAG'}</strong>
          <small>{draft.name}</small>
        </div>
      </SettingsCard>
      <SettingsCard>
        <h2>Choose badge</h2>
        <div className="server-choice-grid server-choice-grid-small">
          {TAG_BADGES.map((badge) => (
            <button
              type="button"
              key={badge}
              className={settings.serverTag.badge === badge ? 'selected' : ''}
              onClick={() => updateTag({ badge })}
            >
              {badge}
            </button>
          ))}
        </div>
        <h2>Choose color</h2>
        <div className="server-choice-grid server-choice-grid-small">
          {TAG_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={settings.serverTag.color === color ? 'selected' : ''}
              style={{ color }}
              onClick={() => updateTag({ color })}
            >
              {settings.serverTag.badge}
            </button>
          ))}
        </div>
      </SettingsCard>
    </>
  );

  const renderEngagement = () => (
    <>
      <SectionHeader
        title="Engagement"
        description="Manage settings that help keep your server active."
      />
      <SettingsCard>
        <h2>System messages</h2>
        <ToggleRow
          checked={settings.engagement.welcomeMessages}
          label="Send a welcome message when someone joins"
          onChange={(welcomeMessages) => updateEngagement({ welcomeMessages })}
        />
        <ToggleRow
          checked={settings.engagement.replySticker}
          label="Prompt members to reply to welcome messages with a sticker"
          onChange={(replySticker) => updateEngagement({ replySticker })}
        />
        <ToggleRow
          checked={settings.engagement.boostMessages}
          label="Send a message when someone boosts this server"
          onChange={(boostMessages) => updateEngagement({ boostMessages })}
        />
        <ToggleRow
          checked={settings.engagement.setupTips}
          label="Send helpful tips for server setup"
          onChange={(setupTips) => updateEngagement({ setupTips })}
        />
        <label className="server-settings-field">
          <span>System messages channel</span>
          <select
            value={settings.engagement.systemChannelId}
            onChange={(event) => updateEngagement({ systemChannelId: event.target.value })}
          >
            <option value="">No system channel</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                # {channel.name}
              </option>
            ))}
          </select>
        </label>
      </SettingsCard>
      <SettingsCard>
        <h2>Activity feed</h2>
        <ToggleRow
          checked={settings.engagement.activityFeed}
          label="Display activity feed in this server"
          onChange={(activityFeed) => updateEngagement({ activityFeed })}
        />
        <fieldset className="server-settings-radio-group">
          <legend>Default notifications</legend>
          <label>
            <input
              type="radio"
              checked={settings.engagement.defaultNotifications === 'all'}
              onChange={() => updateEngagement({ defaultNotifications: 'all' })}
            />{' '}
            All messages
          </label>
          <label>
            <input
              type="radio"
              checked={settings.engagement.defaultNotifications === 'mentions'}
              onChange={() => updateEngagement({ defaultNotifications: 'mentions' })}
            />{' '}
            Only @mentions
          </label>
        </fieldset>
      </SettingsCard>
      <SettingsCard>
        <h2>Inactive channel</h2>
        <div className="server-settings-form-grid">
          <label className="server-settings-field">
            <span>Channel</span>
            <select
              value={settings.engagement.inactiveChannelId}
              onChange={(event) => updateEngagement({ inactiveChannelId: event.target.value })}
            >
              <option value="">No inactive channel</option>
              {voiceChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
          <label className="server-settings-field">
            <span>Timeout</span>
            <select
              value={settings.engagement.inactiveTimeoutMinutes}
              onChange={(event) =>
                updateEngagement({ inactiveTimeoutMinutes: Number(event.target.value) })
              }
            >
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </label>
        </div>
        <ToggleRow
          checked={settings.engagement.widgetEnabled}
          label="Enable server widget"
          description="Display online members, voice channels, and an invite link outside Scuttlebutt."
          onChange={(widgetEnabled) => updateEngagement({ widgetEnabled })}
        />
      </SettingsCard>
    </>
  );

  const renderBoosts = () => (
    <>
      <SectionHeader
        title="Boost Perks"
        description="A lightweight roadmap for the community perks your server can unlock."
      />
      <div className="server-perk-timeline">
        {[
          { level: 'No server boost', boosts: '0 boosts', perk: '5 sticker slots available' },
          { level: 'Level 1', boosts: '2 boosts', perk: '+10 sticker slots' },
          { level: 'Level 2', boosts: '7 boosts', perk: '+15 sticker slots (30 total)' },
          { level: 'Level 3', boosts: '14 boosts', perk: '+30 sticker slots (60 total)' },
        ].map((perk) => (
          <SettingsCard key={perk.level} className="server-perk-card">
            <div>
              <strong>{perk.level}</strong>
              <small>{perk.boosts}</small>
            </div>
            <p>{perk.perk}</p>
            <button type="button" className="server-settings-button">
              Preview perk
            </button>
          </SettingsCard>
        ))}
      </div>
    </>
  );

  const renderEmoji = () => (
    <>
      <SectionHeader
        title="Emoji"
        description="Add custom emoji that members can use across Scuttlebutt conversations."
      />
      <label className="server-settings-button server-settings-button-primary server-settings-upload-button">
        <UploadSimple size={16} /> Upload emoji
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => void handleEmojiUpload(event)}
        />
      </label>
      <p className="server-settings-muted">
        {(draft.emotes ?? []).length}/50 emoji. Files are limited to 512 KB each.
      </p>
      {uploadError ? <p className="server-settings-error">{uploadError}</p> : null}
      {(draft.emotes ?? []).length ? (
        <div className="server-asset-list">
          {(draft.emotes ?? []).map((emote) => (
            <div className="server-asset-row" key={emote.id}>
              <img src={emote.dataUrl} alt="" />
              <span>
                <strong>:{emote.name}:</strong>
                <small>Available in {emote.sourceGroupName}</small>
              </span>
              <button type="button" onClick={() => removeEmote(emote.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No emoji yet">
          Get the party started by uploading your first custom emoji.
        </EmptyState>
      )}
    </>
  );

  const renderStickers = () => (
    <>
      <SectionHeader
        title="Stickers"
        description="Plan sticker slots and boost perks for your server."
      />
      <div className="server-perk-timeline">
        {[5, 15, 30, 60].map((slots, index) => (
          <SettingsCard className="server-sticker-tier" key={slots}>
            <div>
              <strong>{index === 0 ? 'Free slots' : `Level ${index}`}</strong>
              <small>{index * 2 || 0} boosts</small>
            </div>
            <p>{slots} sticker slots</p>
            <button type="button" className="server-settings-button">
              {index === 0 ? 'Upload sticker' : 'Locked preview'}
            </button>
          </SettingsCard>
        ))}
      </div>
    </>
  );

  const renderSoundboard = () => (
    <>
      <SectionHeader
        title="Soundboard"
        description="Upload sound reactions that anyone in this server can use in voice channels."
      />
      <label className="server-settings-button server-settings-button-primary server-settings-upload-button">
        <UploadSimple size={16} /> Upload sound
        <input type="file" accept="audio/*" onChange={(event) => void handleSoundUpload(event)} />
      </label>
      <p className="server-settings-muted">
        {(draft.sounds ?? []).length} custom sounds. Files are limited to 1.5 MB each.
      </p>
      {uploadError ? <p className="server-settings-error">{uploadError}</p> : null}
      {(draft.sounds ?? []).length ? (
        <div className="server-asset-list">
          {(draft.sounds ?? []).map((sound) => (
            <div className="server-asset-row" key={sound.id}>
              <Waveform size={24} />
              <span>
                <strong>{sound.name}</strong>
                <small>Available in {sound.sourceGroupName}</small>
              </span>
              <audio controls src={sound.dataUrl} />
              <button type="button" onClick={() => removeSound(sound.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No sounds yet">
          Add a short audio clip to give your voice channels a custom soundboard.
        </EmptyState>
      )}
    </>
  );

  const renderMembers = () => (
    <>
      <SectionHeader
        title="Server Members"
        description="See who belongs to this server and choose how members appear in the channel list."
      />
      <ToggleRow
        checked={settings.membersInChannelList}
        label="Show members in channel list"
        description="Show a member list in the server navigation."
        onChange={(membersInChannelList) => updateSettings({ membersInChannelList })}
      />
      <SettingsCard>
        <div className="server-settings-toolbar">
          <label className="server-settings-search">
            <MagnifyingGlass size={16} />
            <input
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Search by username or id"
            />
          </label>
          <button type="button" className="server-settings-button" onClick={onInvite}>
            <Plus size={15} /> Invite member
          </button>
        </div>
        <div className="server-member-table">
          {filteredMembers.map((member) => (
            <div className="server-member-row" key={member.id}>
              <PersonAvatar
                image={member.avatar}
                name={member.name}
                status={member.status}
                size="small"
              />
              <span>
                <strong>{member.name}</strong>
                <small>
                  {member.note} / {member.id}
                </small>
              </span>
              <small>{member.status}</small>
            </div>
          ))}
        </div>
        {!filteredMembers.length ? (
          <p className="server-settings-muted">No members match your search.</p>
        ) : null}
      </SettingsCard>
    </>
  );

  const renderRoles = () => (
    <>
      <SectionHeader
        title="Roles"
        description="Use roles to organize members and assign server permissions."
      />
      <SettingsCard className="server-roles-hero">
        <GearSix size={42} weight="duotone" />
        <h2>Organize your members</h2>
        <p>Create roles for moderators, friends, or project teams.</p>
        <div className="server-role-create">
          <input
            value={newRole}
            onChange={(event) => setNewRole(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addRole();
            }}
            placeholder="Role name"
          />
          <button
            type="button"
            className="server-settings-button server-settings-button-primary"
            onClick={addRole}
          >
            <Plus size={15} /> Create role
          </button>
        </div>
      </SettingsCard>
      <div className="server-role-list">
        {settings.roles.map((role) => (
          <SettingsCard className="server-role-card" key={role.id}>
            <span className="server-role-dot" style={{ backgroundColor: role.color }} />
            <span>
              <strong>{role.name}</strong>
              <small>{role.permissions.join(' / ')}</small>
            </span>
            {role.id !== 'everyone' ? (
              <button type="button" onClick={() => removeRole(role.id)}>
                Remove
              </button>
            ) : (
              <small>Default</small>
            )}
          </SettingsCard>
        ))}
      </div>
    </>
  );

  const renderInvites = () => (
    <>
      <SectionHeader
        title="Invites"
        description="Create and manage invite links for this server."
      />
      <div className="server-settings-actions">
        <button
          type="button"
          className="server-settings-button"
          onClick={() => updateSettings({ invites: [] })}
        >
          Pause invites
        </button>
        <button
          type="button"
          className="server-settings-button server-settings-button-primary"
          onClick={() => void createInvite()}
        >
          <Plus size={15} /> Create invite link
        </button>
      </div>
      {settings.invites.length ? (
        <div className="server-invite-list">
          {settings.invites.map((invite) => (
            <SettingsCard className="server-invite-row" key={invite.code}>
              <span>
                <strong>{invite.code}</strong>
                <small>
                  Created {new Date(invite.createdAt).toLocaleDateString()} / {invite.uses} uses
                </small>
              </span>
              <button
                type="button"
                className="server-settings-button"
                onClick={() => {
                  setInviteCopied(invite.code);
                  void navigator.clipboard?.writeText(
                    `${window.location.origin}/invite/${invite.code}`,
                  );
                }}
              >
                <Copy size={15} /> {inviteCopied === invite.code ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={() => removeInvite(invite.code)}>
                Remove
              </button>
            </SettingsCard>
          ))}
        </div>
      ) : (
        <EmptyState title="No active invite links">
          Create an invite link and share it with someone you trust.
        </EmptyState>
      )}
    </>
  );

  const renderAccess = () => (
    <>
      <SectionHeader
        title="Access"
        description="Choose how people can find and join your server."
      />
      <div className="server-access-grid">
        {(
          [
            {
              id: 'invite-only',
              label: 'Invite only',
              text: 'People can join directly with an invite.',
            },
            {
              id: 'apply-to-join',
              label: 'Apply to join',
              text: 'People submit an application before joining.',
            },
            {
              id: 'discoverable',
              label: 'Discoverable',
              text: 'Anyone can find your server in discovery.',
            },
          ] as Array<{ id: ServerAccessMode; label: string; text: string }>
        ).map((option) => (
          <button
            type="button"
            key={option.id}
            className={settings.access.mode === option.id ? 'selected' : ''}
            onClick={() => updateAccess({ mode: option.id })}
          >
            <strong>{option.label}</strong>
            <span>{option.text}</span>
          </button>
        ))}
      </div>
      <SettingsCard>
        <ToggleRow
          checked={settings.access.ageRestricted}
          label="Age-restricted server"
          description="Members must confirm they are old enough to view this server."
          onChange={(ageRestricted) => updateAccess({ ageRestricted })}
        />
        <ToggleRow
          checked={settings.access.rulesEnabled}
          label="Server rules"
          description="Members must agree to rules before they can chat or interact."
          onChange={(rulesEnabled) => updateAccess({ rulesEnabled })}
        />
        <div className="server-rule-editor">
          <label className="server-settings-field">
            <span>Add a rule</span>
            <input
              value={newRule}
              onChange={(event) => setNewRule(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addRule();
              }}
              placeholder="Be civil and respectful"
            />
          </label>
          <button type="button" className="server-settings-button" onClick={addRule}>
            <Plus size={15} /> Add rule
          </button>
          {settings.access.rules.map((rule) => (
            <div className="server-rule-pill" key={rule}>
              <span>{rule}</span>
              <button type="button" onClick={() => removeRule(rule)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );

  const renderIntegrations = () => (
    <>
      <SectionHeader
        title="Integrations"
        description="Customize this server with webhooks, followed channels, and apps."
      />
      <SettingsCard>
        <div className="server-settings-card-heading">
          <span>
            <strong>Webhooks</strong>
            <small>{settings.webhooks.length} webhooks</small>
          </span>
          <button
            type="button"
            className="server-settings-button server-settings-button-primary"
            onClick={() =>
              updateSettings({
                webhooks: [...settings.webhooks, `webhook-${settings.webhooks.length + 1}`],
              })
            }
          >
            Create webhook
          </button>
        </div>
        {settings.webhooks.map((webhook) => (
          <div className="server-integration-row" key={webhook}>
            <Waveform size={20} />
            <span>{webhook}</span>
            <button
              type="button"
              onClick={() =>
                updateSettings({ webhooks: settings.webhooks.filter((item) => item !== webhook) })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </SettingsCard>
      <SettingsCard>
        <div className="server-settings-card-heading">
          <span>
            <strong>Channels followed</strong>
            <small>0 channels</small>
          </span>
          <button type="button" className="server-settings-button">
            Learn more
          </button>
        </div>
        <p className="server-settings-muted">
          Followed channels and app integrations will appear here as they are connected.
        </p>
      </SettingsCard>
    </>
  );

  const renderSafety = () => (
    <>
      <SectionHeader
        title="Safety Setup"
        description="Review the safety controls that protect your members."
      />
      <SettingsCard>
        <ToggleRow
          checked={settings.moderation.mentionSpam}
          label="Block mention spam"
          description="Limit excessive role and user mentions."
          onChange={(mentionSpam) => updateModeration({ mentionSpam })}
        />
        <ToggleRow
          checked={settings.moderation.suspectedSpam}
          label="Block suspected spam content"
          description="Flag messages that look like spam before they spread."
          onChange={(suspectedSpam) => updateModeration({ suspectedSpam })}
        />
        <ToggleRow
          checked={settings.moderation.flaggedWords}
          label="Block flagged words"
          description="Use the server word list to moderate messages."
          onChange={(flaggedWords) => updateModeration({ flaggedWords })}
        />
      </SettingsCard>
      <SettingsCard>
        <h2>Content filtering</h2>
        <label className="server-settings-field">
          <span>Image-based media</span>
          <select
            value={settings.moderation.sensitiveContent}
            onChange={(event) =>
              updateModeration({
                sensitiveContent: event.target
                  .value as ServerSettings['moderation']['sensitiveContent'],
              })
            }
          >
            <option value="none">Do not filter</option>
            <option value="filter">Filter sensitive media</option>
          </select>
        </label>
      </SettingsCard>
    </>
  );

  const renderAudit = () => (
    <>
      <SectionHeader
        title="Audit Log"
        description="Review changes made to this server's settings."
      />
      <SettingsCard className="server-audit-list">
        {[
          {
            event: 'Server settings opened',
            detail: `Viewed by ${currentUserName}`,
            date: 'Just now',
          },
          {
            event: 'Workspace sync enabled',
            detail: 'Changes are shared with members',
            date: 'Recent',
          },
          {
            event: 'Permission model initialized',
            detail: '@everyone role created',
            date: 'Recent',
          },
        ].map((item) => (
          <div className="server-audit-row" key={item.event}>
            <Check size={18} />
            <span>
              <strong>{item.event}</strong>
              <small>{item.detail}</small>
            </span>
            <small>{item.date}</small>
          </div>
        ))}
      </SettingsCard>
    </>
  );

  const renderBans = () => (
    <>
      <SectionHeader
        title="Server Ban List"
        description="Search and manage members banned from this server."
      />
      <label className="server-settings-search server-ban-search">
        <MagnifyingGlass size={16} />
        <input
          value={banSearch}
          onChange={(event) => setBanSearch(event.target.value)}
          placeholder="Search bans by user id or username"
        />
      </label>
      <EmptyState title="No bans">
        {banSearch ? `No banned members match “${banSearch}”.` : 'You have not banned anybody yet.'}
      </EmptyState>
    </>
  );

  const renderAutomod = () => (
    <>
      <SectionHeader
        title="AutoMod"
        description="Set up filters to moderate content and automate a response when it is found."
      />
      <div className="server-automod-list">
        <SettingsCard>
          <ToggleRow
            checked={settings.moderation.mentionSpam}
            label="Block mention spam"
            onChange={(mentionSpam) => updateModeration({ mentionSpam })}
          />
          <span className="server-settings-chip">block message</span>
          <span className="server-settings-chip">send alert</span>
        </SettingsCard>
        <SettingsCard>
          <ToggleRow
            checked={settings.moderation.suspectedSpam}
            label="Block suspected spam content"
            onChange={(suspectedSpam) => updateModeration({ suspectedSpam })}
          />
          <span className="server-settings-chip">block message</span>
        </SettingsCard>
        <SettingsCard>
          <ToggleRow
            checked={settings.moderation.flaggedWords}
            label="Block commonly flagged words"
            onChange={(flaggedWords) => updateModeration({ flaggedWords })}
          />
          <span className="server-settings-chip">block message</span>
        </SettingsCard>
      </div>
      <SettingsCard>
        <h2>Block custom words</h2>
        <div className="server-rule-editor">
          <input
            value={newWord}
            onChange={(event) => setNewWord(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addCustomWord();
            }}
            placeholder="Add a word"
          />
          <button type="button" className="server-settings-button" onClick={addCustomWord}>
            <Plus size={15} /> Add word
          </button>
        </div>
        <div className="server-chip-list">
          {settings.moderation.customWords.map((word) => (
            <span className="server-settings-chip" key={word}>
              {word}
              <button
                type="button"
                onClick={() =>
                  updateModeration({
                    customWords: settings.moderation.customWords.filter((item) => item !== word),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </SettingsCard>
    </>
  );

  const renderCommunity = () => (
    <>
      <SectionHeader
        title="Enable Community"
        description="Unlock additional tools that help you moderate and grow your server."
      />
      <SettingsCard className="server-community-hero">
        <GearSix size={54} weight="duotone" />
        <h2>Are you building a community?</h2>
        <p>
          Community servers are larger spaces where people with shared interests can come together.
        </p>
        <button
          type="button"
          className="server-settings-button server-settings-button-primary"
          onClick={() => updateSettings({ communityEnabled: !settings.communityEnabled })}
        >
          {settings.communityEnabled ? 'Community enabled' : 'Enable Community'}
        </button>
      </SettingsCard>
      <div className="server-feature-grid">
        <SettingsCard>
          <strong>Grow your community</strong>
          <p>Make discovery and invites easier for new members.</p>
        </SettingsCard>
        <SettingsCard>
          <strong>Keep members engaged</strong>
          <p>Use channels, roles, and events to keep conversations active.</p>
        </SettingsCard>
        <SettingsCard>
          <strong>Stay informed</strong>
          <p>Keep safety settings and server announcements in one place.</p>
        </SettingsCard>
      </div>
    </>
  );

  const renderTemplate = () => (
    <>
      <SectionHeader
        title="Server Template"
        description="Save this server's channels and settings as a reusable starting point."
      />
      <SettingsCard className="server-template-card">
        <GearSix size={46} weight="duotone" />
        <h2>{draft.name} template</h2>
        <p>
          Template creation is local for now. It will include {draft.channels.length} channel
          {draft.channels.length === 1 ? '' : 's'}, {settings.roles.length} role
          {settings.roles.length === 1 ? '' : 's'}, and your server profile settings.
        </p>
        <button
          type="button"
          className="server-settings-button server-settings-button-primary"
          onClick={() => setInviteCopied('template')}
        >
          {inviteCopied === 'template' ? 'Template ready' : 'Create template'}
        </button>
      </SettingsCard>
    </>
  );

  const renderSection = () => {
    switch (section) {
      case 'profile':
        return renderProfile();
      case 'tag':
        return renderTag();
      case 'engagement':
        return renderEngagement();
      case 'boosts':
        return renderBoosts();
      case 'emoji':
        return renderEmoji();
      case 'stickers':
        return renderStickers();
      case 'soundboard':
        return renderSoundboard();
      case 'members':
        return renderMembers();
      case 'roles':
        return renderRoles();
      case 'invites':
        return renderInvites();
      case 'access':
        return renderAccess();
      case 'integrations':
        return renderIntegrations();
      case 'safety':
        return renderSafety();
      case 'audit':
        return renderAudit();
      case 'bans':
        return renderBans();
      case 'automod':
        return renderAutomod();
      case 'community':
        return renderCommunity();
      case 'template':
        return renderTemplate();
    }
  };

  return (
    <div className="server-settings-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="server-settings-shell"
        role="dialog"
        aria-modal="true"
        aria-label={`${draft.name} server settings`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="server-settings-nav">
          <div className="server-settings-nav-title">
            <span>{draft.name}'s server</span>
            <button type="button" aria-label="Close server settings" onClick={onCancel}>
              <X size={18} />
            </button>
          </div>
          <div className="server-settings-nav-scroll">
            {NAV_GROUPS.map((groupNav) => (
              <div className="server-settings-nav-group" key={groupNav.label}>
                <span className="server-settings-nav-label">{groupNav.label}</span>
                {groupNav.items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={section === item.id ? 'active' : ''}
                    onClick={() => {
                      setSection(item.id);
                      setDeleteArmed(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              className="server-settings-nav-delete"
              onClick={() => {
                setSection('template');
                setDeleteArmed(true);
              }}
            >
              Delete Server
            </button>
          </div>
        </aside>
        <main className="server-settings-main">
          <header className="server-settings-main-header">
            <div>
              <p className="section-kicker">Server settings</p>
              <h2>{selectedNav?.label ?? 'Server Profile'}</h2>
            </div>
            <button type="button" aria-label="Close server settings" onClick={onCancel}>
              <X size={20} />
            </button>
          </header>
          <div className="server-settings-content">
            {section === 'template' && deleteArmed ? (
              <SettingsCard className="server-delete-card">
                <h2>Delete {draft.name}?</h2>
                <p>
                  This permanently removes the server from your synced workspace. This cannot be
                  undone.
                </p>
                <div className="server-settings-actions">
                  <button
                    type="button"
                    className="server-settings-button"
                    onClick={() => setDeleteArmed(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="server-settings-button server-settings-button-danger"
                    onClick={onDelete}
                  >
                    Delete server
                  </button>
                </div>
              </SettingsCard>
            ) : (
              renderSection()
            )}
          </div>
          <footer className="server-settings-footer">
            <span>{saving ? 'Saving settings...' : 'Changes sync to your workspace.'}</span>
            <div>
              <button type="button" className="server-settings-button" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="server-settings-button server-settings-button-primary"
                onClick={save}
              >
                <Check size={16} /> Save Changes
              </button>
            </div>
          </footer>
        </main>
      </section>
    </div>
  );
}
