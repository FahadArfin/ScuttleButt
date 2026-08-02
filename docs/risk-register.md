# Initial risk register

Scoring: Likelihood (L) and impact (I) are Low/Medium/High. Priority is a qualitative combination. Owners are roles, not assigned people yet.

| ID    | Risk                                                                                            |      L |      I | Priority | Mitigation / trigger                                                                                                | Owner               |
| ----- | ----------------------------------------------------------------------------------------------- | -----: | -----: | -------: | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| R-001 | The scope combines a federated messenger, encrypted storage, SFU media, desktop, and mobile.    |   High |   High | Critical | Keep phase gates strict; do not pull later features into Phase 1.                                                   | Product/engineering |
| R-002 | Matrix E2EE UX, recovery, and cross-device behavior are harder than basic message sending.      |   High |   High | Critical | Use established SDK crypto; make verification/recovery acceptance tests release gates.                              | Client/security     |
| R-003 | Browser JavaScript compromise defeats client-side E2EE.                                         | Medium |   High |     High | CSP, supply-chain controls, release integrity, security review, desktop option.                                     | Client/security     |
| R-004 | LiveKit E2EE may conflict with browser support, moderation expectations, or MatrixRTC maturity. | Medium |   High |     High | Validate a local three-user proof of concept before committing to broad call claims.                                | Realtime            |
| R-005 | 4K60 screen sharing is unavailable or unstable on common devices/networks.                      |   High | Medium |     High | Start at 1080p30, display actual stats, use adaptive fallback, never label lower quality as 4K.                     | Realtime/client     |
| R-006 | Federation increases failure modes, abuse surface, and operational complexity.                  |   High |   High | Critical | Defer cross-server feature work until local single-homeserver flows pass; use Matrix behavior.                      | Platform            |
| R-007 | Friend codes enable account enumeration or social-graph scraping.                               | Medium |   High |     High | High entropy, revocation, privacy-preserving errors, rate limits, approval gates.                                   | Platform/security   |
| R-008 | AGPL/commercial dual licensing or mixed-license references cause distribution obligations.      | Medium |   High |     High | Maintain per-component SPDX/license inventory; do not copy code before review.                                      | Maintainers/legal   |
| R-009 | Self-hosting is too complex for nontechnical operators.                                         |   High |   High |     High | Provide a small Compose dev path, generated secrets, health checks, backup/restore docs, and production separation. | DevOps              |
| R-010 | Media bandwidth and TURN relay costs overwhelm small operators.                                 |   High |   High |     High | Per-server quotas, connection limits, bitrate caps, metrics, TURN authentication, capacity guide.                   | DevOps/realtime     |
| R-011 | E2EE makes automatic moderation and server-side search impossible or misleading.                |   High |   High | Critical | Client-assisted reports, local decrypted search, clear limits in product copy.                                      | Product/safety      |
| R-012 | Object storage leaks public or encrypted attachments.                                           | Medium |   High |     High | Private buckets, signed URLs, client encryption, MIME/size validation, cleanup and audit.                           | Platform/storage    |
| R-013 | A large custom backend becomes a second monolithic platform.                                    | Medium |   High |     High | Keep product API small; put messaging/federation in Matrix and media in LiveKit.                                    | Architecture        |
| R-014 | Desktop auto-update or deep-link handling creates supply-chain or token theft paths.            | Medium |   High |     High | No auto-update until signing/update security is designed; restrict Tauri capabilities.                              | Desktop/security    |
| R-015 | Upstream availability, governance, or API changes invalidate assumptions.                       | Medium | Medium |   Medium | Pin versions, maintain adapters, monitor upstream release/security notes, test upgrades.                            | Maintainers         |
| R-016 | Backups preserve deleted content or cryptographic material longer than users expect.            | Medium |   High |     High | Document retention, encrypted backup keys, deletion scope, and restore behavior.                                    | DevOps/privacy      |

## Top three risks to resolve first

1. R-002: validate Matrix SDK E2EE and recovery assumptions before building a broad messaging UX.
2. R-004: validate MatrixRTC/LiveKit authorization and E2EE in a small local call proof of concept.
3. R-008: decide Scuttlebutt's project license and automate third-party license review before adding dependencies.
