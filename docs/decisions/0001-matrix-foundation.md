# ADR-0001: Matrix as the messaging and federation foundation

- Status: Accepted for implementation, subject to Phase 2 validation
- Date: 2026-08-02

## Context

Scuttlebutt needs federated identities, direct messages, group rooms, community spaces, message sync, device management, E2EE, encrypted attachments, reactions, replies, threads, and read/typing state. Building a new protocol would multiply security and interoperability risk.

## Decision

Use the Matrix protocol and a compatible Synapse homeserver for the initial messaging foundation. Use a maintained Matrix JavaScript/TypeScript SDK and its supported crypto implementation at the client boundary. Model a Scuttlebutt community as a product layer over Matrix spaces and rooms, with documented gaps where the concepts do not map exactly.

Scuttlebutt will not fork Synapse or implement a custom federation protocol in the initial product.

## Consequences

Positive:

- Federation, room semantics, identity, device concepts, and E2EE are inherited from an established ecosystem.
- The web client can interoperate with Matrix infrastructure and existing clients where compatible.
- Homeserver and client concerns remain separable from Scuttlebutt-specific UX.

Costs and risks:

- Matrix semantics and E2EE UX are complex.
- Synapse is operationally substantial and AGPL/commercially dual-licensed.
- Matrix metadata, history, permissions, and “server” semantics do not perfectly match Discord.

## Validation

Phase 2 must prove two local users can register, verify devices, create an encrypted room, exchange messages, restore a session, revoke a device, and recover keys under the documented assumptions.
