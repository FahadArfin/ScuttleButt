# Preliminary threat model

Status: Phase 0 baseline. This is a design input, not a security review or a claim that any implementation is secure.

## Security objectives

1. Message and attachment plaintext is available only to intended verified devices when E2EE is enabled.
2. Private keys never leave their owning device except through an explicitly designed encrypted backup/recovery flow.
3. Homeserver, platform API, SFU, TURN server, object storage, and observability systems receive only the minimum data required for their role.
4. Administrators can moderate their deployment honestly without pretending they can inspect E2EE content server-side.
5. Authentication, federation, uploads, media tokens, and friend-code lookup resist common abuse and enumeration attacks.
6. A compromised server cannot silently rewrite signed Matrix history or forge a verified device, although it can deny service and observe metadata available to it.

## Assets

| Asset                                                            | Impact if compromised                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Matrix account credentials, access tokens, refresh/session state | Account takeover and device impersonation.                                       |
| Device private keys and recovery keys                            | Decryption of historical/future messages, depending on backup and session state. |
| Message and attachment plaintext                                 | Severe privacy breach and moderation/reporting abuse.                            |
| Room membership and friend-code mappings                         | Social graph exposure, targeted spam, enumeration.                               |
| LiveKit signing secret and media JWTs                            | Unauthorized room access or media publication.                                   |
| Object-storage credentials and attachment URLs                   | Bulk data exposure, deletion, or ransomware-style damage.                        |
| Federation signing keys and server name                          | Federation impersonation or prolonged outage.                                    |
| Admin/moderation capabilities                                    | Unbounded abuse, privacy violations, or service destruction.                     |
| Logs, telemetry, backups, and crash reports                      | Secondary plaintext or credential leakage.                                       |

## Actors

- **Unauthenticated internet attacker:** scans endpoints, abuses registration, uploads, friend lookup, federation, or media joins.
- **Authenticated malicious user:** spams, phishes, uploads malware, abuses invitations, or attempts to escalate permissions.
- **Malicious community administrator:** can control local policy and metadata, but must not be able to forge client cryptographic trust.
- **Compromised homeserver operator:** can read metadata, drop/withhold traffic, and serve malicious client assets if deployment is not integrity-protected; should not read E2EE plaintext from storage.
- **Malicious federated homeserver:** can send malformed events, impersonation attempts, spam, or traffic intended to exhaust resources.
- **Compromised platform/API host:** can mint friend-code responses, invites, and media tokens within its scope; must not hold message decryption keys.
- **Compromised client or browser extension:** can read plaintext at the point of use; E2EE cannot protect against a compromised endpoint.
- **Supply-chain attacker:** modifies dependencies, build pipeline, hosted assets, or release artifacts.

## Trust-boundary threats and mitigations

| Boundary / threat        | Likely abuse                                                                   | Phase 0 mitigation direction                                                                                                                                   | Residual risk                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Client ↔ web assets      | XSS or malicious bundle steals decrypted content and keys.                     | Strict CSP, no unsafe HTML, dependency pinning/audit, signed/reproducible releases where practical, Trusted Types investigation, security headers.             | A server/operator controlling served JavaScript can still attack users unless clients pin or verify trusted releases. |
| Client ↔ homeserver      | Token theft, CSRF, replay, downgrade, hostile server responses.                | TLS, secure session design, device IDs, revocation, validation, CSRF protection where cookies are used, explicit server trust UX.                              | A homeserver can deny service and observe metadata.                                                                   |
| Homeserver ↔ federation  | Event forgery, replay, malformed events, resource exhaustion, remote spam.     | Use Matrix federation implementation; validate signatures and limits; allow/block lists and federation rate limits; do not implement custom signing.           | Federation is complex and outages/abuse remain possible.                                                              |
| Client E2EE              | Key loss, unsafe backup, unverified devices, session confusion.                | Matrix SDK crypto, device verification, recovery-key UX, encrypted key backup, per-device key isolation, tests for cross-device restore.                       | Recovery UX may trade availability for confidentiality; compromised endpoints remain out of scope.                    |
| API friend-code lookup   | Enumeration, scraping, correlation, account discovery.                         | High-entropy normalized codes, revocation/regeneration, constant-shaped errors, rate limits, abuse monitoring without exposing profile data.                   | A determined observer can correlate approved contacts and timing.                                                     |
| API media-token issuance | Forged claims or long-lived tokens let attackers join/publish.                 | Server-side Matrix membership/permission checks, short TTL JWTs, audience/room/identity binding, secret rotation, no token logging.                            | API compromise or LiveKit secret compromise still impacts calls.                                                      |
| WebRTC / LiveKit         | SFU reads media, room hijacking, bitrate/CPU exhaustion, token replay.         | Explicit LiveKit E2EE, short-lived grants, participant authorization, resource limits, diagnostics, reconnect/fallback.                                        | SFU sees metadata and traffic patterns; browser support for E2EE and high-quality capture varies.                     |
| TURN                     | Relay abuse, bandwidth theft, IP metadata, open relay.                         | Authenticated TURN REST credentials, quotas, TLS where appropriate, no open relay, monitoring and expiration.                                                  | TURN sees connection metadata and can be a high-cost DoS target.                                                      |
| Object storage           | Public bucket, confused-deputy upload, malware, path traversal, orphaned data. | Private buckets, signed short-lived URLs, client encryption for E2EE rooms, MIME/size validation, malware scanning for unencrypted policy paths, cleanup jobs. | Encrypted content cannot be server-scanned without violating the boundary.                                            |
| Admin/moderation         | Overbroad permissions, insider abuse, irreversible actions.                    | Small initial role model, server-side authorization, audit log, confirmation for destructive actions, client-assisted reports.                                 | E2EE limits server-side content moderation; operators control retention and local policy.                             |
| Backups                  | Restore leaks keys/plaintext or creates inconsistent crypto state.             | Encrypt backups, separate key custody, document restore, test restore and session/device behavior.                                                             | Backups are attractive targets and may preserve data after user deletion.                                             |
| Supply chain / CI        | Dependency or build compromise ships malicious client.                         | Lockfiles, Renovate/Dependabot, secret scanning, SAST, protected CI, artifact provenance, review of high-risk dependencies.                                    | No process eliminates a fully compromised signing/build authority.                                                    |
| Availability             | Registration, federation, uploads, or calls exhaust resources.                 | Rate limits, quotas, bounded parsing, queueing, circuit breakers, per-server policies, load tests, operational alerts.                                         | Self-hosters still need capacity planning and DDoS protection.                                                        |

## STRIDE checklist for Phase 1

- **Spoofing:** server-side auth, Matrix device IDs, token audience/expiry, no client-supplied admin claims.
- **Tampering:** TLS, Matrix signatures, schema validation, immutable event IDs, protected CI.
- **Repudiation:** redacted structured audit logs for administrative actions; never log message plaintext or keys.
- **Information disclosure:** CSP, secure headers, redacted telemetry, private object storage, E2EE boundary labels.
- **Denial of service:** rate limits and quotas on auth, friend codes, uploads, federation, and media joins.
- **Elevation of privilege:** centralized permission checks, least-privilege API tokens, explicit role tests.

## Security release gates

Before Phase 2, Phase 1 must have a documented trust model, no secrets in source control, dependency/license checks, basic security headers, typed validation at API boundaries, and CI checks. Before encrypted messaging is called usable, cross-device verification/recovery and the “homeserver stores ciphertext, not plaintext” assumption must be tested against the actual Matrix deployment.

## Honest user-facing claims

Scuttlebutt may claim encrypted message/media content only when the client has enabled and verified the relevant E2EE path. It must disclose that homeservers and TURN/SFU services can see metadata, timing, membership, IP information, and traffic volume, and that a compromised client can read content at the point of use.
