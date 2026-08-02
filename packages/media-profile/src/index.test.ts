import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEDIA_POLICY,
  GifProviderRegistry,
  buildThumbnailPlan,
  checkMediaQuota,
  createMediaPolicy,
  createMediaUploadPlan,
  isSafeRemoteMediaUrl,
  isSafeStorageKey,
  normalizeShortcode,
  selectMediaCleanupCandidates,
  validateCustomEmoji,
  validateCustomSticker,
  validateMediaUpload,
  validateProfileAssetSelection,
} from './index.js';

const imageUpload = {
  ownerId: 'alice',
  kind: 'image' as const,
  mimeType: 'image/png',
  sizeBytes: 1_024,
  privacyMode: 'client-encrypted' as const,
  width: 1_920,
  height: 1_080,
  originalRequested: true,
};

describe('media upload policy', () => {
  it('accepts an encrypted image and creates a client-processing thumbnail plan', () => {
    expect(validateMediaUpload(imageUpload)).toEqual({ ok: true, normalizedMimeType: 'image/png' });
    expect(buildThumbnailPlan(imageUpload)).toMatchObject({
      processingLocation: 'client',
      outputMimeType: 'image/webp',
      generatePosterFrame: false,
    });

    expect(
      createMediaUploadPlan({
        assetId: 'asset-1',
        objectKey: 'media/alice/asset-1',
        request: imageUpload,
        issuedAtMs: 1_000,
      }),
    ).toMatchObject({
      assetId: 'asset-1',
      clientMustEncrypt: true,
      contentType: 'image/png',
      expiresAt: new Date(1_000 + DEFAULT_MEDIA_POLICY.uploadUrlLifetimeMs).toISOString(),
      preserveOriginal: true,
    });
  });

  it('rejects unsafe MIME, size, dimension, and duration metadata', () => {
    const result = validateMediaUpload({
      ownerId: 'alice',
      kind: 'video',
      mimeType: 'video/mp4; codecs=h264',
      sizeBytes: DEFAULT_MEDIA_POLICY.maxBytesByKind.video + 1,
      privacyMode: 'server-processed',
      width: 10_000,
      height: 10_000,
      durationMs: DEFAULT_MEDIA_POLICY.maxVideoDurationMs + 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          'invalid-mime-type',
          'mime-type-not-allowed',
          'file-too-large',
          'image-too-large',
          'video-too-long',
        ]),
      );
    }
  });

  it('keeps server processing away from client-encrypted media and blocks unsafe keys', () => {
    const policy = createMediaPolicy({ allowOriginals: false });
    const request = {
      ...imageUpload,
      privacyMode: 'server-processed' as const,
      originalRequested: false,
    };

    expect(buildThumbnailPlan(request, policy)).toMatchObject({ processingLocation: 'server' });
    expect(isSafeStorageKey('media/alice/asset-1')).toBe(true);
    expect(isSafeStorageKey('../asset-1')).toBe(false);
    expect(isSafeStorageKey('media\\alice\\asset-1')).toBe(false);
    expect(() =>
      createMediaUploadPlan({ assetId: 'asset-1', objectKey: '../asset-1', request }, policy),
    ).toThrow('storage key');
  });
});

describe('quota, profiles, and custom media', () => {
  it('accounts for used and reserved bytes before allowing a new upload', () => {
    expect(
      checkMediaQuota({ limitBytes: 1_000, usedBytes: 400, reservedBytes: 200 }, 400),
    ).toMatchObject({
      allowed: true,
      remainingBytes: 400,
    });
    expect(
      checkMediaQuota({ limitBytes: 1_000, usedBytes: 400, reservedBytes: 200 }, 401),
    ).toMatchObject({
      allowed: false,
      reason: 'quota-exceeded',
    });
  });

  it('allows owned animated profile media only when the server policy permits it', () => {
    const asset = {
      id: 'avatar-1',
      ownerId: 'alice',
      kind: 'gif' as const,
      sizeBytes: 100,
      animated: true,
    };
    expect(
      validateProfileAssetSelection({ profileOwnerId: 'alice', slot: 'avatar', asset }),
    ).toMatchObject({
      ok: true,
      animated: true,
    });
    expect(
      validateProfileAssetSelection(
        { profileOwnerId: 'alice', slot: 'avatar', asset },
        createMediaPolicy({ allowAnimatedProfiles: false }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateProfileAssetSelection({ profileOwnerId: 'bob', slot: 'avatar', asset }),
    ).toMatchObject({
      ok: false,
    });
  });

  it('normalizes custom emoji shortcodes and enforces pack limits and asset kinds', () => {
    expect(normalizeShortcode(':Party_Parrot:')).toBe('party_parrot');
    expect(
      validateCustomEmoji({
        id: 'emoji-1',
        name: ' Party Parrot ',
        shortcode: ':Party_Parrot:',
        asset: { id: 'asset-emoji', kind: 'emoji', animated: true },
      }),
    ).toMatchObject({ ok: true, value: { name: 'Party Parrot', shortcode: 'party_parrot' } });
    expect(
      validateCustomEmoji({
        id: 'emoji-2',
        name: 'Other',
        shortcode: 'party_parrot',
        existingShortcodes: ['party_parrot'],
        asset: { id: 'asset-image', kind: 'image', animated: false },
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateCustomSticker(
        {
          id: 'sticker-1',
          name: 'Wave',
          asset: { id: 'asset-sticker', kind: 'sticker', animated: false },
          currentCount: DEFAULT_MEDIA_POLICY.maxStickerCount,
        },
        DEFAULT_MEDIA_POLICY,
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('GIF provider and cleanup boundaries', () => {
  it('filters unsafe provider results and never hard-codes a provider', async () => {
    const registry = new GifProviderRegistry([
      {
        id: 'local-provider',
        async search() {
          return [
            {
              id: 'safe',
              title: 'Safe GIF',
              mediaUrl: 'https://cdn.example/safe.gif',
              previewUrl: 'https://cdn.example/safe.webp',
              width: 320,
              height: 180,
            },
            {
              id: 'unsafe',
              title: 'Unsafe GIF',
              mediaUrl: 'javascript:alert(1)',
              previewUrl: 'https://cdn.example/unsafe.webp',
              width: 320,
              height: 180,
            },
          ];
        },
      },
    ]);

    expect(registry.listProviderIds()).toEqual(['local-provider']);
    expect(await registry.search('local-provider', 'cats', 10)).toHaveLength(1);
    expect(await registry.search('missing-provider', 'cats')).toEqual([]);
    expect(isSafeRemoteMediaUrl('http://cdn.example/image.gif')).toBe(false);
    expect(isSafeRemoteMediaUrl('https://cdn.example/image.gif')).toBe(true);
  });

  it('selects only unreferenced, unpinned, grace-period-expired media', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    const base = {
      id: 'asset',
      ownerId: 'alice',
      kind: 'image' as const,
      mimeType: 'image/png',
      sizeBytes: 100,
      privacyMode: 'client-encrypted' as const,
      storageKey: 'media/alice/asset',
      width: 10,
      height: 10,
      animated: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      referenceCount: 0,
      pinned: false,
      orphanedAt: '2026-08-01T00:00:00.000Z',
    };

    expect(
      selectMediaCleanupCandidates(
        [
          base,
          { ...base, id: 'referenced', referenceCount: 1 },
          { ...base, id: 'pinned', pinned: true },
          { ...base, id: 'recent', orphanedAt: '2026-08-02T11:30:00.000Z' },
        ],
        now,
      ).map(({ id }) => id),
    ).toEqual(['asset']);
  });
});
