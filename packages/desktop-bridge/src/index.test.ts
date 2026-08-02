import { describe, expect, it } from 'vitest';

import {
  createDesktopBridge,
  isAllowedDeepLink,
  normalizeDeepLink,
  PUSH_TO_TALK_ACCELERATOR,
  validateDesktopSession,
} from './index.js';

const session = {
  homeserverUrl: 'https://matrix.example.test',
  accessToken: 'opaque-access-token',
  userId: '@fahad:example.test',
  deviceId: 'SCUTTLEBUTT-DESKTOP',
};

describe('desktop bridge contracts', () => {
  it('validates the Matrix session shape without altering opaque credentials', () => {
    expect(validateDesktopSession(session)).toEqual(session);
  });

  it('rejects malformed or non-HTTPS session endpoints', () => {
    expect(() => validateDesktopSession({ ...session, homeserverUrl: 'file:///session' })).toThrow(
      'HTTP or HTTPS',
    );
    expect(() => validateDesktopSession({ ...session, accessToken: '' })).toThrow('access token');
  });

  it('accepts only structured Scuttlebutt deep links', () => {
    expect(isAllowedDeepLink('scuttlebutt://login?code=opaque')).toBe(true);
    expect(normalizeDeepLink('scuttlebutt://open/room/abc')).toBe('scuttlebutt://open/room/abc');
    expect(isAllowedDeepLink('https://example.test/open')).toBe(false);
    expect(isAllowedDeepLink('scuttlebutt://login#token=secret')).toBe(false);
    expect(isAllowedDeepLink('scuttlebutt://unknown/path')).toBe(false);
  });

  it('keeps push-to-talk on one approved accelerator', () => {
    expect(PUSH_TO_TALK_ACCELERATOR).toBe('CommandOrControl+Shift+Space');
  });

  it('keeps browser builds free of native side effects', async () => {
    const bridge = createDesktopBridge();
    expect(bridge.runtime).toBe('web');
    await expect(bridge.getDiagnostics()).resolves.toMatchObject({
      runtime: 'web',
      secureStorage: 'unavailable',
      globalShortcut: false,
      deepLinks: false,
    });
    await expect(bridge.onPushToTalk(() => undefined)).resolves.toEqual(expect.any(Function));
  });
});
