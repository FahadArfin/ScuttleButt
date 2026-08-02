# Phase 13 report — mobile preparation foundation

**Status:** Preparation foundation in progress  
**Date:** 2026-08-02

## Delivered

- Added `@scuttlebutt/mobile-preparation`, a dependency-free contract package with shared API envelopes, cursor pages, conversation/device summaries, and bounded mobile sync requests.
- Added privacy-safe push notification payloads for messages, mentions, calls, and device verification. Payloads contain generic copy and explicitly cannot include a message preview.
- Added iOS Keychain and Android Keystore planning contracts with hardware-backed storage preference, never-sync private keys, explicit encrypted recovery export, and no unencrypted backup.
- Added background-call decisions that are audio-first, bounded by platform wake time, and able to require foreground for video.
- Added mobile bandwidth profiles and conservative fallback for cellular, battery-saver, low-power-device, and offline states.
- Added safe `scuttlebutt://` and allowlisted HTTPS deep-link parsing for rooms, invites, and device verification.
- Added device-verification decisions requiring distinct devices, an unexpired transaction, and explicit user confirmation.
- Added a deferred architecture decision record for React Native, native Swift/Kotlin, or a shared-core hybrid. The choice remains open until platform measurements are available.

## Security and privacy boundaries

This package does not store secrets, implement cryptography, register push tokens, perform background execution, or build a mobile UI. Native clients must use the platform secure-storage APIs and Matrix’s established crypto/device-verification flows. Push providers receive generic wake-up metadata by default; message content stays behind the authenticated client session.

The bandwidth and background-call rules are policy defaults, not guarantees about iOS or Android scheduling. Each supported OS version and device class still requires measurement.

## Verification

Passed:

```text
pnpm install --lockfile-only
pnpm --filter @scuttlebutt/mobile-preparation lint
pnpm --filter @scuttlebutt/mobile-preparation typecheck
pnpm --filter @scuttlebutt/mobile-preparation test
pnpm --filter @scuttlebutt/mobile-preparation build
```

The tests cover shared sync bounds, privacy-safe push payloads, mobile key-storage requirements, device verification, cellular/battery/offline fallbacks, background calls, deep-link origin validation, and deferred architecture selection.

## Remaining preparation work

1. Map these contracts to the authenticated platform API and Matrix client sync/device APIs.
2. Prototype push delivery, secure storage, deep links, and background call behavior on supported iOS and Android versions.
3. Measure battery, bandwidth, camera/audio, and background-execution behavior before choosing the client framework.
4. Define mobile accessibility, crash reporting, privacy disclosures, and release/support policy.
5. Build the mobile application only after the platform measurements and architecture decision are approved.
