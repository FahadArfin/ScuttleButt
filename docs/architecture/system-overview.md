# Scuttlebutt system overview

Status: Phase 0 architecture baseline. This document describes the intended boundaries; it is not a production deployment guide.

## Goals

- Federated messaging through Matrix homeservers.
- E2EE for message content and encrypted attachments where Matrix supports it.
- Self-hosted voice/video/screen sharing through LiveKit and Coturn.
- A usable web client first, with a Tauri desktop client reusing the web frontend later.
- A small platform API only for product features that do not belong in Matrix.
- A deployment path from a local Compose environment to independently operated production components.

## Non-goals for the first implementation

- No custom federation protocol.
- No custom cryptography.
- No global Scuttlebutt account directory.
- No server-side plaintext indexing of encrypted messages.
- No guaranteed 4K60 streaming.
- No mobile application in the initial milestones.
- No subscription gates in the application feature model.

## Proposed monorepo

```text
scuttlebutt/
├── apps/
│   ├── web/                         # React + TypeScript + Vite client
│   ├── platform-api/                # Small Node.js/TypeScript product API
│   ├── desktop/                     # Tauri shell, added after web stability
│   └── docs/                        # Project documentation site, later
├── packages/
│   ├── ui/                          # Accessible shared components
│   ├── config/                      # Shared typed config and environment schema
│   ├── shared-types/                # API and event contracts
│   ├── friend-codes/                # Pure generation/normalization contracts
│   ├── matrix-client/               # Matrix SDK boundary and adapters
│   ├── livekit-client/              # LiveKit/MatrixRTC boundary
│   ├── crypto-boundaries/            # Key-storage and E2EE policy interfaces
│   └── testing/                     # Test fixtures and safe fake services
├── infrastructure/
│   ├── compose/                     # Local development stack
│   ├── matrix/                      # Synapse config templates
│   ├── livekit/                     # LiveKit config templates
│   ├── coturn/                      # TURN config templates
│   └── reverse-proxy/               # Caddy/Traefik examples
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── deployment/
│   ├── development/
│   ├── research/
│   └── security/
├── scripts/
├── .github/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Runtime topology

```mermaid
flowchart TB
    subgraph Devices[User devices]
        Browser[Web browser\nReact/Vite client]
        Desktop[Tauri desktop client\nreuses web packages]
    end

    subgraph Edge[Self-hosted edge]
        Proxy[Reverse proxy\nTLS, CSP, routing]
    end

    subgraph App[Scuttlebutt deployment]
        Web[Static web assets]
        API[Platform API\nfriend codes, invites, media tokens]
        RTCAuth[MatrixRTC / LiveKit auth\nshort-lived JWTs]
    end

    subgraph Messaging[Matrix messaging]
        HS[Synapse homeserver\nidentities, rooms, federation]
        DB[(PostgreSQL)]
    end

    subgraph Media[Realtime and object storage]
        LK[LiveKit SFU\nvoice, video, screen share]
        TURN[Coturn\nSTUN/TURN relay]
        S3[(S3-compatible storage\nMinIO in development)]
    end

    Other[Other Matrix homeservers]

    Browser --> Proxy
    Desktop --> Proxy
    Proxy --> Web
    Proxy --> API
    Proxy --> HS
    Proxy --> RTCAuth
    Browser -. Matrix Client-Server API .-> HS
    Desktop -. Matrix Client-Server API .-> HS
    HS <--> Other
    HS --> DB
    API --> DB
    API --> S3
    RTCAuth --> LK
    Browser -. WebRTC media .-> LK
    Desktop -. WebRTC media .-> LK
    Browser -. ICE relay .-> TURN
    Desktop -. ICE relay .-> TURN
```

## Trust boundaries

1. **Client boundary:** decrypted message content and private cryptographic keys live on the user's device. Compromised browser JavaScript is a release-blocking confidentiality risk.
2. **Homeserver boundary:** Synapse stores encrypted events and unavoidable metadata; it can authenticate, route, federate, retain, and deny service, but should not receive message plaintext for E2EE rooms.
3. **Platform API boundary:** Scuttlebutt's API handles non-Matrix product metadata such as friend-code mappings, invitations, feature policy, and LiveKit token issuance. It must not become a plaintext message proxy.
4. **Media boundary:** LiveKit forwards encrypted media. Transport encryption is not automatically media E2EE; the client must explicitly enable and verify LiveKit E2EE.
5. **Storage boundary:** Encrypted-room attachments are encrypted client-side before object storage. Public/un-encrypted media follows server policy and must be labeled accordingly.
6. **Federation boundary:** Other homeservers are independent operators. Cross-server data and availability are not fully controllable by Scuttlebutt.

## Data ownership and placement

| Data                                          | Primary system                                    | Confidentiality expectation                                            |
| --------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Matrix user identity, device/session metadata | Synapse                                           | Server-visible metadata; protect with TLS and access controls.         |
| Encrypted message events                      | Synapse/PostgreSQL                                | Ciphertext at rest; clients hold keys.                                 |
| Friend-code mapping                           | Platform API/PostgreSQL or homeserver-owned store | Pseudonymous, rate-limited, revocable; avoid public enumeration.       |
| LiveKit room token                            | Platform API / MatrixRTC auth                     | Short-lived bearer credential; never log.                              |
| Voice/video/screen media                      | LiveKit + TURN                                    | WebRTC transport encryption plus explicit LiveKit E2EE where enabled.  |
| Encrypted attachments                         | S3-compatible storage                             | Client-encrypted before upload; object key is not a decryption key.    |
| Logs and metrics                              | Operator-controlled observability                 | No message plaintext, encryption keys, access tokens, or media tokens. |

## Deployment profiles

### Development

One Compose project may include the web client, platform API, Synapse, PostgreSQL, LiveKit, Coturn, MinIO, reverse proxy, and a mail catcher. Development secrets may be generated locally and must never be reused in public deployments.

### Production

Components may be split across hosts or clusters. PostgreSQL and S3 should be backed up independently; LiveKit and Coturn require public networking and bandwidth planning; Synapse federation requires stable server names, TLS, reverse-proxy correctness, and time synchronization. Production configuration must use external secrets and a documented restore test.

## Key sequence: encrypted direct message

```mermaid
sequenceDiagram
    participant A as Client A
    participant HS as Homeserver A
    participant F as Federated homeserver(s)
    participant B as Client B

    A->>A: Encrypt event with Matrix SDK/device keys
    A->>HS: Send ciphertext event
    HS->>F: Federate signed event if recipients are remote
    F->>B: Deliver ciphertext event
    B->>B: Verify device/session and decrypt locally
```

## Key sequence: room call

```mermaid
sequenceDiagram
    participant C as Client
    participant HS as Matrix homeserver
    participant Auth as MatrixRTC auth service
    participant LK as LiveKit SFU
    participant TURN as Coturn

    C->>HS: Join room / publish call-member state
    C->>Auth: Request short-lived media token
    Auth->>LK: Authorize room and participant
    Auth-->>C: LiveKit URL + short-lived JWT + E2EE metadata
    C->>LK: Join via WebRTC
    C-->>TURN: Use relay if direct ICE paths fail
    LK-->>C: Forward encrypted media tracks
```

## Architecture constraints

- Use the Matrix JS/TypeScript SDK and maintained Rust/WASM crypto implementation; do not write cryptographic primitives.
- Keep platform API authorization separate from Matrix room authorization. The client must never be trusted to assert moderator/admin permissions.
- Make actual media properties observable to the user: resolution, FPS, codec, bitrate, latency, and packet loss.
- Treat Matrix rooms/spaces as the primitive mapping behind Scuttlebutt communities, and document any feature that cannot map cleanly.
- Prefer stable, boring interfaces over a large custom backend.
