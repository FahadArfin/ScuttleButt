import { useRef, useState } from 'react';

import {
  getVideoCaptureAvailability,
  getVideoQualityOptions,
  type VideoCaptureSource,
  type VideoQualityMode,
} from '@scuttlebutt/livekit-client';
import { E2E_SELECTORS } from '@scuttlebutt/testing';

const PREVIEW_STATS = {
  bitrate: '2.5 Mbps',
  codec: 'VP8',
  fps: '30 FPS',
  latency: '42 ms',
  packetLoss: '0.1%',
  resolution: '1920 × 1080',
};

const CAPTURE_SOURCES: Array<{
  label: string;
  source: Exclude<VideoCaptureSource, 'camera'>;
}> = [
  { label: 'Entire screen', source: 'screen' },
  { label: 'Application window', source: 'window' },
  { label: 'Browser tab', source: 'browser-tab' },
];

export function VideoPreviewPanel({ roomName }: { roomName: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [captureSource, setCaptureSource] =
    useState<Exclude<VideoCaptureSource, 'camera'>>('screen');
  const [includeSystemAudio, setIncludeSystemAudio] = useState(false);
  const [quality, setQuality] = useState<VideoQualityMode>('balanced');
  const [fallbackReason, setFallbackReason] = useState<string>();
  const [fullscreen, setFullscreen] = useState(false);
  const availability = getVideoCaptureAvailability();
  const qualityOptions = getVideoQualityOptions();

  const toggleCamera = () => {
    setCameraEnabled((current) => !current);
    setFallbackReason(undefined);
  };

  const toggleScreenShare = () => {
    setScreenShareEnabled((current) => !current);
    setFallbackReason(
      screenShareEnabled && includeSystemAudio
        ? 'System audio support varies by browser and capture surface.'
        : undefined,
    );
  };

  const handleQualityChange = (nextQuality: VideoQualityMode) => {
    const selected = qualityOptions.find(({ mode }) => mode === nextQuality);
    if (!selected?.enabled) {
      setQuality('balanced');
      setFallbackReason(
        selected?.availabilityReason ?? 'This quality mode needs a measured hardware budget.',
      );
      return;
    }
    setQuality(nextQuality);
    setFallbackReason(undefined);
  };

  const toggleFullscreen = async () => {
    if (!stageRef.current) {
      return;
    }
    if (!fullscreen && stageRef.current.requestFullscreen) {
      try {
        await stageRef.current.requestFullscreen();
      } catch {
        setFullscreen(true);
      }
    } else if (fullscreen && document.fullscreenElement) {
      await document.exitFullscreen();
    }
    setFullscreen((current) => !current);
  };

  return (
    <section className="video-poc-panel" data-testid={E2E_SELECTORS.videoPanel}>
      <div className="video-poc-header">
        <div>
          <p className="section-kicker">Phase 7 · video and sharing</p>
          <h3>Camera, screen, and diagnostics</h3>
          <p>Preview surface for {roomName} · starts at 1080p30</p>
        </div>
        <span className="video-poc-status">
          <span className="quality-dot quality-good" /> Preview boundary
        </span>
      </div>

      <div className="video-poc-boundary" role="status">
        <span aria-hidden="true">▣</span>
        Preview only. Real tracks and RTCP statistics appear after the server issues a LiveKit
        token; unsupported high-quality modes stay disabled until measured.
      </div>

      <div className="video-stage" ref={stageRef}>
        <div className={`video-stage-art ${cameraEnabled ? 'video-stage-camera' : ''}`}>
          {cameraEnabled ? (
            <>
              <span className="video-stage-avatar">FA</span>
              <span className="video-stage-label">Your camera preview</span>
            </>
          ) : (
            <>
              <span className="video-stage-icon" aria-hidden="true">
                ◉
              </span>
              <span className="video-stage-label">Camera is off</span>
            </>
          )}
          {screenShareEnabled ? (
            <span className="video-share-badge">Sharing {captureSource.replace('-', ' ')}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="video-fullscreen-button"
          onClick={() => void toggleFullscreen()}
          aria-pressed={fullscreen}
        >
          {fullscreen ? 'Exit fullscreen' : 'Fullscreen viewer'}
        </button>
      </div>

      <div className="video-poc-controls">
        <button
          type="button"
          className={`video-control-button ${cameraEnabled ? 'video-control-active' : ''}`}
          onClick={toggleCamera}
          disabled={!availability.camera}
          aria-pressed={cameraEnabled}
        >
          {cameraEnabled ? 'Stop camera preview' : 'Start camera preview'}
        </button>
        <button
          type="button"
          className={`video-control-button ${screenShareEnabled ? 'video-control-active' : ''}`}
          onClick={toggleScreenShare}
          disabled={!availability.screen}
          aria-pressed={screenShareEnabled}
        >
          {screenShareEnabled ? 'Stop sharing' : 'Share screen'}
        </button>
        <label className="video-select-control">
          <span>Quality</span>
          <select
            aria-label="Video quality"
            value={quality}
            onChange={(event) => handleQualityChange(event.target.value as VideoQualityMode)}
          >
            {qualityOptions.map((option) => (
              <option key={option.mode} value={option.mode} disabled={!option.enabled}>
                {option.label}
                {!option.enabled ? ' · measurement required' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="video-select-control">
          <span>Capture</span>
          <select
            aria-label="Screen capture source"
            value={captureSource}
            onChange={(event) =>
              setCaptureSource(event.target.value as Exclude<VideoCaptureSource, 'camera'>)
            }
            disabled={!availability.screen}
          >
            {CAPTURE_SOURCES.map(({ label, source }) => (
              <option key={source} value={source}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="video-audio-toggle">
          <input
            type="checkbox"
            checked={includeSystemAudio}
            onChange={(event) => setIncludeSystemAudio(event.target.checked)}
            disabled={availability.systemAudio === 'unsupported'}
          />
          System audio
        </label>
      </div>

      {fallbackReason ? (
        <p className="video-fallback-note" role="status">
          <strong>Quality fallback:</strong> {fallbackReason}
        </p>
      ) : null}

      <div className="video-diagnostics" data-testid={E2E_SELECTORS.videoDiagnostics}>
        <div className="video-diagnostics-heading">
          <div>
            <p className="section-kicker">Diagnostics</p>
            <h4>Sample stream metrics</h4>
          </div>
          <span>Live values use WebRTC sender/receiver stats</span>
        </div>
        <div className="video-stat-grid">
          <div>
            <strong>{PREVIEW_STATS.resolution}</strong>
            <span>Resolution</span>
          </div>
          <div>
            <strong>{PREVIEW_STATS.fps}</strong>
            <span>Frame rate</span>
          </div>
          <div>
            <strong>{PREVIEW_STATS.codec}</strong>
            <span>Codec</span>
          </div>
          <div>
            <strong>{PREVIEW_STATS.bitrate}</strong>
            <span>Bitrate</span>
          </div>
          <div>
            <strong>{PREVIEW_STATS.packetLoss}</strong>
            <span>Packet loss</span>
          </div>
          <div>
            <strong>{PREVIEW_STATS.latency}</strong>
            <span>Round trip</span>
          </div>
        </div>
      </div>

      <div className="video-poc-footer">
        <span>
          <span className="quality-dot quality-good" /> Adaptive subscriptions on
        </span>
        <span>
          <span className="quality-dot quality-good" /> Camera simulcast configured
        </span>
        <span>
          {availability.systemAudio === 'unknown'
            ? 'System audio support varies by browser'
            : 'System audio unavailable in this browser'}
        </span>
      </div>
    </section>
  );
}
