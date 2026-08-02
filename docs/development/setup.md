# Development setup

This guide covers the Phase 2 local development environment. It starts the web shell and platform API separately from the local Synapse/PostgreSQL stack; it does not start LiveKit, Coturn, MinIO, or any production service.

## Requirements

- Node.js 22.14.0
- pnpm 11.9.0
- Git
- Docker Desktop with Linux containers

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
- `infrastructure/matrix`: Docker Compose and local Synapse setup instructions.

Build output is generated under package `dist/` directories and is ignored by Git. Turborepo cache is stored under `.turbo/` and is also ignored.

## Phase boundary

Phase 3 friend-code/contact domain work is in progress. Do not add the full messaging interface, communities, calls, uploads, desktop, mobile, or production deployment work to this task. Persistent contact storage and authenticated API wiring require their own acceptance criteria before this phase is complete.
