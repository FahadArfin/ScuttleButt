# Phase 2 report

Date: 2026-08-02

## What changed

- Added a local Docker Compose environment with PostgreSQL 17 and Synapse 1.157.2.
- Added `pnpm matrix:prepare`, which generates ignored development signing/config files and configures Synapse for the local PostgreSQL service.
- Added `@scuttlebutt/matrix-client` around `matrix-js-sdk` 42.0.0 and its Rust crypto/WASM implementation.
- Implemented registration, password login, logout, session restore, device listing, UIA-protected device revocation, encrypted direct-room creation, room joining, and text send/receive.
- Added an integration test that checks both decrypted delivery to the second client and the encrypted event shape returned by Synapse.
- Added a PostgreSQL assertion that the test message marker is absent from Synapse's `event_json` table.

## Checks run

- `pnpm format:check` — passed.
- `pnpm lint` — passed across all seven workspace projects.
- `pnpm typecheck` — passed across all seven workspace projects.
- `pnpm test` — passed; the Matrix client unit tests passed.
- `pnpm build` — passed for all workspace projects.
- `pnpm matrix:prepare` — passed with generated local-only Synapse secrets.
- `pnpm matrix:up` — passed; PostgreSQL became healthy and Synapse became ready.
- `pnpm matrix:test` — passed; registration, login/logout, session restore, device revocation, encrypted delivery, ciphertext inspection, and database plaintext absence were all verified.

## Security boundary

The Matrix homeserver stores encrypted room events, not readable message bodies. The integration test proves this for a known marker in both the client-server event response and PostgreSQL. The test client uses an ephemeral Rust crypto store (`useIndexedDB: false`) so it is not yet a persistent browser session/key-storage design.

The local Synapse configuration permits password registration without verification and allows the Docker PostgreSQL locale override. Those settings are intentionally scoped to local development and must not be copied into production deployment configuration.

## Explicitly not included

- Full messaging UI or conversation list.
- Friend codes, contacts, communities, moderation, federation hardening, media, calls, desktop, or mobile.
- Persistent browser key storage, recovery-key UX, cross-signing/device verification UX, push notifications, or production TLS/reverse-proxy configuration.

## Next task

Begin Phase 3 only: define and implement the privacy-preserving friend-code/contact flow before adding broader messaging UI work.
