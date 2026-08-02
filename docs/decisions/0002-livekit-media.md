# ADR-0002: LiveKit and MatrixRTC for realtime media

- Status: Accepted for implementation, subject to Phase 6 proof of concept
- Date: 2026-08-02

## Context

Voice, video, and screen sharing need multi-user scaling, adaptive subscriptions, simulcast, TURN compatibility, reconnection, device SDKs, and optional E2EE. A browser-only peer-to-peer mesh will not scale to community calls.

## Decision

Use self-hosted LiveKit as the initial WebRTC SFU. Use MatrixRTC-compatible room signaling and backend discovery so Matrix rooms define membership and call context. A small MatrixRTC authorization service/platform API issues short-lived, room-bound LiveKit JWTs after checking the user's Matrix membership and Scuttlebutt permissions. Use Coturn for authenticated STUN/TURN relay support.

Enable and test LiveKit media/data E2EE explicitly. Do not claim that SFU transport encryption alone is end-to-end encryption.

Start quality work at 1080p30 and expose actual transmitted resolution/FPS/codec/bitrate/latency/packet loss. 4K60 is an optional capability, never a baseline promise.

## Alternatives considered

- Jitsi Meet: strong self-hosted conferencing and mobile ecosystem, but it is a separate meeting stack and does not fit room-native Matrix identity as tightly.
- Direct WebRTC mesh: simple for tiny calls, but poor bandwidth/CPU scaling.
- Mumble: excellent low-latency voice reference, not a web-first messaging/media platform.
- Hosted LiveKit Cloud: operationally easier, but violates the self-hosted default and increases central-service dependence.

## Consequences

LiveKit gives Scuttlebutt a strong media primitive, but media infrastructure becomes a distinct operational subsystem. The authorization bridge, TURN deployment, media quotas, and E2EE key distribution need dedicated tests.
