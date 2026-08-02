# Proposed milestone plan

This plan keeps the requested phases separate. Dates are intentionally omitted until Phase 1 establishes the build and test baseline.

## Phase 0 — Research and architecture (complete)

- Compare Matrix, Element, Element Call, LiveKit, Stoat/Revolt, Mattermost, Rocket.Chat, Zulip, Mumble, Jitsi, and Coturn.
- Record architecture, trust boundaries, browser limits, licensing risks, and alternatives.
- Produce system diagram, threat model, ADRs, milestone plan, and risk register.

## Phase 1 — Monorepo foundation (complete)

### Scope

- Create pnpm workspace and Turborepo configuration.
- Add `apps/web` with a minimal React + TypeScript + Vite shell.
- Add `apps/platform-api` with a typed `/health` endpoint and no business data.
- Add `packages/shared-types`, `packages/config`, `packages/ui`, and `packages/testing` shells.
- Add strict TypeScript, ESLint, Prettier, Vitest, Playwright configuration, and GitHub Actions.
- Add documentation navigation and a safe `.env.example`.

### Explicitly out of scope

Matrix login/registration, E2EE, federation, friend-code generation, uploads, LiveKit calls, desktop/Tauri, production Compose, and mobile.

### Acceptance criteria

- Fresh install from README works with the chosen Node and pnpm versions.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- Web app starts and shows a shell.
- API health endpoint responds with a typed status payload.
- CI runs the same checks on pull requests.
- No hard-coded secrets or placeholder security code is introduced.

## Phase 2 — Local Matrix integration (complete)

Add a local Synapse/PostgreSQL environment and implement the smallest verified flow: registration, login, logout, session restore, device list/revocation, room creation, and encrypted one-to-one message exchange. Prove that the homeserver database does not contain readable message bodies.

Acceptance checks passed on 2026-08-02. See [the Phase 2 report](phase-2-report.md).

## Phase 3 — Friend codes and contacts

Add generation, normalization, lookup, QR/invite representations, contact requests, blocking, revocation/regeneration, rate limits, and anti-enumeration behavior. Resolve to Matrix identities only after the privacy model is documented.

## Phase 4 — Messaging interface

Build conversation list, timeline, composer, replies, edit/delete, reactions, attachments, typing/read states, drafts, notifications, accessibility, and retry flows over the Matrix client boundary.

## Phase 5 — Community servers and channels

Map communities to Matrix spaces/rooms. Add categories, text channels, membership, invites, small roles/permissions, pins, threads, custom emoji, and a clear user-facing distinction between “community server” and homeserver.

## Phase 6 — Voice proof of concept

Integrate MatrixRTC-compatible call signaling with self-hosted LiveKit and Coturn. Validate three local participants, short-lived tokens, reconnection, TURN fallback, and media E2EE configuration.

## Phase 7 — Video and screen sharing

Start at 1080p30. Add actual diagnostics, capture selection, adaptive subscriptions, fullscreen, simulcast, and measured quality fallback before considering 1440p or 4K modes.

## Phase 8 — Desktop application

Add Tauri login/session storage, notifications, tray, deep links, screen capture, device selection, push-to-talk foundation, and desktop diagnostics. Do not add unsigned auto-update behavior.

## Phase 9 — Media and profile features

Add policy-controlled image/video uploads, thumbnails, GIF provider abstraction, animated profiles, custom emoji/stickers, quotas, and cleanup jobs.

## Phase 10 — Administration and moderation

Add reports, client-assisted encrypted-content reports, kick/ban/timeout, roles, audit log, invite and registration controls, retention, storage, and stream-quality policies.

## Phase 11 — Federation hardening

Only after local flows are stable: test multiple homeservers, cross-server identities, rooms, DMs, invites, outage behavior, allow/block lists, signing-key handling, and partial failures.

## Phase 12 — Production hardening

Prepare security review, dependency and license audits, fuzz/load testing, backup/restore, privacy/accessibility review, observability, alerting, and upgrade tests.

## Phase 13 — Mobile preparation

Define shared contracts, push design, mobile key storage, background calls, bandwidth modes, deep links, and device verification before choosing React Native versus native clients.

## Phase 1 task sequence

1. Record Node/pnpm versions and create workspace root.
2. Add web shell and API health endpoint.
3. Add shared packages and strict config.
4. Add tests, linting, formatting, and CI.
5. Update README and developer setup docs.
6. Stop and verify acceptance criteria before starting Matrix work.

Phase 1 acceptance checks passed on 2026-08-02. See [the Phase 1 report](phase-1-report.md).
