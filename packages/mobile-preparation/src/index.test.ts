import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BACKGROUND_CALL_POLICY,
  MOBILE_ARCHITECTURE_DECISION,
  MOBILE_BANDWIDTH_PROFILES,
  createMobileKeyStoragePlan,
  createMobileSyncRequest,
  createPrivacySafePushPayload,
  decideBackgroundCall,
  evaluateDeviceVerification,
  parseMobileDeepLink,
  resolveMobileBandwidthMode,
} from './index.js';

describe('shared contracts and push privacy', () => {
  it('bounds mobile sync requests and emits push payloads without message previews', () => {
    expect(createMobileSyncRequest({ deviceId: 'device-1' })).toEqual({
      deviceId: 'device-1',
      timeoutMs: 25_000,
      limit: 50,
    });
    expect(
      createPrivacySafePushPayload({ eventKind: 'message', eventId: 'event-1' }),
    ).toMatchObject({
      title: 'New message',
      body: 'Open Scuttlebutt to view it.',
      messagePreviewIncluded: false,
      contentAvailable: true,
    });
    expect(() => createMobileSyncRequest({ deviceId: 'device-1', limit: 101 })).toThrow(
      'between 1 and 100',
    );
  });
});

describe('mobile key storage and device verification', () => {
  it('requires OS-protected storage and explicit encrypted recovery actions', () => {
    expect(createMobileKeyStoragePlan('ios')).toMatchObject({
      backend: 'ios-keychain',
      hardwareBackedPreferred: true,
      privateKeysSync: 'never',
      allowUnencryptedBackup: false,
    });
    expect(createMobileKeyStoragePlan('android')).toMatchObject({ backend: 'android-keystore' });
  });

  it('requires two devices, a non-expired transaction, and user confirmation', () => {
    const request = {
      transactionId: 'verify-1',
      localDeviceId: 'device-a',
      remoteDeviceId: 'device-b',
      method: 'sas' as const,
      expiresAt: '2026-08-03T00:00:00.000Z',
      userConfirmed: true,
    };
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    expect(evaluateDeviceVerification(request, now)).toEqual({ allowed: true });
    expect(evaluateDeviceVerification({ ...request, userConfirmed: false }, now)).toMatchObject({
      allowed: false,
      reason: 'user-confirmation-required',
    });
    expect(
      evaluateDeviceVerification({ ...request, localDeviceId: 'device-b' }, now),
    ).toMatchObject({
      allowed: false,
      reason: 'same-device',
    });
  });
});

describe('mobile network, calls, and deep links', () => {
  it('falls back conservatively on cellular, battery saver, and offline states', () => {
    expect(
      resolveMobileBandwidthMode('high-quality', {
        network: 'cellular',
        batterySaver: false,
        lowPowerDevice: false,
      }),
    ).toMatchObject({ mode: 'data-saver', fellBack: true, reason: 'cellular-policy' });
    expect(
      resolveMobileBandwidthMode('high-quality', {
        network: 'wifi',
        batterySaver: true,
        lowPowerDevice: false,
      }),
    ).toMatchObject({ mode: 'data-saver', reason: 'battery-saver' });
    expect(
      resolveMobileBandwidthMode('balanced', {
        network: 'offline',
        batterySaver: false,
        lowPowerDevice: false,
      }),
    ).toMatchObject({ mode: null, reason: 'offline' });
    expect(MOBILE_BANDWIDTH_PROFILES['data-saver'].allowVideoOnCellular).toBe(false);
  });

  it('keeps background calls short and audio-first', () => {
    expect(
      decideBackgroundCall({ kind: 'incoming', network: 'wifi', requestedVideo: true }),
    ).toMatchObject({ allowed: true, mode: 'audio-only', reason: 'video-requires-foreground' });
    expect(
      decideBackgroundCall(
        { kind: 'incoming', network: 'cellular', requestedVideo: false },
        { ...DEFAULT_BACKGROUND_CALL_POLICY, allowCellular: false },
      ),
    ).toMatchObject({ allowed: false, reason: 'cellular-policy' });
  });

  it('parses only supported, origin-controlled deep links', () => {
    expect(parseMobileDeepLink('scuttlebutt://room/!room:example.org')).toEqual({
      kind: 'room',
      value: '!room:example.org',
      source: 'scuttlebutt-scheme',
    });
    expect(
      parseMobileDeepLink('https://app.example/invite/ABC123', ['https://app.example']),
    ).toMatchObject({
      kind: 'invite',
      value: 'ABC123',
      source: 'https',
    });
    expect(() =>
      parseMobileDeepLink('https://evil.example/invite/ABC123', ['https://app.example']),
    ).toThrow('not allowed');
    expect(() => parseMobileDeepLink('scuttlebutt://room/room?access_token=secret')).toThrow(
      'unsafe',
    );
  });
});

describe('mobile architecture decision', () => {
  it('defers the client-framework choice until platform measurements exist', () => {
    expect(MOBILE_ARCHITECTURE_DECISION.decision).toBe('deferred');
    expect(MOBILE_ARCHITECTURE_DECISION.options).toEqual([
      'react-native',
      'native-swift-kotlin',
      'shared-core-hybrid',
    ]);
    expect(MOBILE_ARCHITECTURE_DECISION.prerequisites.length).toBeGreaterThan(2);
  });
});
