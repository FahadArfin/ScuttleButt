# ADR-0005: E2EE boundaries

- Status: Accepted for implementation, subject to security review
- Date: 2026-08-02

## Context

The product requires privacy-focused messaging and media without claiming metadata-free operation or impossible moderation. E2EE must be implemented by maintained protocols and libraries.

## Decision

For encrypted Matrix rooms:

- Message bodies, encrypted attachments, room events where supported, and device-to-device key material are handled by the Matrix SDK crypto layer.
- Private keys remain on client devices. Recovery and backup are encrypted mechanisms with explicit user confirmation.
- The homeserver stores ciphertext and metadata; it is not promised access to plaintext.
- LiveKit media and data E2EE is enabled for calls where supported and tested as a separate boundary.
- Client-generated reports may disclose selected decrypted content only after a clear user confirmation.

Metadata that may remain visible includes server addresses, event timing, IP/connection information, room membership, approximate traffic volume, and device/session information.

## Consequences

- Server-side full-text search, automated moderation, and content inspection are not available for encrypted content.
- A compromised browser or desktop process can read plaintext at use time.
- Key loss can make content unrecoverable; recovery UX is a first-class feature, not a later convenience.
- Public/un-encrypted rooms and media require separate, explicit privacy labeling.

## Rejected alternatives

- Custom cryptography: rejected outright.
- Server-managed decryption keys: rejected because it breaks the stated E2EE boundary.
- “Metadata-free” marketing: rejected because it is not technically honest for federated, relay-based communications.
