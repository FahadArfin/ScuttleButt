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
} from '@phosphor-icons/react';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

export interface CallParticipant {
  avatar: string;
  identity: string;
  name: string;
}

export function VoicePreviewPanel({
  connected = false,
  onConnectionChange,
  participants = [],
  roomName,
}: {
  connected?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  participants?: CallParticipant[];
  roomName: string;
}) {
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const cameraStream = useRef<MediaStream | undefined>(undefined);
  const shareStream = useRef<MediaStream | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  const stopStream = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());

  useEffect(() => () => {
    stopStream(cameraStream.current);
    stopStream(shareStream.current);
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

  const playSound = (frequency: number) => {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.28);
  };

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
    : [{ identity: 'alex', name: 'Alex Rivers', avatar: '' }];

  return (
    <section
      className="call-stage"
      data-testid={E2E_SELECTORS.voicePanel}
      aria-label={`${roomName} call`}
    >
      <div className={`call-participant-grid call-grid-${Math.min(visibleParticipants.length, 4)}`}>
        {visibleParticipants.map((participant, index) => (
          <article
            className={`call-participant-tile ${index === 0 && !muted ? 'call-participant-speaking' : ''}`}
            key={participant.identity}
          >
            {participant.identity === 'alex' && (cameraEnabled || sharing) ? (
              <video ref={videoRef} autoPlay muted playsInline />
            ) : (
              <img src={participant.avatar} alt="" />
            )}
            <span className="call-participant-name">
              {participant.identity === 'alex' && muted ? <MicrophoneSlash size={14} /> : null}
              {participant.name}
            </span>
            {index === 0 && !muted ? <span className="speaking-label">Speaking</span> : null}
          </article>
        ))}
      </div>

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
        <div className="call-control-popover-wrap">
          <button
            type="button"
            aria-label="Call settings"
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <GearSix size={21} />
            <span>Settings</span>
          </button>
          {settingsOpen ? (
            <div className="call-popover call-settings-popover">
              <strong>Call settings</strong>
              <label>
                Input
                <select defaultValue="default">
                  <option value="default">Default microphone</option>
                </select>
              </label>
              <label>
                Output
                <select defaultValue="default">
                  <option value="default">Default speakers</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
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
    </section>
  );
}
