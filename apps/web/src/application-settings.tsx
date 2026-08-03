import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  Bell,
  ChatCircleDots,
  Check,
  CircleHalf,
  Code,
  Database,
  DownloadSimple,
  GameController,
  Globe,
  LinkSimple,
  MagnifyingGlass,
  Microphone,
  MonitorArrowUp,
  Moon,
  Palette,
  PaintBrush,
  SignOut,
  Sun,
  TrashSimple,
  Translate,
  User,
  X,
  ShieldCheck,
} from '@phosphor-icons/react';

import { PersonAvatar } from './App.js';
import type { SignedInUser } from './auth.js';
import type { UserProfile } from './WorkspaceApp.js';

export type ApplicationSettingsSection =
  | 'account'
  | 'security'
  | 'privacy'
  | 'messaging'
  | 'notifications'
  | 'voice'
  | 'appearance'
  | 'accessibility'
  | 'language'
  | 'activity'
  | 'connections'
  | 'developer';

export type ApplicationTheme = 'midnight' | 'dim' | 'amoled';
export type ApplicationDensity = 'compact' | 'default' | 'spacious';
export type ApplicationTextSize = 12 | 14 | 16 | 18 | 20;

export interface ApplicationPreferences {
  allowDirectMessages: boolean;
  density: ApplicationDensity;
  highContrast: boolean;
  inputDeviceId: string;
  inputMode: 'push-to-talk' | 'voice-activity';
  inputProfile: 'custom' | 'isolation' | 'studio';
  microphoneVolume: number;
  language: 'en-CA' | 'en-US';
  notificationsEnabled: boolean;
  outputDeviceId: string;
  outputVolume: number;
  reducedMotion: boolean;
  shareActivity: boolean;
  showReadReceipts: boolean;
  textSize: ApplicationTextSize;
  theme: ApplicationTheme;
  timeFormat: '12-hour' | '24-hour' | 'auto';
  voiceIsolation: boolean;
}

export const DEFAULT_APPLICATION_PREFERENCES: ApplicationPreferences = {
  allowDirectMessages: true,
  density: 'default',
  highContrast: false,
  inputDeviceId: 'default',
  inputMode: 'voice-activity',
  inputProfile: 'isolation',
  microphoneVolume: 100,
  language: 'en-US',
  notificationsEnabled: true,
  outputDeviceId: 'default',
  outputVolume: 80,
  reducedMotion: false,
  shareActivity: false,
  showReadReceipts: true,
  textSize: 16,
  theme: 'midnight',
  timeFormat: 'auto',
  voiceIsolation: true,
};

const APPLICATION_SETTINGS_STORAGE_KEY = 'scuttlebutt:application-settings:v1';
const VOICE_SETTINGS_STORAGE_KEY = 'scuttlebutt:voice-settings';

export function loadApplicationPreferences(userId: string): ApplicationPreferences {
  if (typeof window === 'undefined') return DEFAULT_APPLICATION_PREFERENCES;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(`${APPLICATION_SETTINGS_STORAGE_KEY}:${userId}`) ?? '{}',
    ) as Partial<ApplicationPreferences>;
    return { ...DEFAULT_APPLICATION_PREFERENCES, ...stored };
  } catch {
    return DEFAULT_APPLICATION_PREFERENCES;
  }
}

export function saveApplicationPreferences(
  userId: string,
  preferences: ApplicationPreferences,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${APPLICATION_SETTINGS_STORAGE_KEY}:${userId}`,
    JSON.stringify(preferences),
  );
  window.localStorage.setItem(
    VOICE_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      inputDeviceId: preferences.inputDeviceId,
      inputMode: preferences.inputMode,
      inputProfile: preferences.inputProfile,
      inputVolume: preferences.microphoneVolume,
      outputDeviceId: preferences.outputDeviceId,
      outputVolume: preferences.outputVolume,
    }),
  );
}

interface NavigationItem {
  id: ApplicationSettingsSection;
  label: string;
}

interface NavigationGroup {
  label?: string;
  items: NavigationItem[];
}

const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    items: [
      { id: 'account', label: 'Account' },
      { id: 'security', label: 'Password & Security' },
      { id: 'privacy', label: 'Data & Privacy' },
      { id: 'messaging', label: 'Messaging Permissions' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    label: 'Experience',
    items: [
      { id: 'voice', label: 'Voice & Video' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'accessibility', label: 'Accessibility' },
      { id: 'language', label: 'Language & Time' },
    ],
  },
  {
    label: 'Games & Apps',
    items: [
      { id: 'activity', label: 'Activity Privacy' },
      { id: 'connections', label: 'Connected Apps' },
    ],
  },
  {
    items: [{ id: 'developer', label: 'Developer' }],
  },
];

function navigationIcon(id: ApplicationSettingsSection): ReactNode {
  const props = { size: 18, weight: 'bold' as const };
  if (id === 'account' || id === 'security') return <User {...props} />;
  if (id === 'privacy') return <ShieldCheck {...props} />;
  if (id === 'messaging') return <ChatCircleDots {...props} />;
  if (id === 'notifications') return <Bell {...props} />;
  if (id === 'voice') return <Microphone {...props} />;
  if (id === 'appearance') return <Palette {...props} />;
  if (id === 'accessibility') return <PaintBrush {...props} />;
  if (id === 'language') return <Translate {...props} />;
  if (id === 'activity') return <GameController {...props} />;
  if (id === 'connections') return <LinkSimple {...props} />;
  return <Code {...props} />;
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`application-settings-toggle ${checked ? 'active' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

function SettingRow({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="application-settings-row">
      <div>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </div>
      <div className="application-settings-row-control">{children}</div>
    </div>
  );
}

function SettingsHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="application-settings-section-header">
      {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function RadioChoice({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`application-settings-radio-choice ${checked ? 'active' : ''}`}
      aria-pressed={checked}
      onClick={onChange}
    >
      <span className="application-settings-radio-dot" />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </button>
  );
}

export function ApplicationSettingsDialog({
  onChange,
  onClose,
  onEditProfile,
  onLogout,
  preferences,
  profile,
  user,
}: {
  onChange: (preferences: ApplicationPreferences) => void;
  onClose: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  preferences: ApplicationPreferences;
  profile: UserProfile;
  user: SignedInUser;
}) {
  const [activeSection, setActiveSection] = useState<ApplicationSettingsSection>('account');
  const [search, setSearch] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [micTestState, setMicTestState] = useState<'idle' | 'testing' | 'ready' | 'blocked'>(
    'idle',
  );
  const [cameraTestState, setCameraTestState] = useState<'idle' | 'testing' | 'ready' | 'blocked'>(
    'idle',
  );

  const update = <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => onChange({ ...preferences, [key]: value });

  useEffect(() => {
    if (activeSection !== 'voice' || !navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices
      .enumerateDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [activeSection]);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return NAVIGATION_GROUPS;
    return NAVIGATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(query)),
    })).filter((group) => group.items.length > 0);
  }, [search]);

  const testMicrophone = async () => {
    setMicTestState('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());
      setMicTestState('ready');
    } catch {
      setMicTestState('blocked');
    }
  };

  const testCamera = async () => {
    setCameraTestState('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraTestState('ready');
    } catch {
      setCameraTestState('blocked');
    }
  };

  const exportLocalData = () => {
    const payload = Object.fromEntries(
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('scuttlebutt:'))
        .map((key) => [key, window.localStorage.getItem(key)]),
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'scuttlebutt-local-data.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearDrafts = () => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('scuttlebutt:draft:'))
      .forEach((key) => window.localStorage.removeItem(key));
  };

  return (
    <div className="application-settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="application-settings-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Application settings"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="application-settings-sidebar">
          <div className="application-settings-user">
            <PersonAvatar
              image={profile.avatar}
              name={profile.displayName}
              status="online"
              size="medium"
            />
            <div>
              <strong>{profile.displayName}</strong>
              <button type="button" onClick={onEditProfile}>
                Edit Profile <PaintBrush size={13} />
              </button>
            </div>
          </div>
          <label className="application-settings-search">
            <MagnifyingGlass size={17} />
            <span className="visually-hidden">Search settings</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
            />
          </label>
          <nav className="application-settings-nav" aria-label="Application settings sections">
            {visibleGroups.map((group, index) => (
              <div className="application-settings-nav-group" key={group.label ?? `group-${index}`}>
                {group.label ? <p>{group.label}</p> : null}
                {group.items.map((item) => (
                  <button
                    type="button"
                    className={activeSection === item.id ? 'active' : ''}
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {navigationIcon(item.id)}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <button type="button" className="application-settings-logout" onClick={onLogout}>
            <SignOut size={18} /> Log Out
          </button>
          <small className="application-settings-version">Scuttlebutt · local preferences</small>
        </aside>

        <main className="application-settings-main">
          <header className="application-settings-main-header">
            <strong>
              {NAVIGATION_GROUPS.flatMap(({ items }) => items).find(
                ({ id }) => id === activeSection,
              )?.label ?? 'Settings'}
            </strong>
            <button type="button" aria-label="Close application settings" onClick={onClose}>
              <X size={21} />
            </button>
          </header>
          <div className="application-settings-content">
            {activeSection === 'account' ? (
              <AccountSettings user={user} profile={profile} onEditProfile={onEditProfile} />
            ) : null}
            {activeSection === 'security' ? <SecuritySettings /> : null}
            {activeSection === 'privacy' ? (
              <PrivacySettings
                preferences={preferences}
                onChange={update}
                onClearDrafts={clearDrafts}
                onExport={exportLocalData}
              />
            ) : null}
            {activeSection === 'messaging' ? (
              <MessagingSettings preferences={preferences} onChange={update} />
            ) : null}
            {activeSection === 'notifications' ? (
              <NotificationsSettings preferences={preferences} onChange={update} />
            ) : null}
            {activeSection === 'voice' ? (
              <VoiceAndVideoSettings
                devices={devices}
                micTestState={micTestState}
                cameraTestState={cameraTestState}
                onCameraTest={() => void testCamera()}
                onMicTest={() => void testMicrophone()}
                preferences={preferences}
                onChange={update}
              />
            ) : null}
            {activeSection === 'appearance' ? (
              <AppearanceSettings preferences={preferences} onChange={update} />
            ) : null}
            {activeSection === 'accessibility' ? (
              <AccessibilitySettings preferences={preferences} onChange={update} />
            ) : null}
            {activeSection === 'language' ? (
              <LanguageSettings preferences={preferences} onChange={update} />
            ) : null}
            {activeSection === 'activity' ? (
              <ActivitySettings preferences={preferences} onChange={update} />
            ) : null}
            {activeSection === 'connections' ? <ConnectionsSettings /> : null}
            {activeSection === 'developer' ? <DeveloperSettings /> : null}
          </div>
        </main>
      </section>
    </div>
  );
}

function AccountSettings({
  onEditProfile,
  profile,
  user,
}: {
  onEditProfile: () => void;
  profile: UserProfile;
  user: SignedInUser;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Account"
        title="Account Info"
        description="Manage your Scuttlebutt identity and sign-in details."
      />
      <section className="application-settings-card application-settings-account-card">
        <PersonAvatar
          image={profile.avatar}
          name={profile.displayName}
          status="online"
          size="large"
        />
        <div>
          <strong>{profile.displayName}</strong>
          <small>{profile.bio || 'Add a short bio from Edit Profile.'}</small>
          <span>{user.email}</span>
        </div>
        <button
          type="button"
          className="application-settings-button primary"
          onClick={onEditProfile}
        >
          Edit profile
        </button>
      </section>
      <section className="application-settings-section">
        <h2>Account details</h2>
        <SettingRow
          title="Username"
          description="This is the name other people see in conversations."
        >
          <strong className="application-settings-value">{profile.displayName}</strong>
          <button type="button" className="application-settings-button" onClick={onEditProfile}>
            Edit
          </button>
        </SettingRow>
        <SettingRow title="Email" description="Google manages your sign-in email for this account.">
          <strong className="application-settings-value">{user.email}</strong>
        </SettingRow>
      </section>
      <section className="application-settings-section">
        <h2>Account standing</h2>
        <div className="application-settings-status-card">
          <span>
            <Check size={17} weight="bold" />
          </span>
          <div>
            <strong>Your account is all good</strong>
            <small>No account restrictions are active.</small>
          </div>
        </div>
      </section>
    </>
  );
}

function SecuritySettings() {
  return (
    <>
      <SettingsHeader
        eyebrow="Account"
        title="Password & Security"
        description="Keep your account protected with Google authentication and device controls."
      />
      <section className="application-settings-section">
        <SettingRow
          title="Sign-in provider"
          description="Scuttlebutt uses Google OAuth and never stores your Google password."
        >
          <span className="application-settings-chip">
            <ShieldCheck size={15} /> Google
          </span>
        </SettingRow>
        <SettingRow
          title="Multi-factor authentication"
          description="Add another verification step when this feature is available for your provider."
        >
          <button type="button" className="application-settings-button" disabled>
            Set up
          </button>
        </SettingRow>
        <SettingRow
          title="Logged-in devices"
          description="Device management will be synced with the hosted account service."
        >
          <span className="application-settings-value">Current browser</span>
        </SettingRow>
      </section>
      <section className="application-settings-card application-settings-info-card">
        <ShieldCheck size={22} />
        <div>
          <strong>Google protects your password</strong>
          <p>
            Use your Google account security page to review sign-in activity and revoke sessions.
          </p>
        </div>
      </section>
    </>
  );
}

function PrivacySettings({
  onChange,
  onClearDrafts,
  onExport,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  onClearDrafts: () => void;
  onExport: () => void;
  preferences: ApplicationPreferences;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Privacy"
        title="Data & Privacy"
        description="Choose what Scuttlebutt stores locally and how your presence is shared."
      />
      <section className="application-settings-section">
        <SettingRow
          title="Read receipts"
          description="Let friends know when you have read their direct messages."
        >
          <Toggle
            checked={preferences.showReadReceipts}
            label="Toggle read receipts"
            onChange={() => onChange('showReadReceipts', !preferences.showReadReceipts)}
          />
        </SettingRow>
        <SettingRow
          title="Direct messages"
          description="Allow friends and shared groups to start private conversations with you."
        >
          <Toggle
            checked={preferences.allowDirectMessages}
            label="Toggle direct messages"
            onChange={() => onChange('allowDirectMessages', !preferences.allowDirectMessages)}
          />
        </SettingRow>
      </section>
      <section className="application-settings-section">
        <h2>Your local data</h2>
        <p className="application-settings-muted">
          Messages and preferences are stored in the connected repository. These tools only affect
          this browser's local cache.
        </p>
        <div className="application-settings-actions">
          <button type="button" className="application-settings-button" onClick={onExport}>
            <DownloadSimple size={16} /> Export local data
          </button>
          <button
            type="button"
            className="application-settings-button danger"
            onClick={onClearDrafts}
          >
            <TrashSimple size={16} /> Clear saved drafts
          </button>
        </div>
      </section>
    </>
  );
}

function MessagingSettings({
  onChange,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  preferences: ApplicationPreferences;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Messaging"
        title="Messaging Permissions"
        description="Control how private conversations behave across your groups and friends."
      />
      <section className="application-settings-section">
        <SettingRow
          title="Allow direct messages from friends"
          description="Friends can start a DM without an invite prompt."
        >
          <Toggle
            checked={preferences.allowDirectMessages}
            label="Toggle direct message permissions"
            onChange={() => onChange('allowDirectMessages', !preferences.allowDirectMessages)}
          />
        </SettingRow>
        <SettingRow
          title="Show read receipts"
          description="Display when messages have been read in DMs."
        >
          <Toggle
            checked={preferences.showReadReceipts}
            label="Toggle read receipts"
            onChange={() => onChange('showReadReceipts', !preferences.showReadReceipts)}
          />
        </SettingRow>
      </section>
      <section className="application-settings-card application-settings-info-card">
        <ChatCircleDots size={22} />
        <div>
          <strong>Group permissions stay with server owners</strong>
          <p>Private channels, roles, and member access are managed in each server's settings.</p>
        </div>
      </section>
    </>
  );
}

function NotificationsSettings({
  onChange,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  preferences: ApplicationPreferences;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Notifications"
        title="Notifications"
        description="Choose when Scuttlebutt should interrupt you with new activity."
      />
      <section className="application-settings-section">
        <SettingRow
          title="Enable desktop notifications"
          description="Show a notification when you receive a message or friend request."
        >
          <Toggle
            checked={preferences.notificationsEnabled}
            label="Toggle desktop notifications"
            onChange={() => onChange('notificationsEnabled', !preferences.notificationsEnabled)}
          />
        </SettingRow>
        <SettingRow
          title="Default notification level"
          description="This default can be overridden per server or channel."
        >
          <select className="application-settings-select" defaultValue="all">
            <option value="all">All messages</option>
            <option value="mentions">Only @mentions</option>
          </select>
        </SettingRow>
      </section>
    </>
  );
}

function VoiceAndVideoSettings({
  cameraTestState,
  devices,
  micTestState,
  onCameraTest,
  onChange,
  onMicTest,
  preferences,
}: {
  cameraTestState: 'idle' | 'testing' | 'ready' | 'blocked';
  devices: MediaDeviceInfo[];
  micTestState: 'idle' | 'testing' | 'ready' | 'blocked';
  onCameraTest: () => void;
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  onMicTest: () => void;
  preferences: ApplicationPreferences;
}) {
  const inputs = devices.filter(({ kind }) => kind === 'audioinput');
  const outputs = devices.filter(({ kind }) => kind === 'audiooutput');
  return (
    <>
      <SettingsHeader
        eyebrow="Experience"
        title="Voice & Video"
        description="Set up your microphone, speaker, camera, and voice activity preferences."
      />
      <section className="application-settings-section">
        <div className="application-settings-device-grid">
          <label>
            <span>Microphone</span>
            <select
              className="application-settings-select"
              value={preferences.inputDeviceId}
              onChange={(event) => onChange('inputDeviceId', event.target.value)}
            >
              <option value="default">System default microphone</option>
              {inputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Microphone'}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Speaker</span>
            <select
              className="application-settings-select"
              value={preferences.outputDeviceId}
              onChange={(event) => onChange('outputDeviceId', event.target.value)}
            >
              <option value="default">System default speaker</option>
              {outputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Speaker'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="application-settings-device-grid">
          <label>
            <span>Microphone volume</span>
            <input
              type="range"
              min="0"
              max="150"
              value={preferences.microphoneVolume}
              onChange={(event) => onChange('microphoneVolume', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Speaker volume</span>
            <input
              type="range"
              min="0"
              max="150"
              value={preferences.outputVolume}
              onChange={(event) => onChange('outputVolume', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="application-settings-test-row">
          <button type="button" className="application-settings-button primary" onClick={onMicTest}>
            <Microphone size={16} /> {micTestState === 'testing' ? 'Testing…' : 'Mic test'}
          </button>
          <span className={micTestState === 'blocked' ? 'error' : ''}>
            {micTestState === 'ready'
              ? 'Microphone permission works.'
              : micTestState === 'blocked'
                ? 'Microphone permission was blocked.'
                : 'Check your input level.'}
          </span>
        </div>
      </section>
      <section className="application-settings-section">
        <h2>Input profile</h2>
        <RadioChoice
          checked={preferences.inputProfile === 'isolation'}
          label="Voice Isolation"
          description="Use browser echo cancellation, noise suppression, and automatic gain."
          onChange={() => onChange('inputProfile', 'isolation')}
        />
        <RadioChoice
          checked={preferences.inputProfile === 'studio'}
          label="Studio"
          description="Use unprocessed microphone audio for music and quiet rooms."
          onChange={() => onChange('inputProfile', 'studio')}
        />
        <RadioChoice
          checked={preferences.inputProfile === 'custom'}
          label="Custom"
          description="Use adjustable voice activity settings."
          onChange={() => onChange('inputProfile', 'custom')}
        />
      </section>
      <section className="application-settings-section">
        <h2>Input mode</h2>
        <RadioChoice
          checked={preferences.inputMode === 'voice-activity'}
          label="Automatic voice activity"
          description="Highlight people only when the detector hears speech above the sensitivity threshold."
          onChange={() => onChange('inputMode', 'voice-activity')}
        />
        <RadioChoice
          checked={preferences.inputMode === 'push-to-talk'}
          label="Push to talk"
          description="Hold Space while the call is focused to transmit audio."
          onChange={() => onChange('inputMode', 'push-to-talk')}
        />
        <SettingRow
          title="Voice isolation"
          description="Reduce background noise before activity detection."
        >
          <Toggle
            checked={preferences.voiceIsolation}
            label="Toggle voice isolation"
            onChange={() => onChange('voiceIsolation', !preferences.voiceIsolation)}
          />
        </SettingRow>
      </section>
      <section className="application-settings-section">
        <h2>Camera & streaming</h2>
        <div className="application-settings-camera-preview">
          <CameraIconState state={cameraTestState} />
          <button
            type="button"
            className="application-settings-button primary"
            onClick={onCameraTest}
          >
            <MonitorArrowUp size={16} />{' '}
            {cameraTestState === 'testing' ? 'Testing…' : 'Test camera'}
          </button>
        </div>
        <p className="application-settings-muted">
          Camera and screen sharing are available from the voice room controls. Browser permission
          is requested only when you start a test or share.
        </p>
      </section>
    </>
  );
}

function CameraIconState({ state }: { state: 'idle' | 'testing' | 'ready' | 'blocked' }) {
  return (
    <span className={`application-settings-camera-state ${state}`}>
      {state === 'ready'
        ? 'Camera ready'
        : state === 'blocked'
          ? 'Camera permission blocked'
          : state === 'testing'
            ? 'Checking camera…'
            : 'No camera preview running'}
    </span>
  );
}

function AppearanceSettings({
  onChange,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  preferences: ApplicationPreferences;
}) {
  const themes: { id: ApplicationTheme; label: string; icon: ReactNode; description: string }[] = [
    {
      id: 'midnight',
      label: 'Midnight',
      icon: <Moon size={20} />,
      description: 'The default Scuttlebutt dark theme.',
    },
    {
      id: 'dim',
      label: 'Dim',
      icon: <CircleHalf size={20} />,
      description: 'Softer contrast for longer sessions.',
    },
    {
      id: 'amoled',
      label: 'AMOLED',
      icon: <Sun size={20} />,
      description: 'Deep black surfaces for OLED screens.',
    },
  ];
  return (
    <>
      <SettingsHeader
        eyebrow="Experience"
        title="Appearance"
        description="Change the look and feel of the Scuttlebutt client."
      />
      <section className="application-settings-section">
        <h2>Theme</h2>
        <div className="application-settings-theme-grid">
          {themes.map((theme) => (
            <button
              type="button"
              key={theme.id}
              className={`application-settings-theme-card ${preferences.theme === theme.id ? 'active' : ''}`}
              onClick={() => onChange('theme', theme.id)}
            >
              <span className={`theme-swatch theme-swatch-${theme.id}`}>{theme.icon}</span>
              <strong>{theme.label}</strong>
              <small>{theme.description}</small>
              {preferences.theme === theme.id ? <Check size={16} weight="bold" /> : null}
            </button>
          ))}
        </div>
      </section>
      <section className="application-settings-section">
        <SettingRow
          title="Reduced motion"
          description="Reduce hover movement and animated transitions."
        >
          <Toggle
            checked={preferences.reducedMotion}
            label="Toggle reduced motion"
            onChange={() => onChange('reducedMotion', !preferences.reducedMotion)}
          />
        </SettingRow>
      </section>
    </>
  );
}

function AccessibilitySettings({
  onChange,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  preferences: ApplicationPreferences;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Experience"
        title="Accessibility"
        description="Make messages and controls easier to read and use."
      />
      <section className="application-settings-section">
        <h2>Text readability</h2>
        <label className="application-settings-range-label">
          <span>Text size in chat</span>
          <strong>{preferences.textSize}px</strong>
          <input
            type="range"
            min="12"
            max="20"
            step="2"
            value={preferences.textSize}
            onChange={(event) =>
              onChange('textSize', Number(event.target.value) as ApplicationTextSize)
            }
          />
        </label>
        <div className="application-settings-size-options">
          {([12, 14, 16, 18, 20] as ApplicationTextSize[]).map((size) => (
            <button
              type="button"
              key={size}
              className={preferences.textSize === size ? 'active' : ''}
              onClick={() => onChange('textSize', size)}
            >
              {size}px
            </button>
          ))}
        </div>
      </section>
      <section className="application-settings-section">
        <h2>Visual density</h2>
        <RadioChoice
          checked={preferences.density === 'compact'}
          label="Compact"
          description="Fit more channels and messages on screen."
          onChange={() => onChange('density', 'compact')}
        />
        <RadioChoice
          checked={preferences.density === 'default'}
          label="Default"
          onChange={() => onChange('density', 'default')}
        />
        <RadioChoice
          checked={preferences.density === 'spacious'}
          label="Spacious"
          description="Give messages and controls more breathing room."
          onChange={() => onChange('density', 'spacious')}
        />
      </section>
      <section className="application-settings-section">
        <SettingRow
          title="High contrast mode"
          description="Increase contrast on borders, controls, and text."
        >
          <Toggle
            checked={preferences.highContrast}
            label="Toggle high contrast mode"
            onChange={() => onChange('highContrast', !preferences.highContrast)}
          />
        </SettingRow>
        <SettingRow title="Reduced motion" description="Also available from Appearance.">
          <Toggle
            checked={preferences.reducedMotion}
            label="Toggle reduced motion"
            onChange={() => onChange('reducedMotion', !preferences.reducedMotion)}
          />
        </SettingRow>
      </section>
    </>
  );
}

function LanguageSettings({
  onChange,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  preferences: ApplicationPreferences;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Experience"
        title="Language & Time"
        description="Choose the language and time format used by this browser."
      />
      <section className="application-settings-section">
        <label className="application-settings-field">
          <span>Select a language</span>
          <select
            className="application-settings-select"
            value={preferences.language}
            onChange={(event) =>
              onChange('language', event.target.value as ApplicationPreferences['language'])
            }
          >
            <option value="en-US">English, US</option>
            <option value="en-CA">English, Canada</option>
          </select>
        </label>
        <h2>Time format</h2>
        <RadioChoice
          checked={preferences.timeFormat === 'auto'}
          label="Auto"
          description="Use your browser's locale preference."
          onChange={() => onChange('timeFormat', 'auto')}
        />
        <RadioChoice
          checked={preferences.timeFormat === '12-hour'}
          label="12-hour"
          onChange={() => onChange('timeFormat', '12-hour')}
        />
        <RadioChoice
          checked={preferences.timeFormat === '24-hour'}
          label="24-hour"
          onChange={() => onChange('timeFormat', '24-hour')}
        />
      </section>
    </>
  );
}

function ActivitySettings({
  onChange,
  preferences,
}: {
  onChange: <Key extends keyof ApplicationPreferences>(
    key: Key,
    value: ApplicationPreferences[Key],
  ) => void;
  preferences: ApplicationPreferences;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Games & Apps"
        title="Activity Privacy"
        description="Decide whether friends can see the activity you share while chatting."
      />
      <section className="application-settings-section">
        <SettingRow
          title="Share activity status"
          description="Show supported game and app activity to friends."
        >
          <Toggle
            checked={preferences.shareActivity}
            label="Toggle activity status"
            onChange={() => onChange('shareActivity', !preferences.shareActivity)}
          />
        </SettingRow>
      </section>
      <section className="application-settings-card application-settings-info-card">
        <GameController size={22} />
        <div>
          <strong>Activity integrations are opt-in</strong>
          <p>
            Scuttlebutt does not scan your installed apps. Activity only appears when you connect a
            supported integration.
          </p>
        </div>
      </section>
    </>
  );
}

function ConnectionsSettings() {
  return (
    <>
      <SettingsHeader
        eyebrow="Games & Apps"
        title="Connected Apps"
        description="Manage services that can share activity or add functionality to your groups."
      />
      <section className="application-settings-empty">
        <LinkSimple size={34} />
        <strong>No connected apps</strong>
        <p>When integrations are available, they will appear here for review and removal.</p>
      </section>
    </>
  );
}

function DeveloperSettings() {
  return (
    <>
      <SettingsHeader
        eyebrow="Developer"
        title="Developer"
        description="Tools for testing Scuttlebutt integrations and local deployments."
      />
      <section className="application-settings-section">
        <SettingRow
          title="Environment"
          description="The current Scuttlebutt client is running in a browser."
        >
          <span className="application-settings-chip">
            <Globe size={15} /> Web
          </span>
        </SettingRow>
        <SettingRow
          title="Repository sync"
          description="Hosted message sync is configured separately by the deployment."
        >
          <span className="application-settings-value">Connected repository</span>
        </SettingRow>
      </section>
      <section className="application-settings-card application-settings-info-card">
        <Database size={22} />
        <div>
          <strong>Developer tools are intentionally limited</strong>
          <p>
            Use the repository and deployment logs for backend diagnostics. Client-side settings
            stay in this browser.
          </p>
        </div>
      </section>
    </>
  );
}
