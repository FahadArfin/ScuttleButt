import { useState } from 'react';

import { LockSimple, ShieldCheck } from '@phosphor-icons/react';
import type { VoiceParticipantSnapshot, VoiceSessionSnapshot } from '@scuttlebutt/livekit-client';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

import { VideoPreviewPanel } from './video-preview.js';

const LOCAL_PARTICIPANT: VoiceParticipantSnapshot = {
  connectionQuality: 'excellent',
  identity: 'alex',
  isSpeaking: false,
  microphoneEnabled: true,
  name: 'Alex Rivers',
};

const INITIAL_PREVIEW: VoiceSessionSnapshot = {
  state: 'disconnected',
  roomName: null,
  localParticipant: LOCAL_PARTICIPANT,
  participants: [],
  muted: false,
  deafened: false,
  inputDeviceId: null,
  outputDeviceId: null,
  e2eeEnabled: true,
  reconnectAttempts: 0,
  error: null,
};

export function VoicePreviewPanel({
  onConnectionChange,
  participants = [],
  roomName,
}: {
  onConnectionChange?: (connected: boolean) => void;
  participants?: Array<{ identity: string; name: string }>;
  roomName: string;
}) {
  const [snapshot, setSnapshot] = useState<VoiceSessionSnapshot>(INITIAL_PREVIEW);
  const isConnected = snapshot.state === 'connected' || snapshot.state === 'reconnecting';

  const joinPreview = () => {
    setSnapshot({
      ...INITIAL_PREVIEW,
      participants: [],
      roomName,
      state: 'connected',
    });
    onConnectionChange?.(true);
  };

  const leavePreview = () => {
    setSnapshot(INITIAL_PREVIEW);
    onConnectionChange?.(false);
  };

  return (
    <section
      className="voice-poc-panel"
      data-testid={E2E_SELECTORS.voicePanel}
      aria-label="Voice room proof of concept"
    >
      <div className="voice-poc-header">
        <div>
          <p className="section-kicker">Voice proof of concept</p>
          <h2>{roomName}</h2>
          <p>{participants.length} connected · encrypted meeting room</p>
        </div>
        <span className={`voice-state-pill voice-state-${snapshot.state}`}>
          <span aria-hidden="true" />
          {snapshot.state === 'disconnected' ? 'Ready to join' : snapshot.state}
        </span>
      </div>
      <div className="voice-poc-boundary" role="status">
        <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
        Preview only. The LiveKit client boundary is ready; real media requires server-issued
        short-lived credentials.
      </div>
      <div className="voice-participant-grid">
        {participants
          .map<VoiceParticipantSnapshot>((participant, index) => ({
            ...participant,
            connectionQuality: index === 0 ? 'excellent' : 'good',
            isSpeaking: index === 0,
            microphoneEnabled: true,
          }))
          .map((participant) => (
            <div
              className={`voice-participant ${participant.isSpeaking ? 'voice-participant-speaking' : ''}`}
              key={participant.identity}
            >
              <span className="voice-participant-avatar">
                {participant.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="voice-participant-copy">
                <strong>{participant.name}</strong>
                <small>
                  {participant.isSpeaking
                    ? 'Speaking now'
                    : participant.microphoneEnabled
                      ? 'Microphone on'
                      : 'Muted'}
                </small>
              </span>
              <span
                className={`quality-dot quality-${participant.connectionQuality}`}
                title={`Connection quality: ${participant.connectionQuality}`}
                aria-label={`Connection quality: ${participant.connectionQuality}`}
              />
            </div>
          ))}
        {participants.length === 0 ? (
          <p className="voice-empty-state">No one is in the room yet.</p>
        ) : null}
      </div>
      <div className="voice-poc-controls">
        {!isConnected ? (
          <button type="button" className="voice-join-button" onClick={joinPreview}>
            Join voice preview
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`voice-control-button ${snapshot.muted ? 'voice-control-active' : ''}`}
              onClick={() => setSnapshot((current) => ({ ...current, muted: !current.muted }))}
              aria-pressed={snapshot.muted}
            >
              {snapshot.muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              type="button"
              className={`voice-control-button ${snapshot.deafened ? 'voice-control-active' : ''}`}
              onClick={() =>
                setSnapshot((current) => ({ ...current, deafened: !current.deafened }))
              }
              aria-pressed={snapshot.deafened}
            >
              {snapshot.deafened ? 'Undeafen' : 'Deafen'}
            </button>
            <label className="voice-device-select">
              <span>Input</span>
              <select defaultValue="default">
                <option value="default">Default microphone</option>
              </select>
            </label>
            <label className="voice-device-select">
              <span>Output</span>
              <select defaultValue="default">
                <option value="default">Default speakers</option>
              </select>
            </label>
            <button type="button" className="voice-leave-button" onClick={leavePreview}>
              Leave
            </button>
          </>
        )}
      </div>
      <div className="voice-poc-footer">
        <span>
          <span className="quality-dot quality-excellent" /> Quality excellent
        </span>
        <span>
          <LockSimple className="voice-lock" size={15} aria-hidden="true" /> Media E2EE configured
        </span>
        <span>
          {snapshot.reconnectAttempts > 0
            ? `Reconnect attempt ${snapshot.reconnectAttempts}`
            : 'TURN fallback ready'}
        </span>
      </div>
      <VideoPreviewPanel roomName={roomName} />
    </section>
  );
}
