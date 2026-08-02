# Development setup

This guide covers the Phase 1 foundation only. It starts the web shell and platform API; it does not start Synapse, PostgreSQL, LiveKit, Coturn, MinIO, or any production service.

## Requirements

- Node.js 22.14.0
- pnpm 11.9.0
- Git

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

Build output is generated under package `dist/` directories and is ignored by Git. Turborepo cache is stored under `.turbo/` and is also ignored.

## Phase boundary

Do not add Matrix, E2EE, federation, uploads, LiveKit, desktop, mobile, or production Compose work to this foundation task. Those belong to later roadmap phases and require their own acceptance criteria.
