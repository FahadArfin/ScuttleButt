# Local LiveKit and Coturn environment

Phase 6 adds a local voice proof-of-concept stack. It is intentionally separate from the Matrix Compose project because LiveKit access tokens and media relay credentials belong to a short-lived voice-token boundary, not to Synapse.

## Start the stack

```bash
docker compose -f infrastructure/livekit/docker-compose.yml up -d
```

The LiveKit signaling endpoint is `ws://127.0.0.1:7880`. Coturn listens on UDP/TCP `3478` and relays a development-only port range `49152-49200/udp`.

The checked-in keys are development placeholders only. A token issuer must sign short-lived participant tokens server-side with the LiveKit API secret and must never return that secret to the browser or log tokens. The browser client also rejects malformed and expired JWTs before trying to connect.

The local configuration advertises Coturn through LiveKit’s `rtc.turn_servers` configuration and enables TCP fallback. On Linux, host networking or an explicit external IP may be needed for clients outside Docker; production deployments require TLS, stable DNS, firewall rules, and certificates. LiveKit’s official deployment guidance lists signaling/API port 7880, ICE/TCP 7881, UDP media ports, and TURN ports as network concerns.

Stop the stack with:

```bash
docker compose -f infrastructure/livekit/docker-compose.yml down
```

This stack does not claim that three users have already completed a media call. That acceptance test requires three independent browser sessions, valid server-issued tokens, microphone permissions, and a TURN-constrained network test.
