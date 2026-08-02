# Scuttlebutt

Scuttlebutt is planned as an open-source, self-hosted communication app with federated messaging, encrypted conversations, and self-hosted realtime voice/video.

## Project status

Phase 1 (monorepo foundation) is complete. Product features are intentionally not implemented yet.

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
```

The API health endpoint is available at `http://127.0.0.1:3001/health`.

## Current boundary

Phase 1 created the monorepo and development shells only: a minimal React/Vite web app, a minimal TypeScript platform API with a health endpoint, shared package scaffolding, formatting/linting/typecheck/test commands, CI, and documentation structure. It does not implement registration, messaging, E2EE, federation, calls, uploads, or production deployment.

## Important terminology

- A Matrix **homeserver** is the federated server that hosts identities and rooms.
- A user-facing Scuttlebutt **community/server** is a product concept that will map to Matrix spaces and rooms.
- Federation is provided by Matrix. Scuttlebutt will not invent a second federation protocol.

## License note

The project license and contribution policy must be finalized before the first distributable code release. Upstream services are consumed as separate components; no upstream source code is copied in Phase 0.
