# Phase 10 report — administration and moderation foundation

**Status:** Foundation in progress  
**Date:** 2026-08-02

## Delivered

- Added `@scuttlebutt/moderation`, a dependency-free TypeScript boundary for operator policy and moderation decisions.
- Added owner, admin, moderator, and member roles with explicit permissions and strict role hierarchy checks. Moderators and admins cannot act on equal-or-higher roles or themselves.
- Added typed warn, timeout, kick, ban, and unban records. Timeouts expire, bans may be permanent or expiring, and records can be revoked; creating a record does not claim that Matrix enforcement has already happened.
- Added reports with open status and reason codes. Client-assisted encrypted-content reports require a room, event identifier, and explicit disclosure confirmation before selected decrypted content, context, or attachments can be included.
- Kept ordinary server report data separate from selected decrypted evidence. The server never receives an implicit “scan encrypted messages” capability.
- Added bounded structured audit events and an in-memory log for tests. Sensitive metadata keys such as content, plaintext, tokens, secrets, and passwords are rejected rather than written to the audit stream.
- Added invite creation/use limits, expiration and revocation checks, registration enablement, invite requirements, guest controls, email-domain/verification controls, and registration attempt limits.
- Added retention evaluation for message events, media objects, audit events, reports, and voice metadata. Legal holds and active moderation cases prevent automatic expiration decisions.
- Added total and per-user storage policy evaluation, warning thresholds, object-size limits, original-preservation policy, and client-encrypted/server-processed processing gates.
- Added the Phase 7 stream-quality profiles and a policy resolver that falls back to a compatible, accurately labeled mode instead of claiming unsupported quality. Participant limits are also enforced as a policy decision.

## Security and privacy boundaries

This package is an authorization and policy foundation, not a moderation backend. The authenticated platform API must re-check actor identity, role assignments, community membership, and target state on every request. A persistence adapter must make moderation actions and audit events append-only or tamper-evident, apply retention safely, and coordinate Matrix power levels/room bans where appropriate.

Encrypted message contents remain client-controlled. A report only includes decrypted evidence after the reporting user intentionally confirms the disclosure. Audit events contain structured reason codes and identifiers, not message bodies, tokens, or credentials.

Storage and stream limits are self-host operator policies. They are resource controls and are not application subscription gates.

## Verification

Passed:

```text
pnpm install --lockfile-only
pnpm --filter @scuttlebutt/moderation lint
pnpm --filter @scuttlebutt/moderation typecheck
pnpm --filter @scuttlebutt/moderation test
pnpm --filter @scuttlebutt/moderation build
```

The tests cover role hierarchy, expiring timeouts, permanent bans, report disclosure consent, evidence-source separation, audit metadata rejection, invite and registration policies, retention holds, storage warnings, and stream-quality fallback.

## Remaining integration work

1. Add authenticated API routes backed by persistent role, report, action, invite, and audit storage.
2. Map enforcement actions to Matrix membership/power-level operations and make retries/idempotency explicit.
3. Add operator and reporter UI with clear disclosure confirmation, review status, appeal/reversal flows, and audit access controls.
4. Add distributed rate limiting, abuse monitoring, legal-hold workflows, backup/restore, and retention jobs.
5. Connect storage/stream policies to the Phase 9 media adapter and Phase 6/7 LiveKit token and quality boundaries.
