# Local Matrix federation test runbook

Phase 11 keeps Matrix as the federation protocol. The reusable policy and identity boundary is in `@scuttlebutt/federation`; this directory is the runbook for the live two-homeserver acceptance environment.

The live federation test must use two independently configured Synapse homeservers with:

- different server names and signing keys;
- separate PostgreSQL databases and media stores;
- client and federation listeners reachable from the test runner;
- TLS or an explicitly isolated development exception;
- registration of one test account on each server.

The acceptance flow is:

1. Discover both homeservers and verify their server names.
2. Create a direct room across the two identities and exchange an encrypted event.
3. Create a shared room, invite the remote identity, join from the second homeserver, and exchange an event.
4. Stop one homeserver, verify that local state remains readable and remote delivery is queued/retried.
5. Restore it, verify delivery resumes without duplicate application-level actions.
6. Exercise an allowed peer, a blocked peer, an expired signing key, and a malformed remote response.

The repository’s single-homeserver Compose stack remains under `infrastructure/matrix`. Do not point this runbook at a production homeserver or reuse its signing keys. The live two-homeserver run is intentionally an integration gate and is not claimed by the package unit tests.
