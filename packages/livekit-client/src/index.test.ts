import { describe, expect, it } from 'vitest';

import { assertUsableVoiceCredentials, decodeJwtClaims, normalizeVoiceServerUrl } from './index.js';

function tokenWithExpiry(exp: number): string {
  const payload = btoa(JSON.stringify({ exp, sub: 'fahad', video: { room: 'northstar-huddle' } }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${payload}.signature`;
}

describe('LiveKit voice boundary', () => {
  it('requires websocket URLs and decodes claims without logging token material', () => {
    expect(normalizeVoiceServerUrl(' ws://localhost:7880/// ')).toBe('ws://localhost:7880');
    expect(decodeJwtClaims(tokenWithExpiry(2_000_000_000)).video?.room).toBe('northstar-huddle');
    expect(() => normalizeVoiceServerUrl('http://localhost:7880')).toThrow('ws:// or wss://');
  });

  it('rejects expired or malformed short-lived access tokens', () => {
    expect(() =>
      assertUsableVoiceCredentials(
        {
          participantToken: tokenWithExpiry(100),
          roomName: 'northstar-huddle',
          serverUrl: 'ws://localhost:7880',
        },
        101_000,
      ),
    ).toThrow('expired');
    expect(() =>
      assertUsableVoiceCredentials({
        participantToken: 'not-a-jwt',
        roomName: 'northstar-huddle',
        serverUrl: 'ws://localhost:7880',
      }),
    ).toThrow('malformed');
  });

  it('normalizes valid credentials while preserving the opaque token', () => {
    const participantToken = tokenWithExpiry(2_000_000_000);
    expect(
      assertUsableVoiceCredentials(
        {
          participantToken,
          roomName: ' northstar-huddle ',
          serverUrl: 'ws://localhost:7880///',
        },
        1_000,
      ),
    ).toEqual({
      participantToken,
      roomName: 'northstar-huddle',
      serverUrl: 'ws://localhost:7880',
    });
  });
});
