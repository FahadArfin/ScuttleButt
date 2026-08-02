# Scuttlebutt

Scuttlebutt is planned as an open-source, self-hosted communication app with federated messaging, encrypted conversations, and self-hosted realtime voice/video.

## Project status

Phase 3 friend-code/contact foundation is in progress. Phase 2 local Matrix integration is complete; the product UI and persistent contact API are intentionally not implemented yet.

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

pnpm matrix:prepare
pnpm matrix:up
pnpm matrix:test
```

The API health endpoint is available at `http://127.0.0.1:3001/health`.
The local Matrix homeserver is available at `http://127.0.0.1:8008` after the Matrix setup commands complete.

## Current boundary

Phase 3 adds a tested friend-code/contact domain foundation: normalized high-entropy codes, keyed-digest storage, revocation/regeneration, invitation URLs, approval-gated contact requests, blocking, and lookup rate limits. The UI, authenticated platform API routes, persistent storage, QR rendering, community servers, calls, uploads, desktop, mobile, and production deployment remain future work.

## Important terminology

- A Matrix **homeserver** is the federated server that hosts identities and rooms.
- A user-facing Scuttlebutt **community/server** is a product concept that will map to Matrix spaces and rooms.
- Federation is provided by Matrix. Scuttlebutt will not invent a second federation protocol.

## License note

The project license and contribution policy must be finalized before the first distributable code release. Upstream services are consumed as separate components; no upstream source code is copied in Phase 0.
