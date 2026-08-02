# Scuttlebutt

Scuttlebutt is planned as an open-source, self-hosted communication app with federated messaging, encrypted conversations, and self-hosted realtime voice/video.

## Project status

Phase 12 production hardening, Phase 11 federation, Phase 10 administration/moderation, Phase 9 media/profile, and Phase 8 desktop foundations are in progress. Phase 7 video and screen-sharing, Phase 6 voice proof-of-concept, and Phase 5 community-server/channel mapping are available as tested foundations; real security/operations audits, live multi-homeserver validation, authenticated moderation/storage routes, Matrix enforcement, native runtime validation, browser session wiring, and persistent contact API routes remain intentionally staged.

Start with:

- [Phase 0 report](docs/phase-0-report.md)
- [Open-source comparison](docs/research/open-source-comparison.md)
- [System overview](docs/architecture/system-overview.md)
- [Threat model](docs/architecture/threat-model.md)
- [Milestone plan](docs/roadmap.md)
- [Risk register](docs/risk-register.md)
- [Architecture decisions](docs/decisions/)
- [Development setup](docs/development/setup.md)
- [Phase 1 report](docs/phase-1-report.md)
- [Local Matrix environment](infrastructure/matrix/README.md)
- [Phase 2 report](docs/phase-2-report.md)
- [Phase 3 report](docs/phase-3-report.md)
- [Phase 4 report](docs/phase-4-report.md)
- [Phase 5 report](docs/phase-5-report.md)
- [Phase 6 report](docs/phase-6-report.md)
- [Phase 7 report](docs/phase-7-report.md)
- [Phase 8 report](docs/phase-8-report.md)
- [Phase 9 report](docs/phase-9-report.md)
- [Phase 10 report](docs/phase-10-report.md)
- [Phase 11 report](docs/phase-11-report.md)
- [Phase 12 report](docs/phase-12-report.md)
- [Local LiveKit/Coturn environment](infrastructure/livekit/README.md)

## Development

Requirements: Node.js 22.14.0 and pnpm 11.9.0.

```bash
corepack enable
pnpm install
pnpm dev
```

The web shell runs at `http://localhost:5173`; the platform API runs at `http://127.0.0.1:3001`.

Useful checks:

```bash
pnpm check
pnpm build
pnpm test:e2e

pnpm desktop:dev
pnpm desktop:build

pnpm matrix:prepare
pnpm matrix:up
pnpm matrix:test
```

The API health endpoint is available at `http://127.0.0.1:3001/health`.
The local Matrix homeserver is available at `http://127.0.0.1:8008` after the Matrix setup commands complete. The desktop commands require Rust/Cargo and the native Tauri prerequisites described in [the desktop setup guide](docs/development/setup.md).

## Current boundary

Phase 3 adds a tested friend-code/contact domain foundation: normalized high-entropy codes, keyed-digest storage, revocation/regeneration, invitation URLs, approval-gated contact requests, blocking, and lookup rate limits. Phase 4 adds the messaging workspace, Phase 5 adds the community-server/channel foundation and Matrix space mapping, Phase 6 adds the LiveKit/Coturn voice boundary, Phase 7 adds the camera/display capture and diagnostics boundary, Phase 8 adds the Tauri desktop shell and secure native capability boundary, Phase 9 adds the media/profile policy boundary, Phase 10 adds the administration/moderation policy boundary, Phase 11 adds the federation policy boundary, and Phase 12 adds the production-readiness policy boundary. Browser login/session wiring, authenticated contact/community/voice-token/storage/moderation APIs, live media processing, Matrix enforcement, live multi-homeserver validation, real security/operations audits, QR rendering, encrypted media uploads, native desktop validation, mobile, and production deployment remain future work.

## Important terminology

- A Matrix **homeserver** is the federated server that hosts identities and rooms.
- A user-facing Scuttlebutt **community/server** is a product concept that will map to Matrix spaces and rooms.
- Federation is provided by Matrix. Scuttlebutt will not invent a second federation protocol.

## License note

The project license and contribution policy must be finalized before the first distributable code release. Upstream services are consumed as separate components; no upstream source code is copied in Phase 0.
