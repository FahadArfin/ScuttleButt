# Phase 6 report — voice proof-of-concept foundation

Date: 2026-08-02

Phase 6 establishes the self-hosted LiveKit/Coturn voice boundary without putting media secrets in the browser. The client package uses the current LiveKit JavaScript v2 API and keeps the room token, room key, ICE credentials, and connection state behind an explicit interface.

## Delivered

- `@scuttlebutt/livekit-client` wrapper around LiveKit v2.21.0.
- Strict `ws://`/`wss://` endpoint validation and local JWT claim decoding for safe expiration checks before connection attempts.
- Room join/leave, microphone mute, deafening by unsubscribing remote audio, input/output device switching, audio playback start, speaking indicators, participant connection quality, reconnecting/reconnected state, and failure propagation.
- Optional short-lived `RTCIceServer[]` credentials for Coturn fallback, passed through LiveKit’s `rtcConfig` connection option.
- Required-by-default media E2EE boundary using `ExternalE2EEKeyProvider` plus a caller-supplied dedicated E2EE worker. The key is never logged.
- Local Redis, LiveKit, and Coturn Compose files with explicit UDP/TCP media and relay ports, LiveKit TCP fallback, and development-only placeholder credentials.
- Web voice-channel preview with participant cards, speaking/quality states, mute/deafen controls, device selectors, reconnect/TURN/E2EE status copy, and a prominent “preview only” boundary.
- Unit coverage for token validation and Playwright coverage for the voice control flow.

## Acceptance status

The client-side safety and state-machine foundation is implemented and tested. The full Phase 6 acceptance criteria are not yet claimed complete: three independent browser sessions have not been run against a live local SFU, a constrained TURN-only network has not been exercised, and the authenticated MatrixRTC/platform token issuer is still required. Those tests must happen before marking Phase 6 complete.

The local Compose configuration follows the LiveKit self-hosting model: signaling/API on 7880, ICE/TCP on 7881, UDP media ports, and Coturn relay ports. Production requires TLS, stable DNS, external secrets, public IP/firewall configuration, and a real token service.

## Verification

The foundation passes:

```text
pnpm check
pnpm build
pnpm test:e2e
```

Reference: [LiveKit JS client SDK](https://docs.livekit.io/reference/client-sdk-js/), [LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/), and [LiveKit firewall ports](https://docs.livekit.io/transport/self-hosting/ports-firewall/).
