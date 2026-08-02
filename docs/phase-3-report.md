# Phase 3 report

Date: 2026-08-02

## What changed

- Added `@scuttlebutt/friend-codes` as a small domain package for discovery and contacts.
- Added CSPRNG-generated 16-character friend codes using a human-safe alphabet that excludes ambiguous characters.
- Added Unicode/case/grouping normalization and HMAC-SHA-256 keyed digests so raw codes are not required in storage.
- Added revocation and regeneration semantics; issuing a new code revokes the previous active code.
- Added invitation URL creation/parsing with no password, access token, Matrix identity, or private key in the payload.
- Added opaque contact-request submission, approval-gated Matrix identity resolution, decline, blocking/unblocking, duplicate suppression, and contact listing.
- Added per-caller sliding-window rate limiting and generic processing responses for unknown, malformed, revoked, self, duplicate, and blocked codes.

## Checks run

- `pnpm --filter @scuttlebutt/friend-codes typecheck` — passed.
- `pnpm --filter @scuttlebutt/friend-codes build` — passed.
- `pnpm --filter @scuttlebutt/friend-codes test` — passed; 7 tests passed.

## Privacy boundary

Friend-code submission does not return a Matrix ID or profile. It creates an actionable request only when a valid active code resolves internally. The recipient sees an opaque request and must accept it before the service returns the peer Matrix identity needed for Matrix contact/DM setup.

Unknown and revoked codes are deliberately inert and use the same response shape as accepted-for-processing submissions. Rate limiting is applied before code interpretation. The API adapter must use a composite rate-limit key rather than relying only on a user-controlled identifier.

## Remaining work before Phase 3 is complete

- Replace the in-memory store with PostgreSQL-backed persistence and migrations.
- Add authenticated platform API routes using the real Matrix session principal; no spoofable development header is being introduced.
- Add expiring invitation tokens and QR rendering through established client libraries.
- Add abuse telemetry with redacted, minimized data and integration tests through the authenticated API boundary.

## Explicitly not included

- Full contact/friend-code UI.
- Friend-code discovery across homeservers beyond the platform service boundary.
- Community servers, messaging UI, calls, media, desktop, or mobile.
