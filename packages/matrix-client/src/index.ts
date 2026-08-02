import * as sdk from 'matrix-js-sdk';
import {
  ClientEvent,
  EventType,
  Preset,
  SyncState,
  type ICreateRoomOpts,
  type MatrixClient,
  type MatrixEvent,
} from 'matrix-js-sdk';

export interface MatrixSession {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
}

export interface MatrixDevice {
  deviceId: string;
  displayName: string | null;
  lastSeenIp: string | null;
  lastSeenTs: number | null;
}

export interface MatrixClientOptions {
  homeserverUrl: string;
  enableEncryption?: boolean;
}

export interface RegisterInput {
  username: string;
  password: string;
  deviceDisplayName?: string;
}

export interface LoginInput {
  username: string;
  password: string;
  deviceId?: string;
  deviceDisplayName?: string;
}

export interface DeviceRevocationCredentials {
  username: string;
  password: string;
}

export interface DirectRoomInput {
  inviteeUserId: string;
  name?: string;
}

export const MATRIX_ENCRYPTION_ALGORITHM = 'm.megolm.v1.aes-sha2' as const;

export function normalizeHomeserverUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');

  if (!normalized) {
    throw new Error('A Matrix homeserver URL is required.');
  }

  return normalized;
}

export function createEncryptedRoomOptions(input: DirectRoomInput): ICreateRoomOpts {
  return {
    invite: [input.inviteeUserId],
    is_direct: true,
    name: input.name,
    preset: Preset.TrustedPrivateChat,
    initial_state: [
      {
        type: EventType.RoomEncryption,
        state_key: '',
        content: {
          algorithm: MATRIX_ENCRYPTION_ALGORITHM,
        },
      },
    ],
  };
}

function requireSessionCredentials(
  homeserverUrl: string,
  response: {
    access_token?: string;
    device_id?: string;
    user_id: string;
  },
): MatrixSession {
  if (!response.access_token || !response.device_id) {
    throw new Error('The homeserver did not return a usable Matrix session.');
  }

  return {
    homeserverUrl,
    accessToken: response.access_token,
    userId: response.user_id,
    deviceId: response.device_id,
  };
}

function createSdkClient(session: MatrixSession): MatrixClient {
  return sdk.createClient({
    baseUrl: session.homeserverUrl,
    accessToken: session.accessToken,
    deviceId: session.deviceId,
    timelineSupport: true,
    userId: session.userId,
  });
}

export class ScuttlebuttMatrixClient {
  private readonly client: MatrixClient;
  private readonly enableEncryption: boolean;
  private isStarted = false;

  private constructor(
    private readonly session: MatrixSession,
    options: MatrixClientOptions,
  ) {
    this.client = createSdkClient(session);
    this.enableEncryption = options.enableEncryption ?? true;
  }

  static async register(
    options: MatrixClientOptions,
    input: RegisterInput,
  ): Promise<{ client: ScuttlebuttMatrixClient; session: MatrixSession }> {
    const homeserverUrl = normalizeHomeserverUrl(options.homeserverUrl);
    const registrationClient = sdk.createClient({ baseUrl: homeserverUrl });
    const response = await registrationClient.registerRequest({
      auth: { type: 'm.login.dummy' },
      initial_device_display_name: input.deviceDisplayName ?? 'Scuttlebutt',
      password: input.password,
      username: input.username,
    });
    registrationClient.stopClient();

    const session = requireSessionCredentials(homeserverUrl, response);
    const client = new ScuttlebuttMatrixClient(session, options);
    await client.initialize();
    return { client, session };
  }

  static async login(
    options: MatrixClientOptions,
    input: LoginInput,
  ): Promise<{ client: ScuttlebuttMatrixClient; session: MatrixSession }> {
    const homeserverUrl = normalizeHomeserverUrl(options.homeserverUrl);
    const loginClient = sdk.createClient({ baseUrl: homeserverUrl });
    const response = await loginClient.loginRequest({
      device_id: input.deviceId,
      identifier: { type: 'm.id.user', user: input.username },
      initial_device_display_name: input.deviceDisplayName ?? 'Scuttlebutt',
      password: input.password,
      type: 'm.login.password',
    });
    loginClient.stopClient();

    const session = requireSessionCredentials(homeserverUrl, response);
    const client = new ScuttlebuttMatrixClient(session, options);
    await client.initialize();
    return { client, session };
  }

  static async restore(
    session: MatrixSession,
    options: Omit<MatrixClientOptions, 'homeserverUrl'> = {},
  ): Promise<ScuttlebuttMatrixClient> {
    const restoredSession = {
      ...session,
      homeserverUrl: normalizeHomeserverUrl(session.homeserverUrl),
    };
    const client = new ScuttlebuttMatrixClient(restoredSession, {
      ...options,
      homeserverUrl: restoredSession.homeserverUrl,
    });
    await client.initialize();
    return client;
  }

  getSession(): MatrixSession {
    return { ...this.session };
  }

  getRawClient(): MatrixClient {
    return this.client;
  }

  async logout(): Promise<void> {
    await this.client.logout(true);
    this.client.stopClient();
    this.isStarted = false;
  }

  async stop(): Promise<void> {
    this.client.stopClient();
    this.isStarted = false;
  }

  async listDevices(): Promise<MatrixDevice[]> {
    const response = await this.client.getDevices();
    return response.devices.map((device) => ({
      deviceId: device.device_id,
      displayName: device.display_name ?? null,
      lastSeenIp: device.last_seen_ip ?? null,
      lastSeenTs: device.last_seen_ts ?? null,
    }));
  }

  async revokeDevice(deviceId: string, credentials: DeviceRevocationCredentials): Promise<void> {
    await this.client.deleteDevice(deviceId, {
      identifier: { type: 'm.id.user', user: credentials.username },
      password: credentials.password,
      type: 'm.login.password',
    });
  }

  async createEncryptedDirectRoom(input: DirectRoomInput): Promise<string> {
    const response = await this.client.createRoom(createEncryptedRoomOptions(input));
    return response.room_id;
  }

  async joinRoom(roomId: string): Promise<void> {
    await this.client.joinRoom(roomId);
  }

  async sendText(roomId: string, body: string): Promise<string> {
    const response = await this.client.sendTextMessage(roomId, body);
    return response.event_id;
  }

  getRoomEvents(roomId: string): MatrixEvent[] {
    return this.client.getRoom(roomId)?.getLiveTimeline().getEvents() ?? [];
  }

  private async initialize(): Promise<void> {
    if (this.enableEncryption) {
      await this.client.initRustCrypto({ useIndexedDB: false });
    }

    await this.start();
  }

  private async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onSync = (state: SyncState) => {
        if (state === SyncState.Prepared) {
          this.client.off(ClientEvent.Sync, onSync);
          this.isStarted = true;
          resolve();
        } else if (state === SyncState.Error) {
          this.client.off(ClientEvent.Sync, onSync);
          reject(new Error('Matrix initial sync failed.'));
        }
      };

      this.client.on(ClientEvent.Sync, onSync);
      void this.client.startClient({ initialSyncLimit: 20 }).catch((error) => {
        this.client.off(ClientEvent.Sync, onSync);
        reject(error);
      });
    });
  }
}
