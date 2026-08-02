# ADR-0006: Friend-code discovery

- Status: Accepted for Phase 3 design, not implemented in Phase 1
- Date: 2026-08-02

## Context

Full Matrix IDs are correct but difficult to share. A friendly code and QR/invitation representation can reduce friction, but a public lookup service can become an account-enumeration and social-graph oracle.

## Decision

Provide an optional, revocable friend code that resolves to a canonical Matrix identity only through the user's homeserver or the operator's platform API. Default codes are generated with a CSPRNG using a human-safe alphabet; they do not contain passwords, private keys, or required public profile data. A user may choose a display prefix, but the default must not expose the username or homeserver.

Store a keyed digest of the normalized code rather than relying on plaintext code storage. Use an established platform cryptography API/library for the keyed digest; do not invent an algorithm. Support regeneration and revocation, exact-match lookup, rate limits, privacy-preserving errors, and a contact-approval step before exposing more profile information or creating a DM room.

QR codes and invitation links carry the friend code or an expiring invitation token, never a password, access token, or encryption private key.

## Consequences

- Codes are a discovery convenience, not a global identity system or blockchain identity.
- A code that leaks must be revocable without changing the Matrix account.
- Lookup telemetry must be minimized and protected because timing and approval events can still reveal relationships.
- Phase 3 must test enumeration resistance and rate-limit behavior before release.
