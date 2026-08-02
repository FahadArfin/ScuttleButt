import {
  ConnectionState,
  ExternalE2EEKeyProvider,
  Room,
  RoomEvent,
  type Participant,
  type RoomOptions,
} from 'livekit-client';

export type VoiceConnectionState =
  'connected' | 'connecting' | 'disconnected' | 'failed' | 'reconnecting';
export type VoiceConnectionQuality = 'excellent' | 'good' | 'lost' | 'poor' | 'unknown';

export interface VoiceRoomCredentials {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  e2eeKey?: string;
  iceServers?: RTCIceServer[];
}

export interface VoiceParticipantSnapshot {
  identity: string;
  name: string;
  isSpeaking: boolean;
  microphoneEnabled: boolean;
  connectionQuality: VoiceConnectionQuality;
}

export interface VoiceSessionSnapshot {
  state: VoiceConnectionState;
  roomName: string | null;
  localParticipant: VoiceParticipantSnapshot | null;
  participants: VoiceParticipantSnapshot[];
  muted: boolean;
  deafened: boolean;
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  e2eeEnabled: boolean;
  reconnectAttempts: number;
  error: string | null;
}

export interface VoiceClientOptions {
  createRoom?: (options?: RoomOptions) => Room;
  createE2EEWorker?: () => Worker;
  requireE2EE?: boolean;
}

export interface JwtClaims {
  exp?: number;
  sub?: string;
  video?: { room?: string };
}

const INITIAL_SNAPSHOT: VoiceSessionSnapshot = {
  state: 'disconnected',
  roomName: null,
  localParticipant: null,
  participants: [],
  muted: false,
  deafened: false,
  inputDeviceId: null,
  outputDeviceId: null,
  e2eeEnabled: false,
  reconnectAttempts: 0,
  error: null,
};

function cloneSnapshot(snapshot: VoiceSessionSnapshot): VoiceSessionSnapshot {
  return {
    ...snapshot,
    localParticipant: snapshot.localParticipant ? { ...snapshot.localParticipant } : null,
    participants: snapshot.participants.map((participant) => ({ ...participant })),
  };
}

function decodeBase64Url(value: string): string {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  if (typeof atob === 'function') {
    return atob(normalized);
  }
  throw new Error('The current runtime cannot decode a LiveKit token.');
}

export function decodeJwtClaims(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('The LiveKit participant token is malformed.');
  }

  try {
    const claims: unknown = JSON.parse(decodeBase64Url(parts[1]));
    if (!claims || typeof claims !== 'object') {
      throw new Error('The LiveKit participant token has invalid claims.');
    }
    return claims as JwtClaims;
  } catch {
    throw new Error('The LiveKit participant token has invalid claims.');
  }
}

export function normalizeVoiceServerUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('A LiveKit server URL is required.');
  }
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error('The LiveKit server URL must use ws:// or wss://.');
  }
  return normalized;
}

export function assertUsableVoiceCredentials(
  credentials: VoiceRoomCredentials,
  nowMs = Date.now(),
): VoiceRoomCredentials {
  const serverUrl = normalizeVoiceServerUrl(credentials.serverUrl);
  const roomName = credentials.roomName.trim();
  if (!roomName) {
    throw new Error('A LiveKit room name is required.');
  }
  if (!credentials.participantToken.trim()) {
    throw new Error('A LiveKit participant token is required.');
  }

  const claims = decodeJwtClaims(credentials.participantToken);
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) {
    throw new Error('The LiveKit participant token has expired.');
  }

  return { ...credentials, roomName, serverUrl };
}

function qualityForParticipant(participant: Participant): VoiceConnectionQuality {
  const quality = participant.connectionQuality;
  return quality === 'excellent' || quality === 'good' || quality === 'poor' || quality === 'lost'
    ? quality
    : 'unknown';
}

function snapshotForParticipant(
  participant: Participant,
  activeSpeakerIds: Set<string>,
): VoiceParticipantSnapshot {
  return {
    connectionQuality: qualityForParticipant(participant),
    identity: participant.identity,
    isSpeaking: activeSpeakerIds.has(participant.identity),
    microphoneEnabled: participant.isMicrophoneEnabled,
    name: participant.name?.trim() || participant.identity,
  };
}

export class VoiceClient {
  private readonly createRoom: (options?: RoomOptions) => Room;
  private readonly createE2EEWorker: (() => Worker) | undefined;
  private readonly requireE2EE: boolean;
  private readonly subscribers = new Set<(snapshot: VoiceSessionSnapshot) => void>();
  private readonly activeSpeakerIds = new Set<string>();
  private room: Room | null = null;
  private snapshot: VoiceSessionSnapshot = cloneSnapshot(INITIAL_SNAPSHOT);

  public constructor(options: VoiceClientOptions = {}) {
    this.createRoom = options.createRoom ?? ((roomOptions) => new Room(roomOptions));
    this.createE2EEWorker = options.createE2EEWorker;
    this.requireE2EE = options.requireE2EE ?? true;
  }

  getSnapshot(): VoiceSessionSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  onSnapshot(listener: (snapshot: VoiceSessionSnapshot) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getSnapshot());
    return () => this.subscribers.delete(listener);
  }

  async join(credentials: VoiceRoomCredentials): Promise<void> {
    const usableCredentials = assertUsableVoiceCredentials(credentials);
    if (this.requireE2EE && !usableCredentials.e2eeKey) {
      throw new Error('Voice E2EE is required, but no room key was provided.');
    }
    if (this.snapshot.state !== 'disconnected') {
      await this.leave();
    }

    const keyProvider = usableCredentials.e2eeKey ? new ExternalE2EEKeyProvider() : undefined;
    if (keyProvider && !this.createE2EEWorker) {
      throw new Error('Voice E2EE requires a dedicated LiveKit encryption worker.');
    }
    if (keyProvider && this.createE2EEWorker) {
      await keyProvider.setKey(usableCredentials.e2eeKey as string);
    }

    const room = this.createRoom({
      adaptiveStream: true,
      dynacast: true,
      ...(keyProvider && this.createE2EEWorker
        ? { encryption: { keyProvider, worker: this.createE2EEWorker() } }
        : {}),
    });
    this.room = room;
    this.bindRoomEvents(room);
    this.updateSnapshot({
      e2eeEnabled: Boolean(keyProvider),
      error: null,
      reconnectAttempts: 0,
      roomName: usableCredentials.roomName,
      state: 'connecting',
    });

    try {
      await room.connect(usableCredentials.serverUrl, usableCredentials.participantToken, {
        autoSubscribe: true,
        rtcConfig: usableCredentials.iceServers
          ? { iceServers: usableCredentials.iceServers }
          : undefined,
      });
      await room.localParticipant.setMicrophoneEnabled(true);
      this.updateSnapshot({
        state: 'connected',
        localParticipant: snapshotForParticipant(room.localParticipant, this.activeSpeakerIds),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LiveKit connection failed.';
      this.updateSnapshot({ error: message, state: 'failed' });
      await room.disconnect();
      this.room = null;
      throw new Error(message, { cause: error });
    }
  }

  async leave(): Promise<void> {
    if (this.room) {
      this.unbindRoomEvents(this.room);
      await this.room.disconnect();
    }
    this.room = null;
    this.activeSpeakerIds.clear();
    this.snapshot = cloneSnapshot(INITIAL_SNAPSHOT);
    this.emitSnapshot();
  }

  async setMuted(muted: boolean): Promise<void> {
    const room = this.requireRoom();
    await room.localParticipant.setMicrophoneEnabled(!muted);
    this.updateSnapshot({ muted });
  }

  async setDeafened(deafened: boolean): Promise<void> {
    const room = this.requireRoom();
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        publication.setSubscribed(!deafened);
      }
    }
    this.updateSnapshot({ deafened });
  }

  async listDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
    return Room.getLocalDevices(kind, kind === 'audioinput');
  }

  async setInputDevice(deviceId: string): Promise<boolean> {
    const room = this.requireRoom();
    const switched = await room.switchActiveDevice('audioinput', deviceId, true);
    if (switched) {
      this.updateSnapshot({ inputDeviceId: deviceId });
    }
    return switched;
  }

  async setOutputDevice(deviceId: string): Promise<boolean> {
    const room = this.requireRoom();
    const switched = await room.switchActiveDevice('audiooutput', deviceId, true);
    if (switched) {
      this.updateSnapshot({ outputDeviceId: deviceId });
    }
    return switched;
  }

  async startAudio(): Promise<void> {
    await this.requireRoom().startAudio();
  }

  private requireRoom(): Room {
    if (
      !this.room ||
      (this.snapshot.state !== 'connected' && this.snapshot.state !== 'reconnecting')
    ) {
      throw new Error('The voice room is not connected.');
    }
    return this.room;
  }

  private updateSnapshot(update: Partial<VoiceSessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...update };
    this.refreshParticipants();
    this.emitSnapshot();
  }

  private refreshParticipants(): void {
    if (!this.room) {
      return;
    }
    const localParticipant = snapshotForParticipant(
      this.room.localParticipant,
      this.activeSpeakerIds,
    );
    const participants = [...this.room.remoteParticipants.values()]
      .map((participant) => snapshotForParticipant(participant, this.activeSpeakerIds))
      .sort((left, right) => left.name.localeCompare(right.name));
    this.snapshot = { ...this.snapshot, localParticipant, participants };
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private readonly handleConnected = () => this.updateSnapshot({ state: 'connected', error: null });

  private readonly handleReconnecting = () =>
    this.updateSnapshot({
      reconnectAttempts: this.snapshot.reconnectAttempts + 1,
      state: 'reconnecting',
    });

  private readonly handleReconnected = () =>
    this.updateSnapshot({ state: 'connected', error: null });

  private readonly handleDisconnected = () => this.updateSnapshot({ state: 'disconnected' });

  private readonly handleConnectionStateChanged = (state: ConnectionState) => {
    if (state === ConnectionState.Connecting) {
      this.updateSnapshot({ state: 'connecting' });
    } else if (state === ConnectionState.Connected) {
      this.updateSnapshot({ state: 'connected' });
    } else if (
      state === ConnectionState.Reconnecting ||
      state === ConnectionState.SignalReconnecting
    ) {
      this.updateSnapshot({ state: 'reconnecting' });
    } else {
      this.updateSnapshot({ state: 'disconnected' });
    }
  };

  private readonly handleActiveSpeakers = (speakers: Participant[]) => {
    this.activeSpeakerIds.clear();
    for (const speaker of speakers) {
      this.activeSpeakerIds.add(speaker.identity);
    }
    this.updateSnapshot({});
  };

  private readonly handleQualityChanged = () => this.updateSnapshot({});

  private bindRoomEvents(room: Room): void {
    room.on(RoomEvent.Connected, this.handleConnected);
    room.on(RoomEvent.Reconnecting, this.handleReconnecting);
    room.on(RoomEvent.Reconnected, this.handleReconnected);
    room.on(RoomEvent.Disconnected, this.handleDisconnected);
    room.on(RoomEvent.ConnectionStateChanged, this.handleConnectionStateChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakers);
    room.on(RoomEvent.ConnectionQualityChanged, this.handleQualityChanged);
    room.on(RoomEvent.ParticipantConnected, this.handleQualityChanged);
    room.on(RoomEvent.ParticipantDisconnected, this.handleQualityChanged);
    room.on(RoomEvent.TrackMuted, this.handleQualityChanged);
    room.on(RoomEvent.TrackUnmuted, this.handleQualityChanged);
  }

  private unbindRoomEvents(room: Room): void {
    room.off(RoomEvent.Connected, this.handleConnected);
    room.off(RoomEvent.Reconnecting, this.handleReconnecting);
    room.off(RoomEvent.Reconnected, this.handleReconnected);
    room.off(RoomEvent.Disconnected, this.handleDisconnected);
    room.off(RoomEvent.ConnectionStateChanged, this.handleConnectionStateChanged);
    room.off(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakers);
    room.off(RoomEvent.ConnectionQualityChanged, this.handleQualityChanged);
    room.off(RoomEvent.ParticipantConnected, this.handleQualityChanged);
    room.off(RoomEvent.ParticipantDisconnected, this.handleQualityChanged);
    room.off(RoomEvent.TrackMuted, this.handleQualityChanged);
    room.off(RoomEvent.TrackUnmuted, this.handleQualityChanged);
  }
}
