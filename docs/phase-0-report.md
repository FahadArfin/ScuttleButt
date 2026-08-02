# Phase 0 report

Date: 2026-08-02

## Findings

- Matrix is the strongest match for Scuttlebutt's federated identities, rooms, device model, synchronization, and E2EE requirements.
- Synapse is the practical first homeserver, but it is operationally substantial and AGPL/commercially dual-licensed.
- LiveKit is the strongest initial self-hosted SFU for voice, video, and screen sharing. It supports the needed WebRTC capabilities and client E2EE, but it does not provide federation.
- MatrixRTC-style signaling/discovery is the correct seam between Matrix room membership and LiveKit media.
- Coturn is required for reliable WebRTC connectivity in real deployments; it is not just a development convenience.
- Element, Stoat, Mattermost, Rocket.Chat, Zulip, Mumble, and Jitsi are valuable UX, operations, or media references, but none is a better end-to-end foundation for the stated combination of federation, E2EE messaging, self-hosting, and room-native calls.

## Decisions

1. Matrix/Synapse for messaging and federation.
2. LiveKit + MatrixRTC-compatible authorization/discovery for realtime media.
3. Tauri for the desktop shell after web stability.
4. Matrix-only federation; no custom Scuttlebutt federation protocol.
5. E2EE keys stay on client devices; server-visible metadata is documented honestly.
6. Friend codes are revocable, rate-limited discovery aliases, not identities or keys.
7. S3-compatible storage with MinIO for development and client encryption for encrypted-room attachments.
8. Dependency and license review is a release gate; final project licensing remains an owner/legal decision before distribution.

## Rejected alternatives

- Custom federation protocol: too much new security and interoperability surface.
- Custom cryptography: prohibited.
- Jitsi as the first call backend: excellent standalone reference, but less aligned with Matrix-native room calls than MatrixRTC + LiveKit.
- Full-mesh WebRTC: does not scale for community calls.
- Mumble as the primary media stack: voice-focused and not a web-first messaging foundation.
- A large custom backend: duplicates Matrix and increases security/operations burden.

## Security risks

- Compromised client JavaScript can read decrypted content; CSP and supply-chain controls are release-blocking.
- E2EE recovery, device verification, and key backup must be tested before messaging is considered usable.
- Homeservers, SFUs, TURN servers, and APIs can see metadata and can deny service even when they cannot decrypt content.
- Client-assisted reporting is required because server-side inspection of E2EE content would violate the stated boundary.
- Friend-code lookup, uploads, media JWTs, federation, backups, and admin permissions need rate limits and abuse controls.

## Performance and operations risks

- 4K60 screen sharing is hardware-, browser-, network-, and server-dependent; start at 1080p30 and show actual metrics.
- TURN relay traffic can dominate bandwidth and cost; use authentication, quotas, and capacity monitoring.
- Synapse federation, PostgreSQL, object storage, and LiveKit have different scaling and backup characteristics.
- A simple local Compose environment will not represent production availability, TLS, federation, storage, or media topology.

## Licensing risks

- Synapse and Element components use AGPL/commercial dual licensing.
- Stoat/Revolt and Mattermost have copyleft, exceptions, or mixed licensing across components.
- Rocket.Chat has MIT core areas plus separately licensed `ee/` content and third-party dependencies.
- Permissive repository licenses do not automatically cover every SDK, plugin, media codec, asset, or trademark.
- Scuttlebutt should study behavior and use protocol/API boundaries rather than copy reference implementation code.

## Open questions

- Should Scuttlebutt-owned server/API code be AGPL-3.0-or-later, with separate licensing for reusable client packages?
- Which Matrix SDK package/version and crypto/WASM path will be pinned in Phase 1/2?
- Will the first local Matrix environment use Synapse directly or a supported distribution/configuration?
- Which MatrixRTC MSCs and LiveKit authorization service version are stable enough for Phase 6?
- How will encrypted-media key distribution and call membership interact with cross-homeserver calls?
- What is the minimum community/server permission model that maps cleanly to Matrix room power levels?
- Which notification and push model is acceptable for encrypted messages without exposing plaintext to a push provider?

## Files created

- `README.md`
- `docs/research/open-source-comparison.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/threat-model.md`
- `docs/decisions/README.md`
- `docs/decisions/0001-matrix-foundation.md`
- `docs/decisions/0002-livekit-media.md`
- `docs/decisions/0003-tauri-desktop.md`
- `docs/decisions/0004-federation-model.md`
- `docs/decisions/0005-e2ee-boundaries.md`
- `docs/decisions/0006-friend-code-discovery.md`
- `docs/decisions/0007-storage-strategy.md`
- `docs/decisions/0008-licensing-and-upstream-use.md`
- `docs/roadmap.md`
- `docs/risk-register.md`

## Recommended next Codex task

Complete Phase 1 only: create the pnpm/Turborepo monorepo foundation, minimal React/Vite web shell, minimal typed platform API health endpoint, shared package shells, strict TypeScript/ESLint/Prettier/Vitest/Playwright setup, CI, and `.env.example`. Do not add Matrix, E2EE, LiveKit, uploads, desktop, mobile, or production deployment in that task.
