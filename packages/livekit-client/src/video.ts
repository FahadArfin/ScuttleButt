import {
  ScreenSharePresets,
  Track,
  VideoPresets,
  VideoQuality,
  type Room,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  type VideoCaptureOptions,
  type VideoReceiverStats,
  type VideoSenderStats,
} from 'livekit-client';

export type VideoQualityMode = 'data-saver' | 'balanced' | 'smooth' | 'sharp' | 'ultra';
export type VideoCaptureSource = 'camera' | 'screen' | 'window' | 'browser-tab';
export type VideoTrackSource = 'camera' | 'screen-share' | 'unknown';

export interface VideoQualityProfile {
  mode: VideoQualityMode;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
}

export interface VideoQualityOption extends VideoQualityProfile {
  enabled: boolean;
  availabilityReason?: string;
}

export interface VideoCapabilityBudget {
  maxWidth: number;
  maxHeight: number;
  maxFrameRate: number;
}

export const DEFAULT_VIDEO_CAPABILITY_BUDGET: VideoCapabilityBudget = {
  maxWidth: 1920,
  maxHeight: 1080,
  maxFrameRate: 30,
};

export const VIDEO_QUALITY_PROFILES: readonly VideoQualityProfile[] = [
  {
    mode: 'data-saver',
    label: 'Data saver · 720p30',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 1_500_000,
  },
  {
    mode: 'balanced',
    label: 'Balanced · 1080p30',
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 2_500_000,
  },
  {
    mode: 'smooth',
    label: 'Smooth · 1080p60',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 4_000_000,
  },
  {
    mode: 'sharp',
    label: 'Sharp · 1440p30',
    width: 2560,
    height: 1440,
    frameRate: 30,
    maxBitrate: 5_000_000,
  },
  {
    mode: 'ultra',
    label: 'Ultra · 4K60',
    width: 3840,
    height: 2160,
    frameRate: 60,
    maxBitrate: 8_000_000,
  },
];

const QUALITY_ORDER: readonly VideoQualityMode[] = VIDEO_QUALITY_PROFILES.map(({ mode }) => mode);

export interface VideoCaptureAvailability {
  camera: boolean;
  screen: boolean;
  window: boolean;
  browserTab: boolean;
  systemAudio: 'supported' | 'unsupported' | 'unknown';
}

export interface ScreenShareRequest {
  source?: Exclude<VideoCaptureSource, 'camera'>;
  includeSystemAudio?: boolean;
  quality?: VideoQualityMode;
}

export interface VideoCaptureResult {
  requestedQuality: VideoQualityMode;
  activeQuality: VideoQualityMode;
  fellBack: boolean;
  fallbackReason?: string;
}

export interface ScreenShareResult {
  source: Exclude<VideoCaptureSource, 'camera'>;
  systemAudioRequested: boolean;
  systemAudioEnabled: boolean;
  fellBackToVideoOnly: boolean;
}

export interface VideoSessionState {
  cameraEnabled: boolean;
  cameraQuality: VideoQualityMode | null;
  screenShareEnabled: boolean;
  screenShareSource: Exclude<VideoCaptureSource, 'camera'> | null;
  systemAudioEnabled: boolean;
  fallbackReason: string | null;
}

export interface VideoTrackDescriptor {
  participantIdentity: string;
  source: VideoTrackSource;
  trackSid: string;
  isLocal: boolean;
  isSubscribed: boolean;
  isMuted: boolean;
  width: number | null;
  height: number | null;
}

export interface VideoDiagnostics {
  participantIdentity: string;
  source: VideoTrackSource;
  direction: 'inbound' | 'outbound';
  width: number | null;
  height: number | null;
  framesPerSecond: number | null;
  codec: string | null;
  bitrateKbps: number | null;
  packetsLost: number | null;
  packetLossPercent: number | null;
  roundTripTimeMs: number | null;
  qualityLimitationReason: string | null;
  timestamp: number;
}

interface PreviousVideoSample {
  timestamp: number;
  bytes: number | null;
  frames: number | null;
}

const INITIAL_VIDEO_STATE: VideoSessionState = {
  cameraEnabled: false,
  cameraQuality: null,
  screenShareEnabled: false,
  screenShareSource: null,
  systemAudioEnabled: false,
  fallbackReason: null,
};

function cloneVideoState(state: VideoSessionState): VideoSessionState {
  return { ...state };
}

function profileFor(mode: VideoQualityMode): VideoQualityProfile {
  const profile = VIDEO_QUALITY_PROFILES.find((candidate) => candidate.mode === mode);
  if (!profile) {
    throw new Error(`Unsupported video quality mode: ${mode}`);
  }
  return profile;
}

function liveKitQualityFor(mode: VideoQualityMode): VideoQuality {
  if (mode === 'data-saver') {
    return VideoQuality.LOW;
  }
  if (mode === 'balanced') {
    return VideoQuality.MEDIUM;
  }
  return VideoQuality.HIGH;
}

function qualityLayersFor(mode: VideoQualityMode) {
  if (mode === 'data-saver') {
    return [VideoPresets.h360];
  }
  if (mode === 'balanced' || mode === 'smooth') {
    return [VideoPresets.h360, VideoPresets.h540];
  }
  return [VideoPresets.h540, VideoPresets.h720];
}

function screenSurfaceFor(
  source: Exclude<VideoCaptureSource, 'camera'>,
): 'window' | 'browser' | 'monitor' {
  if (source === 'window') {
    return 'window';
  }
  if (source === 'browser-tab') {
    return 'browser';
  }
  return 'monitor';
}

function isOptionalSystemAudioFailure(error: unknown): boolean {
  if (
    error instanceof DOMException &&
    ['NotSupportedError', 'OverconstrainedError'].includes(error.name)
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('system audio') || message.includes('audio capture');
}

function sourceForTrack(source: Track.Source): VideoTrackSource {
  if (source === Track.Source.Camera) {
    return 'camera';
  }
  if (source === Track.Source.ScreenShare) {
    return 'screen-share';
  }
  return 'unknown';
}

function captureOptionsFor(mode: VideoQualityMode): VideoCaptureOptions {
  const profile = profileFor(mode);
  return {
    frameRate: profile.frameRate,
    resolution: {
      width: profile.width,
      height: profile.height,
      frameRate: profile.frameRate,
    },
  };
}

export function createCameraCaptureOptions(mode: VideoQualityMode): VideoCaptureOptions {
  return captureOptionsFor(mode);
}

export function createCameraPublishOptions(mode: VideoQualityMode): TrackPublishOptions {
  const profile = profileFor(mode);
  return {
    degradationPreference: 'maintain-framerate',
    simulcast: true,
    source: Track.Source.Camera,
    videoEncoding: {
      maxBitrate: profile.maxBitrate,
      maxFramerate: profile.frameRate,
    },
    videoSimulcastLayers: qualityLayersFor(mode),
  };
}

export function createScreenShareCaptureOptions(
  request: ScreenShareRequest = {},
): ScreenShareCaptureOptions {
  const source = request.source ?? 'screen';
  const includeSystemAudio = request.includeSystemAudio ?? false;
  const profile = profileFor(request.quality ?? 'balanced');
  return {
    audio: includeSystemAudio,
    contentHint: source === 'screen' ? 'detail' : 'text',
    resolution: {
      width: profile.width,
      height: profile.height,
      frameRate: Math.min(profile.frameRate, 30),
    },
    selfBrowserSurface: source === 'browser-tab' ? 'include' : 'exclude',
    surfaceSwitching: 'include',
    systemAudio: includeSystemAudio ? 'include' : 'exclude',
    video: { displaySurface: screenSurfaceFor(source) },
  };
}

export function createScreenSharePublishOptions(mode: VideoQualityMode): TrackPublishOptions {
  const profile = profileFor(mode);
  return {
    degradationPreference: 'maintain-resolution',
    screenShareEncoding: {
      maxBitrate: profile.maxBitrate,
      maxFramerate: Math.min(profile.frameRate, 30),
    },
    screenShareSimulcastLayers: [ScreenSharePresets.h360fps15, ScreenSharePresets.h720fps15],
    simulcast: true,
    source: Track.Source.ScreenShare,
  };
}

export function getVideoQualityOptions(
  budget: VideoCapabilityBudget = DEFAULT_VIDEO_CAPABILITY_BUDGET,
): VideoQualityOption[] {
  return VIDEO_QUALITY_PROFILES.map((profile) => {
    const enabled =
      profile.width <= budget.maxWidth &&
      profile.height <= budget.maxHeight &&
      profile.frameRate <= budget.maxFrameRate;
    return {
      ...profile,
      enabled,
      availabilityReason: enabled
        ? undefined
        : `Requires up to ${profile.width}×${profile.height} at ${profile.frameRate} FPS; this device budget is ${budget.maxWidth}×${budget.maxHeight} at ${budget.maxFrameRate} FPS.`,
    };
  });
}

export function getVideoQualityProfile(mode: VideoQualityMode): VideoQualityProfile {
  return { ...profileFor(mode) };
}

export function getQualityFallbackChain(mode: VideoQualityMode): VideoQualityMode[] {
  const index = QUALITY_ORDER.indexOf(mode);
  return [...QUALITY_ORDER.slice(0, index + 1)].reverse();
}

export function getNextLowerVideoQuality(mode: VideoQualityMode): VideoQualityMode | null {
  const index = QUALITY_ORDER.indexOf(mode);
  return index > 0 ? (QUALITY_ORDER[index - 1] ?? null) : null;
}

export function getVideoCaptureAvailability(): VideoCaptureAvailability {
  const mediaDevices = globalThis.navigator?.mediaDevices;
  const camera = typeof mediaDevices?.getUserMedia === 'function';
  const screen = typeof mediaDevices?.getDisplayMedia === 'function';
  return {
    browserTab: screen,
    camera,
    screen,
    systemAudio: screen ? 'unknown' : 'unsupported',
    window: screen,
  };
}

export class VideoClient {
  private readonly getRoom: () => Room | null;
  private readonly capabilityBudget: VideoCapabilityBudget;
  private readonly subscribers = new Set<(state: VideoSessionState) => void>();
  private readonly previousSamples = new Map<string, PreviousVideoSample>();
  private state: VideoSessionState = cloneVideoState(INITIAL_VIDEO_STATE);

  public constructor(options: {
    getRoom: () => Room | null;
    capabilityBudget?: VideoCapabilityBudget;
  }) {
    this.getRoom = options.getRoom;
    this.capabilityBudget = options.capabilityBudget ?? DEFAULT_VIDEO_CAPABILITY_BUDGET;
  }

  public getState(): VideoSessionState {
    return cloneVideoState(this.state);
  }

  public onState(listener: (state: VideoSessionState) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => this.subscribers.delete(listener);
  }

  public async setCameraEnabled(
    enabled: boolean,
    requestedQuality: VideoQualityMode = 'balanced',
  ): Promise<VideoCaptureResult | null> {
    const room = this.requireRoom();
    if (!enabled) {
      await room.localParticipant.setCameraEnabled(false);
      this.updateState({ cameraEnabled: false, cameraQuality: null, fallbackReason: null });
      return null;
    }

    const supportedModes = new Set(
      getVideoQualityOptions(this.capabilityBudget)
        .filter(({ enabled: optionEnabled }) => optionEnabled)
        .map(({ mode }) => mode),
    );
    const attempts = getQualityFallbackChain(requestedQuality).filter((mode) =>
      supportedModes.has(mode),
    );
    const fallbackReason =
      attempts[0] !== requestedQuality
        ? 'Requested mode exceeds the current device budget.'
        : undefined;
    let lastError: unknown;

    for (const mode of attempts) {
      try {
        await room.localParticipant.setCameraEnabled(
          true,
          createCameraCaptureOptions(mode),
          createCameraPublishOptions(mode),
        );
        this.updateState({
          cameraEnabled: true,
          cameraQuality: mode,
          fallbackReason: fallbackReason ?? null,
        });
        return {
          activeQuality: mode,
          fellBack: mode !== requestedQuality || Boolean(fallbackReason),
          fallbackReason,
          requestedQuality,
        };
      } catch (error) {
        lastError = error;
      }
    }

    const message = lastError instanceof Error ? lastError.message : 'Camera capture failed.';
    this.updateState({ cameraEnabled: false, cameraQuality: null, fallbackReason: message });
    throw new Error(message, { cause: lastError });
  }

  public async setCameraQuality(requestedQuality: VideoQualityMode): Promise<VideoCaptureResult> {
    return (await this.setCameraEnabled(true, requestedQuality)) as VideoCaptureResult;
  }

  public async setScreenShareEnabled(
    enabled: boolean,
    request: ScreenShareRequest = {},
  ): Promise<ScreenShareResult | null> {
    const room = this.requireRoom();
    const source = request.source ?? 'screen';
    const includeSystemAudio = request.includeSystemAudio ?? false;
    const quality = request.quality ?? 'balanced';

    if (!enabled) {
      await room.localParticipant.setScreenShareEnabled(false);
      this.updateState({
        screenShareEnabled: false,
        screenShareSource: null,
        systemAudioEnabled: false,
      });
      return null;
    }

    try {
      await room.localParticipant.setScreenShareEnabled(
        true,
        createScreenShareCaptureOptions({ ...request, source, quality }),
        createScreenSharePublishOptions(quality),
      );
      this.updateState({
        screenShareEnabled: true,
        screenShareSource: source,
        systemAudioEnabled: includeSystemAudio,
        fallbackReason: null,
      });
      return {
        fellBackToVideoOnly: false,
        source,
        systemAudioEnabled: includeSystemAudio,
        systemAudioRequested: includeSystemAudio,
      };
    } catch (error) {
      if (!includeSystemAudio || !isOptionalSystemAudioFailure(error)) {
        throw error;
      }
      await room.localParticipant.setScreenShareEnabled(
        true,
        createScreenShareCaptureOptions({ ...request, includeSystemAudio: false, source, quality }),
        createScreenSharePublishOptions(quality),
      );
      this.updateState({
        fallbackReason:
          'System audio is unavailable in this browser; screen video continued without it.',
        screenShareEnabled: true,
        screenShareSource: source,
        systemAudioEnabled: false,
      });
      return {
        fellBackToVideoOnly: true,
        source,
        systemAudioEnabled: false,
        systemAudioRequested: true,
      };
    }
  }

  public setRemoteVideoQuality(participantIdentity: string, mode: VideoQualityMode): number {
    const participant = this.requireRoom().remoteParticipants.get(participantIdentity);
    if (!participant) {
      throw new Error(`Remote participant ${participantIdentity} is not in this room.`);
    }
    const quality = liveKitQualityFor(mode);
    let updated = 0;
    for (const publication of participant.videoTrackPublications.values()) {
      publication.setVideoQuality(quality);
      updated += 1;
    }
    return updated;
  }

  public setRemoteVideoEnabled(participantIdentity: string, enabled: boolean): number {
    const participant = this.requireRoom().remoteParticipants.get(participantIdentity);
    if (!participant) {
      throw new Error(`Remote participant ${participantIdentity} is not in this room.`);
    }
    let updated = 0;
    for (const publication of participant.videoTrackPublications.values()) {
      publication.setEnabled(enabled);
      updated += 1;
    }
    return updated;
  }

  public getVideoTracks(): VideoTrackDescriptor[] {
    const room = this.requireRoom();
    const tracks: VideoTrackDescriptor[] = [];
    for (const publication of room.localParticipant.videoTrackPublications.values()) {
      tracks.push({
        height: publication.dimensions?.height ?? null,
        isLocal: true,
        isMuted: publication.isMuted,
        isSubscribed: true,
        participantIdentity: room.localParticipant.identity,
        source: sourceForTrack(publication.source),
        trackSid: publication.trackSid,
        width: publication.dimensions?.width ?? null,
      });
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.videoTrackPublications.values()) {
        tracks.push({
          height: publication.dimensions?.height ?? null,
          isLocal: false,
          isMuted: publication.isMuted,
          isSubscribed: publication.isSubscribed,
          participantIdentity: participant.identity,
          source: sourceForTrack(publication.source),
          trackSid: publication.trackSid,
          width: publication.dimensions?.width ?? null,
        });
      }
    }
    return tracks;
  }

  public attachVideoTrack(
    participantIdentity: string,
    source: VideoTrackSource,
    element: HTMLVideoElement,
  ): () => void {
    const room = this.requireRoom();
    const publication = this.findVideoPublication(room, participantIdentity, source);
    if (!publication?.videoTrack) {
      throw new Error('The requested video track is not subscribed yet.');
    }
    publication.videoTrack.attach(element);
    return () => publication.videoTrack?.detach(element);
  }

  public async getVideoDiagnostics(): Promise<VideoDiagnostics[]> {
    const room = this.requireRoom();
    const diagnostics: VideoDiagnostics[] = [];
    for (const publication of room.localParticipant.videoTrackPublications.values()) {
      const track = publication.videoTrack;
      if (!track || !('getSenderStats' in track)) {
        continue;
      }
      const stats = await track.getSenderStats();
      for (const sample of stats) {
        diagnostics.push(
          this.senderDiagnostics(room.localParticipant.identity, publication, sample),
        );
      }
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.videoTrackPublications.values()) {
        const track = publication.videoTrack;
        if (!track || !('getReceiverStats' in track)) {
          continue;
        }
        const sample = await track.getReceiverStats();
        if (sample) {
          diagnostics.push(this.receiverDiagnostics(participant.identity, publication, sample));
        }
      }
    }
    return diagnostics;
  }

  private findVideoPublication(room: Room, identity: string, source: VideoTrackSource) {
    const publications =
      identity === room.localParticipant.identity
        ? room.localParticipant.videoTrackPublications.values()
        : (room.remoteParticipants.get(identity)?.videoTrackPublications.values() ?? []);
    for (const publication of publications) {
      if (sourceForTrack(publication.source) === source) {
        return publication;
      }
    }
    return undefined;
  }

  private senderDiagnostics(
    identity: string,
    publication: { mimeType?: string; source: Track.Source; trackSid: string },
    sample: VideoSenderStats,
  ): VideoDiagnostics {
    const rates = this.ratesFor(
      `outbound:${identity}:${publication.trackSid}:${sample.rid}`,
      sample.timestamp,
      sample.bytesSent,
      sample.framesSent,
    );
    return {
      bitrateKbps: rates.bitrateKbps,
      codec: publication.mimeType?.replace(/^video\//i, '').toUpperCase() ?? null,
      direction: 'outbound',
      framesPerSecond: sample.framesPerSecond || rates.framesPerSecond,
      height: sample.frameHeight || null,
      packetLossPercent: packetLossPercent(sample.packetsLost, sample.packetsSent),
      packetsLost: sample.packetsLost ?? null,
      participantIdentity: identity,
      qualityLimitationReason: sample.qualityLimitationReason ?? null,
      roundTripTimeMs: sample.roundTripTime != null ? sample.roundTripTime * 1000 : null,
      source: sourceForTrack(publication.source),
      timestamp: sample.timestamp,
      width: sample.frameWidth || null,
    };
  }

  private receiverDiagnostics(
    identity: string,
    publication: { mimeType?: string; source: Track.Source; trackSid: string },
    sample: VideoReceiverStats,
  ): VideoDiagnostics {
    const rates = this.ratesFor(
      `inbound:${identity}:${publication.trackSid}`,
      sample.timestamp,
      sample.bytesReceived,
      sample.framesReceived,
    );
    return {
      bitrateKbps: rates.bitrateKbps,
      codec:
        sample.mimeType?.replace(/^video\//i, '').toUpperCase() ??
        publication.mimeType?.replace(/^video\//i, '').toUpperCase() ??
        null,
      direction: 'inbound',
      framesPerSecond: rates.framesPerSecond,
      height: sample.frameHeight ?? null,
      packetLossPercent: packetLossPercent(sample.packetsLost, sample.packetsReceived),
      packetsLost: sample.packetsLost ?? null,
      participantIdentity: identity,
      qualityLimitationReason: null,
      roundTripTimeMs: null,
      source: sourceForTrack(publication.source),
      timestamp: sample.timestamp,
      width: sample.frameWidth ?? null,
    };
  }

  private ratesFor(
    key: string,
    timestamp: number,
    bytes: number | undefined,
    frames: number | undefined,
  ): { bitrateKbps: number | null; framesPerSecond: number | null } {
    const previous = this.previousSamples.get(key);
    const elapsedMs = previous ? timestamp - previous.timestamp : 0;
    const bitrateKbps =
      previous && elapsedMs > 0 && bytes != null && previous.bytes != null
        ? Math.max(0, Math.round(((bytes - previous.bytes) * 8) / elapsedMs))
        : null;
    const framesPerSecond =
      previous && elapsedMs > 0 && frames != null && previous.frames != null
        ? Math.max(0, Math.round(((frames - previous.frames) * 1000) / elapsedMs))
        : null;
    this.previousSamples.set(key, { bytes: bytes ?? null, frames: frames ?? null, timestamp });
    return { bitrateKbps, framesPerSecond };
  }

  private requireRoom(): Room {
    const room = this.getRoom();
    if (!room || (room.state !== 'connected' && room.state !== 'reconnecting')) {
      throw new Error('The media room is not connected.');
    }
    return room;
  }

  private updateState(update: Partial<VideoSessionState>): void {
    this.state = { ...this.state, ...update };
    const snapshot = this.getState();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }
}

function packetLossPercent(lost?: number, receivedOrSent?: number): number | null {
  if (lost == null || receivedOrSent == null || lost + receivedOrSent <= 0) {
    return null;
  }
  return Number(((lost / (lost + receivedOrSent)) * 100).toFixed(2));
}
