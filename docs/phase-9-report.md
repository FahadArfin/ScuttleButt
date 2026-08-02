# Phase 9 report — media and profile foundation

**Status:** Foundation in progress  
**Date:** 2026-08-02

## Delivered

- Added `@scuttlebutt/media-profile`, a dependency-free TypeScript boundary for media and profile policy.
- Added per-kind MIME and byte limits for images, video, GIFs, custom emoji, and stickers.
- Added required visual dimensions, pixel ceilings, video duration checks, canonical MIME normalization, and safe storage-key validation.
- Added upload-plan generation with short-lived expiry, original-preservation policy, and an explicit `client-encrypted` versus `server-processed` boundary.
- Added thumbnail plans for images, video poster frames, GIFs, and stickers. Encrypted media is marked for client-side processing; no server-side decryption is implied.
- Added storage quota decisions that account for both used and reserved bytes.
- Added animated avatar/banner selection rules, ownership checks, custom emoji shortcode normalization, custom sticker/emoji limits, and asset-kind checks.
- Added an optional GIF provider registry. Providers are injected by the deployment, and unsafe/non-HTTPS result URLs are filtered without hard-coding a paid provider.
- Added orphan cleanup candidate selection that requires zero references, no pin, an explicit orphan timestamp, and a grace period. The package does not delete objects.

## Security and privacy boundaries

The package validates metadata and produces plans; it does not upload bytes, sign storage URLs, process media, or inspect encrypted content. A production storage adapter must issue short-lived signed URLs, verify the authenticated owner, scan only server-processed media, and keep encrypted-room media client-encrypted before it reaches object storage. Remote GIF media is represented as provider metadata and is not proxied through Scuttlebutt.

Animated profiles, larger uploads, custom emoji, and stickers are deployment resource policies, not application subscription locks. The self-host operator controls the limits and quota.

## Verification

Passed:

```text
pnpm install --lockfile-only
pnpm --filter @scuttlebutt/media-profile lint
pnpm --filter @scuttlebutt/media-profile typecheck
pnpm --filter @scuttlebutt/media-profile test
pnpm --filter @scuttlebutt/media-profile build
```

The tests cover encrypted and server-processed thumbnail planning, strict metadata validation, path traversal rejection, quota reservation, animated profile policy, custom media limits, GIF URL filtering, and safe cleanup selection.

## Remaining integration work

1. Add an authenticated platform API and S3-compatible adapter for signed upload/download URLs.
2. Implement client-side encryption, actual thumbnail/transcoding work, upload progress, and resumable uploads.
3. Add malware scanning and content-type sniffing for server-processed media without weakening the E2EE boundary.
4. Connect Matrix media events and the web/desktop profile and composer UI.
5. Run storage integration, browser media, reduced-motion, and large-file tests.
