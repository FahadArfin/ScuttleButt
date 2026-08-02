# Development setup

This guide covers the Phase 2 local development environment. It starts the web shell and platform API separately from the local Synapse/PostgreSQL stack; it does not start LiveKit, Coturn, MinIO, or any production service.

## Requirements

- Node.js 22.14.0
- pnpm 11.9.0
- Git
- Docker Desktop with Linux containers
- Rust and Cargo for the Tauri desktop app
- Windows WebView2 and C++ build tools when developing on Windows

The repository records the Node version in `.nvmrc` and the pnpm version in the root `package.json`.

## Install

```bash
corepack enable
pnpm install
```

Never commit `.env` files or real secrets. Copy `.env.example` only when you need to override local defaults.

## Run the foundation

```bash
pnpm dev
```

The command builds shared packages once, then starts:

- Web shell: `http://localhost:5173`
- Platform API: `http://127.0.0.1:3001`
- Health endpoint: `http://127.0.0.1:3001/health`

The API only exposes a typed health response in Phase 1. It has no authentication, database, business data, or Matrix integration.

## Run the desktop shell

The desktop shell loads the same web frontend and protocol packages inside Tauri. Install the native prerequisites listed in the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) before running it:

```bash
pnpm desktop:dev
```

Build preparation is available with:

```bash
pnpm desktop:build
```

The desktop shell stores Matrix sessions through the operating system keychain, not a plaintext file. Native checks are separate from `pnpm check` because Tauri compilation requires Rust and platform SDKs. Do not add an updater until artifact signing, update authorization, rollback, and key rotation are designed.

## Run the local Matrix environment

```bash
pnpm matrix:prepare
pnpm matrix:up
pnpm matrix:test
```

This starts PostgreSQL 17 and Synapse 1.157.2. The homeserver is available at `http://127.0.0.1:8008`. Generated local signing keys, registration secrets, media, and database files live under ignored paths in `infrastructure/matrix/`.

Stop the local services with:

```bash
pnpm matrix:down
```

The Matrix client boundary is in `packages/matrix-client`. It owns Matrix registration, login/session handling, device operations, encrypted room creation, and encrypted text exchange. The integration test uses an in-memory crypto store; persistent browser key storage is a later task.

## Verify changes

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm check` runs formatting, linting, typechecking, and unit tests together.

## Workspace layout

- `apps/web`: React/Vite web shell and Playwright test.
- `apps/platform-api`: Fastify API shell and `/health` route.
- `packages/shared-types`: shared API response types and constants.
- `packages/config`: validated runtime configuration defaults.
- `packages/ui`: reusable accessible UI shell component.
- `packages/testing`: shared selectors and test constants.
- `packages/matrix-client`: typed Matrix SDK boundary and local integration test.
- `packages/livekit-client`: typed LiveKit voice/video boundary with E2EE, capture, fallback, and diagnostics helpers.
- `packages/media-profile`: policy validation and processing plans for uploads, thumbnails, profiles, custom media, quotas, GIF providers, and cleanup candidates.
- `packages/moderation`: role, report, enforcement, audit, invite, registration, retention, storage, and stream-quality policy contracts.
- `packages/federation`: Matrix homeserver discovery, federated identity, allow/block, signing-key metadata, retry, outage, and cross-server invite contracts.
- `packages/production-hardening`: release gates, dependency/license findings, rate limits, backup/restore, disaster recovery, redaction, telemetry, alert, and test-plan contracts.
- `packages/mobile-preparation`: shared mobile API/data contracts, push privacy, secure-storage requirements, background calls, bandwidth, deep links, device verification, and architecture decision record.
- `apps/desktop`: Tauri shell that reuses the web frontend and owns the narrow native capability surface.
- `packages/desktop-bridge`: shared web/desktop session, notification, deep-link, push-to-talk, and diagnostics contract.
- `infrastructure/matrix`: Docker Compose and local Synapse setup instructions.
- `infrastructure/livekit`: local Redis, LiveKit, and Coturn development stack.

Build output is generated under package `dist/` directories and is ignored by Git. Turborepo cache is stored under `.turbo/` and is also ignored.

## Phase boundary

Phase 5 community-server/channel foundation work is complete. The default web preview uses deterministic local repositories while browser login/session restoration and authenticated community/contact APIs are wired to the Matrix client. Phase 6 adds the voice boundary, Phase 7 adds camera/display capture, fallback, fullscreen, and diagnostics, Phase 8 adds the Tauri desktop boundary, Phase 9 adds media/profile policy contracts, Phase 10 adds administration/moderation policy contracts, Phase 11 adds federation policy contracts, Phase 12 adds production-readiness contracts, and Phase 13 adds mobile-preparation contracts. A local LiveKit/Coturn stack, a two-homeserver Matrix environment, and Rust/Tauri toolchain are still required for native media, federation, and desktop validation. Real security review, backup/restore drills, observability exporters, deployment upgrade tests, and mobile OS prototypes remain operator/infrastructure work. Do not treat attachment staging as an encrypted upload; the media package still needs authenticated storage and client-side processing, moderation actions still need authenticated Matrix enforcement, and federation contracts still need a live dual-homeserver run.

Start the local voice infrastructure with `pnpm voice:up` and stop it with `pnpm voice:down`. The web voice panel is a preview until a server-issued short-lived LiveKit token, a MatrixRTC membership check, and a dedicated E2EE worker are supplied.
