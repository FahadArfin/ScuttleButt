export const MEDIA_KINDS = ['image', 'video', 'gif', 'emoji', 'sticker'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_PRIVACY_MODES = ['client-encrypted', 'server-processed'] as const;
export type MediaPrivacyMode = (typeof MEDIA_PRIVACY_MODES)[number];

export type ProfileMediaSlot = 'avatar' | 'banner';

export type MediaValidationCode =
  | 'invalid-owner'
  | 'invalid-kind'
  | 'invalid-mime-type'
  | 'mime-type-not-allowed'
  | 'invalid-size'
  | 'file-too-large'
  | 'invalid-dimensions'
  | 'image-too-large'
  | 'invalid-duration'
  | 'video-too-long'
  | 'invalid-privacy-mode'
  | 'originals-disabled'
  | 'invalid-profile-slot'
  | 'profile-asset-owner-mismatch'
  | 'profile-asset-kind-not-supported'
  | 'animated-profiles-disabled'
  | 'profile-asset-too-large'
  | 'invalid-name'
  | 'invalid-shortcode'
  | 'duplicate-shortcode'
  | 'emoji-asset-kind-mismatch'
  | 'sticker-asset-kind-mismatch'
  | 'emoji-limit-reached'
  | 'sticker-limit-reached';

export interface MediaValidationIssue {
  code: MediaValidationCode;
  message: string;
}

export interface MediaPolicy {
  allowedMimeTypesByKind: Readonly<Record<MediaKind, readonly string[]>>;
  maxBytesByKind: Readonly<Record<MediaKind, number>>;
  maxImagePixels: number;
  maxVideoDurationMs: number;
  maxProfileAssetBytes: number;
  maxCustomEmojiCount: number;
  maxStickerCount: number;
  storageQuotaBytes: number;
  cleanupGracePeriodMs: number;
  uploadUrlLifetimeMs: number;
  thumbnailMaxWidth: number;
  thumbnailMaxHeight: number;
  allowOriginals: boolean;
  allowAnimatedProfiles: boolean;
}

export const DEFAULT_MEDIA_POLICY: MediaPolicy = {
  allowedMimeTypesByKind: {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm'],
    gif: ['image/gif'],
    emoji: ['image/png', 'image/webp', 'image/gif'],
    sticker: ['image/png', 'image/webp', 'image/gif', 'video/webm'],
  },
  maxBytesByKind: {
    image: 20 * 1024 * 1024,
    video: 200 * 1024 * 1024,
    gif: 20 * 1024 * 1024,
    emoji: 512 * 1024,
    sticker: 5 * 1024 * 1024,
  },
  maxImagePixels: 40_000_000,
  maxVideoDurationMs: 10 * 60 * 1000,
  maxProfileAssetBytes: 10 * 1024 * 1024,
  maxCustomEmojiCount: 500,
  maxStickerCount: 200,
  storageQuotaBytes: 10 * 1024 * 1024 * 1024,
  cleanupGracePeriodMs: 24 * 60 * 60 * 1000,
  uploadUrlLifetimeMs: 15 * 60 * 1000,
  thumbnailMaxWidth: 640,
  thumbnailMaxHeight: 640,
  allowOriginals: true,
  allowAnimatedProfiles: true,
};

export function createMediaPolicy(overrides: Partial<MediaPolicy> = {}): MediaPolicy {
  return {
    ...DEFAULT_MEDIA_POLICY,
    ...overrides,
    allowedMimeTypesByKind:
      overrides.allowedMimeTypesByKind ?? DEFAULT_MEDIA_POLICY.allowedMimeTypesByKind,
    maxBytesByKind: overrides.maxBytesByKind ?? DEFAULT_MEDIA_POLICY.maxBytesByKind,
  };
}

export interface MediaUploadRequest {
  ownerId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  privacyMode: MediaPrivacyMode;
  width?: number;
  height?: number;
  durationMs?: number;
  animated?: boolean;
  originalRequested?: boolean;
}

export interface MediaAsset {
  id: string;
  ownerId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  privacyMode: MediaPrivacyMode;
  storageKey: string;
  width?: number;
  height?: number;
  durationMs?: number;
  animated: boolean;
  createdAt: string;
}

export type MediaValidationResult =
  | {
      ok: true;
      normalizedMimeType: string;
    }
  | {
      ok: false;
      issues: MediaValidationIssue[];
    };

const VISUAL_MEDIA_KINDS = new Set<MediaKind>(['image', 'video', 'gif', 'emoji', 'sticker']);

function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

function isPrivacyMode(value: string): value is MediaPrivacyMode {
  return (MEDIA_PRIVACY_MODES as readonly string[]).includes(value);
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 0;
}

export function validateMediaUpload(
  request: MediaUploadRequest,
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): MediaValidationResult {
  const issues: MediaValidationIssue[] = [];
  const ownerId = request.ownerId.trim();
  const normalizedMimeType = request.mimeType.trim().toLowerCase();

  if (!ownerId) {
    issues.push({ code: 'invalid-owner', message: 'An upload owner is required.' });
  }

  if (!isMediaKind(request.kind)) {
    issues.push({ code: 'invalid-kind', message: 'The media kind is not supported.' });
  }

  if (!normalizedMimeType || normalizedMimeType.includes(';')) {
    issues.push({
      code: 'invalid-mime-type',
      message: 'A single canonical MIME type is required.',
    });
  }

  if (isMediaKind(request.kind)) {
    const allowedTypes = policy.allowedMimeTypesByKind[request.kind];

    if (!allowedTypes.includes(normalizedMimeType)) {
      issues.push({
        code: 'mime-type-not-allowed',
        message: `MIME type ${normalizedMimeType || '(empty)'} is not allowed for ${request.kind}.`,
      });
    }

    if (!Number.isInteger(request.sizeBytes) || request.sizeBytes <= 0) {
      issues.push({ code: 'invalid-size', message: 'Size must be a positive integer in bytes.' });
    } else if (request.sizeBytes > policy.maxBytesByKind[request.kind]) {
      issues.push({
        code: 'file-too-large',
        message: `The ${request.kind} exceeds the configured byte limit.`,
      });
    }
  }

  if (VISUAL_MEDIA_KINDS.has(request.kind)) {
    if (!isPositiveInteger(request.width) || !isPositiveInteger(request.height)) {
      issues.push({
        code: 'invalid-dimensions',
        message: 'Width and height are required positive integers for visual media.',
      });
    } else if (request.width * request.height > policy.maxImagePixels) {
      issues.push({
        code: 'image-too-large',
        message: 'The media exceeds the configured pixel limit.',
      });
    }
  }

  if (request.kind === 'video') {
    if (!isPositiveInteger(request.durationMs)) {
      issues.push({
        code: 'invalid-duration',
        message: 'Video duration is required as a positive integer in milliseconds.',
      });
    } else if (request.durationMs > policy.maxVideoDurationMs) {
      issues.push({
        code: 'video-too-long',
        message: 'The video exceeds the configured duration limit.',
      });
    }
  } else if (request.durationMs !== undefined && !isNonNegativeInteger(request.durationMs)) {
    issues.push({ code: 'invalid-duration', message: 'Duration must be a non-negative integer.' });
  }

  if (!isPrivacyMode(request.privacyMode)) {
    issues.push({
      code: 'invalid-privacy-mode',
      message: 'The media privacy mode is not supported.',
    });
  }

  if (request.originalRequested && !policy.allowOriginals) {
    issues.push({
      code: 'originals-disabled',
      message: 'This server policy does not preserve original media objects.',
    });
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, normalizedMimeType };
}

export interface ThumbnailPlan {
  sourceKind: MediaKind;
  outputMimeType: 'image/webp';
  maxWidth: number;
  maxHeight: number;
  fit: 'contain';
  processingLocation: 'client' | 'server';
  generatePosterFrame: boolean;
}

export function buildThumbnailPlan(
  request: MediaUploadRequest,
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): ThumbnailPlan | null {
  if (request.kind === 'emoji') {
    return null;
  }

  return {
    sourceKind: request.kind,
    outputMimeType: 'image/webp',
    maxWidth: policy.thumbnailMaxWidth,
    maxHeight: policy.thumbnailMaxHeight,
    fit: 'contain',
    processingLocation: request.privacyMode === 'client-encrypted' ? 'client' : 'server',
    generatePosterFrame: request.kind === 'video',
  };
}

export interface CreateMediaUploadPlanInput {
  assetId: string;
  objectKey: string;
  request: MediaUploadRequest;
  issuedAtMs?: number;
  expiresAtMs?: number;
}

export interface MediaUploadPlan {
  assetId: string;
  objectKey: string;
  contentType: string;
  maxBytes: number;
  expiresAt: string;
  privacyMode: MediaPrivacyMode;
  clientMustEncrypt: boolean;
  preserveOriginal: boolean;
  thumbnail: ThumbnailPlan | null;
}

export function isSafeStorageKey(value: string): boolean {
  const normalized = value.trim();

  if (!normalized || normalized.startsWith('/') || normalized.includes('\\')) {
    return false;
  }

  return !normalized.split('/').some((segment) => segment === '..' || segment === '');
}

export function createMediaUploadPlan(
  input: CreateMediaUploadPlanInput,
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): MediaUploadPlan {
  const validation = validateMediaUpload(input.request, policy);

  if (!validation.ok) {
    throw new Error(
      `Media upload rejected: ${validation.issues.map(({ message }) => message).join(' ')}`,
    );
  }

  if (!input.assetId.trim()) {
    throw new Error('Media asset ID is required.');
  }

  if (!isSafeStorageKey(input.objectKey)) {
    throw new Error('Media storage key is not safe.');
  }

  const issuedAtMs = input.issuedAtMs ?? Date.now();
  const expiresAtMs = input.expiresAtMs ?? issuedAtMs + policy.uploadUrlLifetimeMs;

  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= issuedAtMs) {
    throw new Error('Media upload expiry must be after its issue time.');
  }

  return {
    assetId: input.assetId.trim(),
    objectKey: input.objectKey.trim(),
    contentType: validation.normalizedMimeType,
    maxBytes: policy.maxBytesByKind[input.request.kind],
    expiresAt: new Date(expiresAtMs).toISOString(),
    privacyMode: input.request.privacyMode,
    clientMustEncrypt: input.request.privacyMode === 'client-encrypted',
    preserveOriginal: (input.request.originalRequested ?? true) && policy.allowOriginals,
    thumbnail: buildThumbnailPlan(input.request, policy),
  };
}

export interface MediaQuotaUsage {
  limitBytes: number;
  usedBytes: number;
  reservedBytes: number;
}

export interface MediaQuotaDecision {
  allowed: boolean;
  requestedBytes: number;
  remainingBytes: number;
  reason?: 'invalid-request' | 'quota-exceeded';
}

export function checkMediaQuota(
  usage: MediaQuotaUsage,
  requestedBytes: number,
): MediaQuotaDecision {
  const validUsage =
    Number.isInteger(usage.limitBytes) &&
    usage.limitBytes >= 0 &&
    Number.isInteger(usage.usedBytes) &&
    usage.usedBytes >= 0 &&
    Number.isInteger(usage.reservedBytes) &&
    usage.reservedBytes >= 0;
  const validRequest = Number.isInteger(requestedBytes) && requestedBytes > 0;

  if (!validUsage || !validRequest) {
    return {
      allowed: false,
      requestedBytes,
      remainingBytes: 0,
      reason: 'invalid-request',
    };
  }

  const remainingBytes = Math.max(0, usage.limitBytes - usage.usedBytes - usage.reservedBytes);

  return {
    allowed: requestedBytes <= remainingBytes,
    requestedBytes,
    remainingBytes,
    ...(requestedBytes <= remainingBytes ? {} : { reason: 'quota-exceeded' as const }),
  };
}

export interface ProfileAssetSelectionInput {
  profileOwnerId: string;
  slot: ProfileMediaSlot;
  asset: Pick<MediaAsset, 'id' | 'ownerId' | 'kind' | 'sizeBytes' | 'animated'>;
}

export type ProfileAssetSelectionResult =
  | { ok: true; slot: ProfileMediaSlot; assetId: string; animated: boolean }
  | { ok: false; issues: MediaValidationIssue[] };

export function validateProfileAssetSelection(
  input: ProfileAssetSelectionInput,
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): ProfileAssetSelectionResult {
  const issues: MediaValidationIssue[] = [];

  if (input.slot !== 'avatar' && input.slot !== 'banner') {
    issues.push({
      code: 'invalid-profile-slot',
      message: 'The profile media slot is not supported.',
    });
  }

  if (!input.profileOwnerId.trim() || input.asset.ownerId !== input.profileOwnerId) {
    issues.push({
      code: 'profile-asset-owner-mismatch',
      message: 'A profile may only select an asset owned by the same principal.',
    });
  }

  if (input.asset.kind !== 'image' && input.asset.kind !== 'gif') {
    issues.push({
      code: 'profile-asset-kind-not-supported',
      message: 'Profiles support image and GIF assets only.',
    });
  }

  if (input.asset.animated && !policy.allowAnimatedProfiles) {
    issues.push({
      code: 'animated-profiles-disabled',
      message: 'Animated profile media is disabled by the server policy.',
    });
  }

  if (!Number.isInteger(input.asset.sizeBytes) || input.asset.sizeBytes <= 0) {
    issues.push({
      code: 'invalid-size',
      message: 'Profile media size must be a positive integer.',
    });
  } else if (input.asset.sizeBytes > policy.maxProfileAssetBytes) {
    issues.push({
      code: 'profile-asset-too-large',
      message: 'The profile asset exceeds the configured profile byte limit.',
    });
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, slot: input.slot, assetId: input.asset.id, animated: input.asset.animated };
}

function normalizeDisplayName(value: string): string | undefined {
  const normalized = value.normalize('NFKC').trim();
  return normalized.length >= 1 && normalized.length <= 64 ? normalized : undefined;
}

export function normalizeShortcode(value: string): string | undefined {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/^:/, '')
    .replace(/:$/, '')
    .toLowerCase();
  return /^[a-z0-9_]{2,32}$/.test(normalized) ? normalized : undefined;
}

export interface CustomEmojiInput {
  id: string;
  name: string;
  shortcode: string;
  asset: Pick<MediaAsset, 'id' | 'kind' | 'animated'>;
  existingShortcodes?: readonly string[];
  currentCount?: number;
}

export interface CustomEmojiDefinition {
  id: string;
  name: string;
  shortcode: string;
  assetId: string;
  animated: boolean;
}

export type CustomEmojiResult =
  { ok: true; value: CustomEmojiDefinition } | { ok: false; issues: MediaValidationIssue[] };

export function validateCustomEmoji(
  input: CustomEmojiInput,
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): CustomEmojiResult {
  const issues: MediaValidationIssue[] = [];
  const name = normalizeDisplayName(input.name);
  const shortcode = normalizeShortcode(input.shortcode);

  if (!name) {
    issues.push({ code: 'invalid-name', message: 'Emoji name must contain 1 to 64 characters.' });
  }

  if (!shortcode) {
    issues.push({
      code: 'invalid-shortcode',
      message: 'Emoji shortcode must contain 2 to 32 lowercase letters, numbers, or underscores.',
    });
  } else if (
    (input.existingShortcodes ?? []).some((existing) => normalizeShortcode(existing) === shortcode)
  ) {
    issues.push({ code: 'duplicate-shortcode', message: 'Emoji shortcode is already in use.' });
  }

  if (input.asset.kind !== 'emoji') {
    issues.push({
      code: 'emoji-asset-kind-mismatch',
      message: 'A custom emoji must reference an emoji media asset.',
    });
  }

  if ((input.currentCount ?? 0) >= policy.maxCustomEmojiCount) {
    issues.push({
      code: 'emoji-limit-reached',
      message: 'The custom emoji limit has been reached.',
    });
  }

  return issues.length > 0
    ? { ok: false, issues }
    : {
        ok: true,
        value: {
          id: input.id.trim(),
          name: name ?? '',
          shortcode: shortcode ?? '',
          assetId: input.asset.id,
          animated: input.asset.animated,
        },
      };
}

export interface CustomStickerInput {
  id: string;
  name: string;
  asset: Pick<MediaAsset, 'id' | 'kind' | 'animated'>;
  currentCount?: number;
}

export interface CustomStickerDefinition {
  id: string;
  name: string;
  assetId: string;
  animated: boolean;
}

export type CustomStickerResult =
  { ok: true; value: CustomStickerDefinition } | { ok: false; issues: MediaValidationIssue[] };

export function validateCustomSticker(
  input: CustomStickerInput,
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): CustomStickerResult {
  const issues: MediaValidationIssue[] = [];
  const name = normalizeDisplayName(input.name);

  if (!name) {
    issues.push({ code: 'invalid-name', message: 'Sticker name must contain 1 to 64 characters.' });
  }

  if (input.asset.kind !== 'sticker') {
    issues.push({
      code: 'sticker-asset-kind-mismatch',
      message: 'A custom sticker must reference a sticker media asset.',
    });
  }

  if ((input.currentCount ?? 0) >= policy.maxStickerCount) {
    issues.push({
      code: 'sticker-limit-reached',
      message: 'The custom sticker limit has been reached.',
    });
  }

  return issues.length > 0
    ? { ok: false, issues }
    : {
        ok: true,
        value: {
          id: input.id.trim(),
          name: name ?? '',
          assetId: input.asset.id,
          animated: input.asset.animated,
        },
      };
}

export interface GifSearchResult {
  id: string;
  title: string;
  mediaUrl: string;
  previewUrl: string;
  width: number;
  height: number;
}

export interface GifProvider {
  readonly id: string;
  search(query: string, limit: number): Promise<readonly GifSearchResult[]>;
}

export function isSafeRemoteMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function isValidGifSearchResult(result: GifSearchResult): boolean {
  return (
    Boolean(result.id.trim()) &&
    Boolean(result.title.trim()) &&
    isSafeRemoteMediaUrl(result.mediaUrl) &&
    isSafeRemoteMediaUrl(result.previewUrl) &&
    Number.isInteger(result.width) &&
    result.width > 0 &&
    Number.isInteger(result.height) &&
    result.height > 0
  );
}

export class GifProviderRegistry {
  private readonly providers = new Map<string, GifProvider>();

  constructor(providers: readonly GifProvider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider: GifProvider): void {
    const id = provider.id.trim();

    if (!id) {
      throw new Error('GIF provider ID is required.');
    }

    if (this.providers.has(id)) {
      throw new Error(`GIF provider ${id} is already registered.`);
    }

    this.providers.set(id, provider);
  }

  listProviderIds(): string[] {
    return [...this.providers.keys()].sort();
  }

  async search(providerId: string, query: string, requestedLimit = 20): Promise<GifSearchResult[]> {
    const provider = this.providers.get(providerId);
    const normalizedQuery = query.normalize('NFKC').trim();
    const limit = Math.min(50, Math.max(1, Math.trunc(requestedLimit)));

    if (!provider || !normalizedQuery) {
      return [];
    }

    const results = await provider.search(normalizedQuery, limit);
    return results
      .filter(isValidGifSearchResult)
      .slice(0, limit)
      .map((result) => ({ ...result }));
  }
}

export interface MediaLifecycleRecord extends MediaAsset {
  referenceCount: number;
  pinned: boolean;
  orphanedAt?: string;
  deletedAt?: string;
}

export function selectMediaCleanupCandidates(
  records: readonly MediaLifecycleRecord[],
  nowMs = Date.now(),
  policy: MediaPolicy = DEFAULT_MEDIA_POLICY,
): MediaLifecycleRecord[] {
  return records.filter((record) => {
    if (record.deletedAt || record.pinned || record.referenceCount !== 0 || !record.orphanedAt) {
      return false;
    }

    const orphanedAtMs = Date.parse(record.orphanedAt);
    return Number.isFinite(orphanedAtMs) && nowMs - orphanedAtMs >= policy.cleanupGracePeriodMs;
  });
}
