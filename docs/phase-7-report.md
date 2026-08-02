# Phase 7 report — video and screen-sharing foundation

Date: 2026-08-02

Phase 7 extends the existing LiveKit room boundary for camera capture, browser display capture,
quality selection, adaptive subscriptions, fullscreen viewing, and measured diagnostics. The
default quality budget is intentionally conservative: 720p30 and 1080p30 are available, while
1080p60, 1440p30, and 4K60 remain disabled until a device and network budget has been measured.

## Delivered

- `VideoClient` bound to the existing `VoiceClient` room, so audio and video do not require
  separate LiveKit sessions.
- Webcam capture with camera simulcast, `maintain-framerate` degradation preference, and a
  quality fallback chain that steps down instead of disconnecting when a higher mode fails.
- Display capture for entire screens, application windows, and browser tabs.
- Optional system-audio capture with a video-only fallback for browsers or surfaces that reject
  system audio.
- Remote video quality and subscription controls using LiveKit adaptive subscriptions.
- Video track attachment for local and remote fullscreen viewers.
- Sender and receiver diagnostics sourced from LiveKit video stats: resolution, FPS, codec,
  bitrate, packet loss, and round-trip time where available.
- Web preview surface with explicit unsupported-mode labels, fullscreen control, capture source
  selection, and a diagnostics panel that labels its values as preview samples until a live room
  is connected.
- Unit and Playwright coverage for the quality budget, fallback ordering, capture options, and
  disabled 4K60 UI state.

## Acceptance status

The client and UI foundation is implemented, but Phase 7 is not marked fully accepted yet. A
real camera/display session still needs to be run against the local LiveKit/Coturn environment,
with CPU and bandwidth measurements recorded for each enabled mode. Fullscreen and system-audio
behavior also need browser matrix coverage, because display-surface and system-audio support are
browser- and operating-system-dependent.

The preview intentionally does not claim that its sample metrics are live media. Actual values
come from `VideoClient.getVideoDiagnostics()` after a server-issued short-lived LiveKit token and
the Phase 6 E2EE worker are supplied.

## Quality policy

| Mode       | Target  | Default status | Reason                                                        |
| ---------- | ------- | -------------- | ------------------------------------------------------------- |
| Data saver | 720p30  | Enabled        | Conservative bandwidth and CPU floor                          |
| Balanced   | 1080p30 | Enabled        | Phase 7 starting point                                        |
| Smooth     | 1080p60 | Disabled       | Requires measured frame-rate and CPU support                  |
| Sharp      | 1440p30 | Disabled       | Requires measured resolution and bandwidth support            |
| Ultra      | 4K60    | Disabled       | No unsupported 4K60 claim; requires explicit hardware testing |

The controller configures LiveKit `adaptiveStream` and camera simulcast. Screen sharing favors
resolution preservation and uses a lower frame-rate ceiling for readable text. Production policy
must add per-deployment bitrate limits and telemetry before enabling higher modes.

## Verification

```text
pnpm check
pnpm build
pnpm test:e2e
```

The implementation uses the pinned LiveKit JavaScript v2 dependency and its documented track,
simulcast, adaptive-stream, and self-hosted media APIs. See the [LiveKit JS client SDK](https://docs.livekit.io/reference/client-sdk-js/),
[self-hosted deployment guide](https://docs.livekit.io/transport/self-hosting/deployment/), and
[firewall/port guide](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## Security implications

- Camera and display permissions remain browser-controlled; the client never fabricates a grant.
- LiveKit tokens, ICE credentials, and E2EE keys stay outside the video controller API and must be
  issued by the authenticated server boundary.
- RTCP diagnostics are metadata, not media plaintext, but should still be treated as sensitive
  operational data and excluded from message logs.

## Recommended next task

Connect `VideoClient` to the authenticated Phase 6 token issuer, run three-browser camera and
screen-share tests through LiveKit/Coturn, and record CPU, bandwidth, resolution, FPS, and packet
loss before enabling any disabled quality mode.
