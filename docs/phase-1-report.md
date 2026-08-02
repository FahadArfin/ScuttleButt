# Phase 1 report

Date: 2026-08-02

## What changed

- Created a pnpm 11.9.0 workspace with Turborepo 2.10.8.
- Added strict TypeScript 6.0.3 configuration and ESLint 10 flat configuration.
- Added Prettier formatting and generated-file ignores.
- Added `apps/web`: React 19 + Vite 8 shell with a responsive accessible status card.
- Added `apps/platform-api`: Fastify 5 API shell with typed `GET /health` response.
- Added `packages/shared-types`, `packages/config`, `packages/ui`, and `packages/testing`.
- Added Vitest unit-test shells and a Playwright Chromium E2E shell.
- Added GitHub Actions CI for install, formatting, lint, typecheck, and unit tests.
- Added `.env.example`, `.nvmrc`, setup documentation, and safe generated-build policies.

## Files and directories added

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.json`
- `tsconfig.base.json`
- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `.gitignore`
- `.env.example`
- `.nvmrc`
- `.github/workflows/ci.yml`
- `apps/web/`
- `apps/platform-api/`
- `packages/shared-types/`
- `packages/config/`
- `packages/ui/`
- `packages/testing/`
- `docs/development/setup.md`

## Checks run

- `pnpm format:check` — passed.
- `pnpm lint` — passed across all six workspace projects.
- `pnpm typecheck` — passed across all six workspace projects.
- `pnpm test` — passed; config, API, and web tests passed, and shell packages correctly allow no tests yet.
- `pnpm build` — passed for all six workspace projects.
- Built API runtime check — passed with a real HTTP request to `/health`.
- `pnpm test:e2e` — passed in Chromium with one application-shell test.

## Known limitations

- No Matrix, Synapse, E2EE, federation, friend codes, LiveKit, Coturn, storage, authentication, or production deployment exists yet.
- The UI is a foundation shell, not the messaging interface.
- The API has no persistence or authentication.
- CI does not yet install Playwright browsers or run E2E tests; that can be added when CI runtime policy is chosen.
- The project license remains pending the Phase 0 licensing decision and owner/legal confirmation.

## Security implications

- No secrets are committed; `.env.example` contains local non-secret defaults only.
- The API health route returns status/version/timestamp only and performs no authorization-sensitive work.
- The web shell has no message plaintext, credentials, encryption keys, or external integrations.
- CSP and production reverse-proxy headers remain deployment hardening work for later phases.

## Exact next task

Begin Phase 2 only: add a local Synapse/PostgreSQL development environment and validate Matrix registration, login, session restore, device listing/revocation, room creation, and a two-user encrypted message exchange. Do not add friend codes, the full messaging UI, LiveKit, desktop, or mobile in that task.
