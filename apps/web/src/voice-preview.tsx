import { useState } from 'react';

import type { VoiceParticipantSnapshot, VoiceSessionSnapshot } from '@scuttlebutt/livekit-client';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

const LOCAL_PARTICIPANT: VoiceParticipantSnapshot = {
  connectionQuality: 'excellent',
  identity: 'fahad',
  isSpeaking: false,
  microphoneEnabled: true,
  name: 'Fahad Arfin',
};

const DEMO_PARTICIPANTS: VoiceParticipantSnapshot[] = [
  {
    connectionQuality: 'excellent',
    identity: 'jordan',
    isSpeaking: true,
    microphoneEnabled: true,
    name: 'Jordan Lee',
  },
  {
    connectionQuality: 'good',
    identity: 'maya',
    isSpeaking: false,
    microphoneEnabled: true,
    name: 'Maya Chen',
  },
];

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

export function VoicePreviewPanel({ roomName }: { roomName: string }) {
  const [snapshot, setSnapshot] = useState<VoiceSessionSnapshot>(INITIAL_PREVIEW);
  const isConnected = snapshot.state === 'connected' || snapshot.state === 'reconnecting';

  const joinPreview = () => {
    setSnapshot({
      ...INITIAL_PREVIEW,
      participants: DEMO_PARTICIPANTS,
      roomName,
      state: 'connected',
    });
  };

  const leavePreview = () => {
    setSnapshot(INITIAL_PREVIEW);
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
          <h2>Huddle</h2>
          <p>Three-person local room preview · {roomName}</p>
        </div>
        <span className={`voice-state-pill voice-state-${snapshot.state}`}>
          <span aria-hidden="true" />
          {snapshot.state === 'disconnected' ? 'Ready to join' : snapshot.state}
        </span>
      </div>
      <div className="voice-poc-boundary" role="status">
        <span aria-hidden="true">▣</span>
        Preview only. The LiveKit client boundary is ready; real media requires server-issued
        short-lived credentials.
      </div>
      <div className="voice-participant-grid">
        {[snapshot.localParticipant, ...snapshot.participants]
          .filter((participant): participant is VoiceParticipantSnapshot => participant !== null)
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
        {snapshot.participants.length === 0 ? (
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
          <span className="voice-lock" aria-hidden="true">
            ⌑
          </span>{' '}
          Media E2EE configured
        </span>
        <span>
          {snapshot.reconnectAttempts > 0
            ? `Reconnect attempt ${snapshot.reconnectAttempts}`
            : 'TURN fallback ready'}
        </span>
      </div>
    </section>
  );
}
