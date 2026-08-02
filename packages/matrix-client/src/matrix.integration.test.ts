import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventType } from 'matrix-js-sdk';

import { ScuttlebuttMatrixClient, type MatrixSession } from './index.js';

const shouldRun = process.env.SCUTTLEBUTT_RUN_MATRIX_INTEGRATION === '1';
const run = shouldRun ? describe : describe.skip;
const homeserverUrl = process.env.SCUTTLEBUTT_MATRIX_URL ?? 'http://127.0.0.1:8008';
const composeFile = resolve(
  fileURLToPath(new URL('../../../infrastructure/matrix/docker-compose.yml', import.meta.url)),
);

async function waitForHomeserver(): Promise<void> {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${homeserverUrl}/_matrix/client/versions`);
      if (response.ok) {
        return;
      }
    } catch {
      // The container may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Matrix homeserver did not become ready at ${homeserverUrl}.`);
}

async function waitForDecryptedMessage(
  client: ScuttlebuttMatrixClient,
  roomId: string,
  marker: string,
): Promise<void> {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const found = client.getRoomEvents(roomId).some((event) => {
      const content = event.getContent<{ body?: string }>();
      return event.getType() === EventType.RoomMessage && content.body === marker;
    });

    if (found) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('The encrypted message was not decrypted by the second client.');
}

async function getWireEvents(
  session: MatrixSession,
  roomId: string,
): Promise<Array<{ event_id: string; type: string; content: unknown }>> {
  const response = await fetch(
    `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    },
  );

  expect(response.ok).toBe(true);
  const body = (await response.json()) as {
    chunk: Array<{ event_id: string; type: string; content: unknown }>;
  };
  return body.chunk;
}

async function stopClient(client: ScuttlebuttMatrixClient | undefined): Promise<void> {
  await client?.stop();
}

run('local Matrix phase 2 flow', () => {
  let alice: ScuttlebuttMatrixClient | undefined;
  let bob: ScuttlebuttMatrixClient | undefined;
  let secondaryAlice: ScuttlebuttMatrixClient | undefined;
  let aliceSession: MatrixSession;
  let aliceUsername: string;
  let alicePassword: string;

  beforeAll(async () => {
    await waitForHomeserver();
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    aliceUsername = `alice_${suffix}`;
    alicePassword = `phase2-alice-${suffix}`;
    const bobUsername = `bob_${suffix}`;
    const bobPassword = `phase2-bob-${suffix}`;

    const aliceResult = await ScuttlebuttMatrixClient.register(
      { enableEncryption: true, homeserverUrl },
      { deviceDisplayName: 'Alice Phase 2', password: alicePassword, username: aliceUsername },
    );
    const bobResult = await ScuttlebuttMatrixClient.register(
      { enableEncryption: true, homeserverUrl },
      { deviceDisplayName: 'Bob Phase 2', password: bobPassword, username: bobUsername },
    );

    alice = aliceResult.client;
    bob = bobResult.client;
    aliceSession = aliceResult.session;
  });

  afterAll(async () => {
    await stopClient(alice);
    await stopClient(bob);
    await stopClient(secondaryAlice);
  });

  it('registers, restores and logs out sessions, manages devices, and exchanges ciphertext', async () => {
    expect(alice).toBeDefined();
    expect(bob).toBeDefined();

    await alice?.stop();
    const restored = await ScuttlebuttMatrixClient.restore(aliceSession, {
      enableEncryption: false,
    });
    expect(restored.getSession()).toEqual(aliceSession);
    await restored.logout();

    const loggedOutResponse = await fetch(`${homeserverUrl}/_matrix/client/v3/devices`, {
      headers: { Authorization: `Bearer ${aliceSession.accessToken}` },
    });
    expect(loggedOutResponse.status).toBe(401);

    const aliceLogin = await ScuttlebuttMatrixClient.login(
      { enableEncryption: true, homeserverUrl },
      {
        deviceDisplayName: 'Alice Re-login',
        password: alicePassword,
        username: aliceUsername,
      },
    );
    alice = aliceLogin.client;

    secondaryAlice = (
      await ScuttlebuttMatrixClient.login(
        { enableEncryption: false, homeserverUrl },
        {
          deviceDisplayName: 'Alice Secondary',
          password: alicePassword,
          username: aliceUsername,
        },
      )
    ).client;

    const devices = await alice.listDevices();
    const secondaryDevice = devices.find(
      (device) => device.deviceId !== alice?.getSession().deviceId,
    );
    expect(secondaryDevice).toBeDefined();
    await alice.revokeDevice(secondaryDevice?.deviceId ?? '', {
      password: alicePassword,
      username: aliceUsername,
    });
    expect(
      (await alice.listDevices()).some((device) => device.deviceId === secondaryDevice?.deviceId),
    ).toBe(false);

    const roomId = await alice.createEncryptedDirectRoom({
      inviteeUserId: bob?.getSession().userId ?? '',
      name: 'Phase 2 encrypted DM',
    });
    await bob?.joinRoom(roomId);

    const marker = `scuttlebutt-phase2-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const eventId = await alice.sendText(roomId, marker);
    await waitForDecryptedMessage(bob as ScuttlebuttMatrixClient, roomId, marker);

    const wireEvent = (await getWireEvents(alice.getSession(), roomId)).find(
      (event) => event.event_id === eventId,
    );
    expect(wireEvent?.type).toBe(EventType.RoomMessageEncrypted);
    expect(JSON.stringify(wireEvent?.content)).not.toContain(marker);

    const sql = `SELECT COUNT(*) FROM event_json WHERE json::text LIKE '%${marker}%';`;
    const databaseMatches = execFileSync(
      'docker',
      [
        'compose',
        '-f',
        composeFile,
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'synapse',
        '-d',
        'synapse',
        '-tA',
        '-c',
        sql,
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(databaseMatches).toBe('0');
  });
});
