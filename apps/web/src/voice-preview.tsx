import { useEffect, useRef, useState } from 'react';

import {
  Confetti,
  GearSix,
  Microphone,
  MicrophoneSlash,
  MonitorArrowUp,
  PhoneDisconnect,
  ShieldCheck,
  VideoCamera,
  VideoCameraSlash,
  X,
} from '@phosphor-icons/react';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

import { VoiceActivityDetector } from './voice-activity.js';

export interface CallParticipant {
  avatar: string;
  identity: string;
  isSpeaking?: boolean;
  name: string;
}

export type VoiceQuickAction = 'camera' | 'settings' | 'share' | 'soundboard';
export const VOICE_QUICK_ACTION_EVENT = 'scuttlebutt:voice-quick-action';

type InputMode = 'push-to-talk' | 'voice-activity';
type InputProfile = 'custom' | 'isolation' | 'studio';

interface VoiceSettings {
  inputDeviceId: string;
  inputMode: InputMode;
  inputProfile: InputProfile;
  inputVolume: number;
  outputDeviceId: string;
  outputVolume: number;
  sensitivity: number;
}

const VOICE_SETTINGS_KEY = 'scuttlebutt:voice-settings';
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  inputDeviceId: 'default',
  inputMode: 'voice-activity',
  inputProfile: 'isolation',
  inputVolume: 100,
  outputDeviceId: 'default',
  outputVolume: 80,
  sensitivity: 0.055,
};

function loadVoiceSettings(): VoiceSettings {
  try {
    return {
      ...DEFAULT_VOICE_SETTINGS,
      ...(JSON.parse(localStorage.getItem(VOICE_SETTINGS_KEY) ?? '{}') as Partial<VoiceSettings>),
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

function stopStream(stream?: MediaStream): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function VoicePreviewPanel({
  connected = false,
  localUser,
  onConnectionChange,
  onSpeakingChange,
  participants = [],
  roomName,
}: {
  connected?: boolean;
  localUser: CallParticipant;
  onConnectionChange?: (connected: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  participants?: CallParticipant[];
  roomName: string;
}) {
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [voiceSettings, setVoiceSettings] = useState(loadVoiceSettings);
  const [audioLevel, setAudioLevel] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const cameraStream = useRef<MediaStream | undefined>(undefined);
  const shareStream = useRef<MediaStream | undefined>(undefined);
  const microphoneStream = useRef<MediaStream | undefined>(undefined);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const animationFrame = useRef<number | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const speakingRef = useRef(false);
  const pushToTalkActiveRef = useRef(false);
  const activityDetector = useRef(new VoiceActivityDetector());

  const setSpeaking = (speaking: boolean) => {
    if (speakingRef.current === speaking) return;
    speakingRef.current = speaking;
    setLocalSpeaking(speaking);
    onSpeakingChange?.(speaking);
  };

  useEffect(() => {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  useEffect(() => {
    if (!connected) return;
    let active = true;

    const startMicrophone = async () => {
      try {
        const isolation = voiceSettings.inputProfile !== 'studio';
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: isolation,
            deviceId:
              voiceSettings.inputDeviceId === 'default'
                ? undefined
                : { exact: voiceSettings.inputDeviceId },
            echoCancellation: isolation,
            noiseSuppression: isolation,
          },
          video: false,
        });
        if (!active) {
          stopStream(stream);
          return;
        }
        microphoneStream.current = stream;
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.35;
        context.createMediaStreamSource(stream).connect(analyser);
        audioContext.current = context;
        setDevices(await navigator.mediaDevices.enumerateDevices());
        const samples = new Float32Array(analyser.fftSize);

        const sample = () => {
          if (!active) return;
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const value of samples) sum += value * value;
          const rms = Math.sqrt(sum / samples.length) * (voiceSettings.inputVolume / 100);
          setAudioLevel(Math.min(1, rms * 5));
          const inputOpen =
            voiceSettings.inputMode === 'voice-activity' || pushToTalkActiveRef.current;
          setSpeaking(
            activityDetector.current.update(
              rms,
              voiceSettings.sensitivity,
              !muted && inputOpen,
              Date.now(),
            ),
          );
          const track = stream.getAudioTracks()[0];
          if (track) track.enabled = !muted && inputOpen;
          animationFrame.current = requestAnimationFrame(sample);
        };
        sample();
      } catch {
        setMediaError('Microphone permission is required for voice activity detection.');
        setSpeaking(false);
      }
    };

    void startMicrophone();
    return () => {
      active = false;
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      stopStream(microphoneStream.current);
      microphoneStream.current = undefined;
      void audioContext.current?.close();
      audioContext.current = undefined;
      setSpeaking(false);
      activityDetector.current.reset();
    };
  }, [
    connected,
    muted,
    voiceSettings.inputDeviceId,
    voiceSettings.inputMode,
    voiceSettings.inputProfile,
    voiceSettings.inputVolume,
    voiceSettings.sensitivity,
  ]);

  useEffect(() => {
    if (!connected || voiceSettings.inputMode !== 'push-to-talk') return;
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      pushToTalkActiveRef.current = true;
      setPushToTalkActive(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      pushToTalkActiveRef.current = false;
      setPushToTalkActive(false);
      setSpeaking(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      pushToTalkActiveRef.current = false;
      setPushToTalkActive(false);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [connected, voiceSettings.inputMode]);

  useEffect(() => () => {
    stopStream(cameraStream.current);
    stopStream(shareStream.current);
    stopStream(microphoneStream.current);
  });

  const attachVideo = (stream?: MediaStream) => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  };

  const toggleCamera = async () => {
    setMediaError('');
    if (cameraEnabled) {
      stopStream(cameraStream.current);
      cameraStream.current = undefined;
      setCameraEnabled(false);
      attachVideo(sharing ? shareStream.current : undefined);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStream.current = stream;
      setCameraEnabled(true);
      if (!sharing) attachVideo(stream);
    } catch {
      setMediaError('Camera permission was not granted.');
    }
  };

  const toggleShare = async () => {
    setMediaError('');
    if (sharing) {
      stopStream(shareStream.current);
      shareStream.current = undefined;
      setSharing(false);
      attachVideo(cameraEnabled ? cameraStream.current : undefined);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      shareStream.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        shareStream.current = undefined;
        setSharing(false);
        attachVideo(cameraStream.current);
      });
      setSharing(true);
      attachVideo(stream);
    } catch {
      setMediaError('Screen sharing was cancelled.');
    }
  };

  useEffect(() => {
    attachVideo(sharing ? shareStream.current : cameraEnabled ? cameraStream.current : undefined);
  }, [cameraEnabled, sharing]);

  const playSound = (frequency: number) => {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.28);
  };

  useEffect(() => {
    const handleQuickAction = (event: Event) => {
      const action = (event as CustomEvent<VoiceQuickAction>).detail;
      if (action === 'camera') void toggleCamera();
      if (action === 'share') void toggleShare();
      if (action === 'soundboard') setSoundboardOpen((value) => !value);
      if (action === 'settings') setSettingsOpen(true);
    };
    window.addEventListener(VOICE_QUICK_ACTION_EVENT, handleQuickAction);
    return () => window.removeEventListener(VOICE_QUICK_ACTION_EVENT, handleQuickAction);
  });

  if (!connected) {
    return (
      <section className="call-empty-state" data-testid={E2E_SELECTORS.voicePanel}>
        <ShieldCheck size={34} weight="duotone" />
        <h2>{roomName}</h2>
        <p>Join the encrypted voice room to talk, use video, or share your screen.</p>
        <button type="button" onClick={() => onConnectionChange?.(true)}>
          Join voice
        </button>
      </section>
    );
  }

  const visibleParticipants = participants.length
    ? participants
    : [{ ...localUser, isSpeaking: localSpeaking }];

  return (
    <section
      className="call-stage"
      data-testid={E2E_SELECTORS.voicePanel}
      aria-label={`${roomName} call`}
    >
      <div className={`call-participant-grid call-grid-${Math.min(visibleParticipants.length, 4)}`}>
        {visibleParticipants.map((participant) => {
          const speaking =
            participant.identity === localUser.identity ? localSpeaking : Boolean(participant.isSpeaking);
          return (
            <article
              className={`call-participant-tile ${speaking ? 'call-participant-speaking' : ''}`}
              key={participant.identity}
            >
              {participant.identity === localUser.identity && (cameraEnabled || sharing) ? (
                <video ref={videoRef} autoPlay muted playsInline />
              ) : (
                <img src={participant.avatar} alt="" />
              )}
              <span className="call-participant-name">
                {participant.identity === localUser.identity && muted ? <MicrophoneSlash size={14} /> : null}
                {participant.name}
              </span>
              {speaking ? <span className="speaking-label">Speaking</span> : null}
            </article>
          );
        })}
      </div>

      {voiceSettings.inputMode === 'push-to-talk' ? (
        <p className={`push-to-talk-hint ${pushToTalkActive ? 'push-to-talk-active' : ''}`}>
          Hold Space to talk
        </p>
      ) : null}
      {mediaError ? (
        <p className="call-media-error" role="status">
          {mediaError}
        </p>
      ) : null}

      <div className="call-control-dock" aria-label="Call controls">
        <button
          type="button"
          className={muted ? 'call-control-active' : ''}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? (
            <MicrophoneSlash size={21} weight="fill" />
          ) : (
            <Microphone size={21} weight="fill" />
          )}
          <span>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button
          type="button"
          className={cameraEnabled ? 'call-control-selected' : ''}
          aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          aria-pressed={cameraEnabled}
          onClick={() => void toggleCamera()}
        >
          {cameraEnabled ? <VideoCamera size={21} weight="fill" /> : <VideoCameraSlash size={21} />}
          <span>Camera</span>
        </button>
        <button
          type="button"
          className={sharing ? 'call-control-selected' : ''}
          aria-label={sharing ? 'Stop sharing' : 'Share screen or application'}
          aria-pressed={sharing}
          onClick={() => void toggleShare()}
        >
          <MonitorArrowUp size={21} />
          <span>Share</span>
        </button>
        <div className="call-control-popover-wrap">
          <button
            type="button"
            aria-label="Open soundboard"
            aria-pressed={soundboardOpen}
            onClick={() => setSoundboardOpen((value) => !value)}
          >
            <Confetti size={21} />
            <span>Soundboard</span>
          </button>
          {soundboardOpen ? (
            <div className="call-popover soundboard-popover">
              <strong>Soundboard</strong>
              <button type="button" onClick={() => playSound(523)}>
                Chime
              </button>
              <button type="button" onClick={() => playSound(784)}>
                Celebrate
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Call settings"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          <GearSix size={21} />
          <span>Settings</span>
        </button>
        <button
          type="button"
          className="call-leave-control"
          aria-label="Leave call"
          onClick={() => onConnectionChange?.(false)}
        >
          <PhoneDisconnect size={22} weight="fill" />
          <span>Leave</span>
        </button>
      </div>

      {settingsOpen ? (
        <VoiceSettingsDialog
          audioLevel={audioLevel}
          devices={devices}
          onChange={setVoiceSettings}
          onClose={() => setSettingsOpen(false)}
          settings={voiceSettings}
        />
      ) : null}
    </section>
  );
}

function VoiceSettingsDialog({
  audioLevel,
  devices,
  onChange,
  onClose,
  settings,
}: {
  audioLevel: number;
  devices: MediaDeviceInfo[];
  onChange: (settings: VoiceSettings) => void;
  onClose: () => void;
  settings: VoiceSettings;
}) {
  const inputs = devices.filter(({ kind }) => kind === 'audioinput');
  const outputs = devices.filter(({ kind }) => kind === 'audiooutput');
  const update = <Key extends keyof VoiceSettings>(key: Key, value: VoiceSettings[Key]) =>
    onChange({ ...settings, [key]: value });
  return (
    <div className="voice-settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="voice-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="section-kicker">Settings</p>
            <h2 id="voice-settings-title">Voice</h2>
          </div>
          <button type="button" aria-label="Close voice settings" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="voice-device-grid">
          <label>
            <span>Microphone</span>
            <select
              value={settings.inputDeviceId}
              onChange={(event) => update('inputDeviceId', event.target.value)}
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
              value={settings.outputDeviceId}
              onChange={(event) => update('outputDeviceId', event.target.value)}
            >
              <option value="default">System default speaker</option>
              {outputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Speaker'}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Microphone volume</span>
            <input
              type="range"
              min="25"
              max="150"
              value={settings.inputVolume}
              onChange={(event) => update('inputVolume', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Speaker volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.outputVolume}
              onChange={(event) => update('outputVolume', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="mic-test-row">
          <strong>Mic test</strong>
          <div className="mic-level-track">
            <span style={{ width: `${Math.round(audioLevel * 100)}%` }} />
          </div>
          <small>{audioLevel > 0.08 ? 'Voice detected' : 'Listening…'}</small>
        </div>
        <div className="voice-settings-section">
          <h3>Input profile</h3>
          {(
            [
              [
                'isolation',
                'Voice isolation',
                'Browser echo cancellation, noise suppression, and automatic gain.',
              ],
              ['studio', 'Studio', 'Unprocessed microphone audio for quiet rooms and music.'],
              ['custom', 'Custom', 'Voice processing with adjustable sensitivity.'],
            ] as const
          ).map(([value, title, description]) => (
            <label className="voice-profile-option" key={value}>
              <input
                type="radio"
                name="input-profile"
                value={value}
                checked={settings.inputProfile === value}
                onChange={() => update('inputProfile', value)}
              />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="voice-settings-section">
          <h3>Input mode</h3>
          <div className="input-mode-toggle">
            <button
              type="button"
              className={settings.inputMode === 'voice-activity' ? 'active' : ''}
              onClick={() => update('inputMode', 'voice-activity')}
            >
              Automatic
            </button>
            <button
              type="button"
              className={settings.inputMode === 'push-to-talk' ? 'active' : ''}
              onClick={() => update('inputMode', 'push-to-talk')}
            >
              Push to talk
            </button>
          </div>
          <p>
            {settings.inputMode === 'push-to-talk'
              ? 'Hold Space while the call is focused. Typing in chat will not trigger it.'
              : 'Your profile highlights only after actual voice activity crosses the threshold.'}
          </p>
        </div>
        <label className="sensitivity-control">
          <span>
            <strong>Voice activity sensitivity</strong>
            <small>Higher values ignore more background noise.</small>
          </span>
          <input
            type="range"
            min="0.015"
            max="0.18"
            step="0.005"
            value={settings.sensitivity}
            onChange={(event) => update('sensitivity', Number(event.target.value))}
          />
        </label>
      </section>
    </div>
  );
}
