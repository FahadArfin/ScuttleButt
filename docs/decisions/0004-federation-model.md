# ADR-0004: Matrix federation model

- Status: Accepted for implementation
- Date: 2026-08-02

## Context

The product goal requires independent operators to communicate across domains. A custom Scuttlebutt federation layer would duplicate identity, signing, delivery, retry, room membership, abuse, and compatibility work already addressed by Matrix.

## Decision

Matrix homeservers are the federation boundary. Scuttlebutt will use Matrix server discovery, federation signing, room membership, and cross-server event delivery. The platform API is local to an operator and is not a global authority. Friend-code discovery is a convenience layer, not a replacement for Matrix identities or federation.

Federation work is staged: local single-homeserver flows first, then multiple local homeservers, then cross-server DMs/rooms/invites, then allow/block and outage policies.

## Consequences

- Users can retain identities at their chosen homeserver.
- Scuttlebutt cannot control the availability, retention, moderation policy, or metadata practices of other homeservers.
- Community “servers” must be carefully distinguished from physical Matrix homeservers.
- Cross-server calls need MatrixRTC backend discovery/selection and may fail independently of messaging federation.

## Rejected alternative

A custom peer-to-peer or server-to-server Scuttlebutt protocol is rejected for the initial product because it creates a new security-critical protocol with no ecosystem compatibility.
