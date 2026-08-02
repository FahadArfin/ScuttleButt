# Local Matrix environment

Phase 2 uses the official Synapse container with PostgreSQL. The setup script generates the local signing key and registration secret under `infrastructure/matrix/data/`; those files are ignored and must never be reused for a real deployment.

From the repository root:

```bash
pnpm matrix:prepare
pnpm matrix:up
pnpm matrix:test
```

The local homeserver is available at `http://127.0.0.1:8008`. Stop it with:

```bash
pnpm matrix:down
```

The development configuration intentionally permits password registration without email or captcha and allows Synapse to accept Docker Desktop's default PostgreSQL locale. It is only for the local Docker network and is not a production security posture.
