# Phase 11 report — federation hardening foundation

**Status:** Foundation in progress  
**Date:** 2026-08-02

## Delivered

- Added `@scuttlebutt/federation`, a dependency-free Matrix federation policy boundary.
- Added strict normalization for homeserver origins, server discovery plans, federated user IDs, and room IDs.
- Added allowlist/blocklist evaluation with blocklists taking precedence, explicit TLS policy, link-state handling, and remote-identity detection.
- Added cross-server room invitation models that retain Matrix user and room IDs instead of introducing a second identity protocol.
- Added signing-key metadata checks for server match, Matrix-verified state, validity windows, and bounded clock skew. The package does not implement cryptography or accept raw private keys.
- Added bounded exponential retry plans, failure classification, queued-event preservation, and partial-outage summaries.
- Added a live two-homeserver federation runbook covering cross-server DMs, rooms, invites, outage recovery, malformed responses, and signing-key cases.

## Security and reliability boundary

Matrix and Synapse remain responsible for federation signatures, event authorization, device cryptography, and protocol compatibility. This package makes Scuttlebutt’s policy and failure behavior explicit; it does not replace Matrix verification or claim that a remote server is trustworthy merely because it is reachable.

## Verification

Passed:

```text
pnpm install --lockfile-only
pnpm --filter @scuttlebutt/federation lint
pnpm --filter @scuttlebutt/federation typecheck
pnpm --filter @scuttlebutt/federation test
pnpm --filter @scuttlebutt/federation build
```

The unit tests cover discovery, remote identities, room IDs, allow/block policy, TLS, signing-key metadata, retries, partial outages, and cross-server invitations.

## Remaining integration work

1. Run the two-independent-Synapse acceptance flow in `infrastructure/matrix-federation`.
2. Wire the policy boundary into authenticated Matrix client/server operations and idempotent delivery queues.
3. Add real federation outage, malformed-event, allow/block, and cross-server E2EE tests on CI-capable infrastructure.
