# ADR-0006: Friend-code discovery

- Status: Accepted; Phase 3 domain foundation implemented, API/storage integration pending
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

## Phase 3 foundation behavior

- Codes use a 32-symbol human-safe alphabet that excludes ambiguous characters, with 6 symbols for a memorable Discord-style code. Because this is a discovery code rather than an authentication secret, lookup is aggressively rate-limited, duplicate issuance is rejected, and the recipient must explicitly approve every request.
- Input is normalized with Unicode compatibility normalization, case folding, and removal of spaces/hyphens before exact lookup.
- The in-memory Phase 3 store keeps an HMAC-SHA-256 digest, not the raw code. The HMAC key must contain at least 32 bytes and is supplied by the service owner.
- Code submission always returns the same shaped accepted-for-processing response and never returns the target Matrix ID. Unknown, malformed, revoked, self, duplicate, and blocked codes create no actionable request.
- A recipient sees only an opaque pending request. The peer Matrix ID is returned only after the recipient accepts the request.
- Lookup attempts are rate limited per caller key. The eventual API adapter must combine authenticated principal and network/device signals when choosing that key.
- Invitation URLs carry only the formatted friend code. QR rendering is a client presentation concern; passwords, access tokens, Matrix access credentials, and private keys are never placed in the URL.
