# Phase 5 report — community servers and channels foundation

Date: 2026-08-02

Phase 5 adds the first community-server model on top of Matrix spaces and rooms. “Community server” is a user-facing workspace concept; the physical homeserver remains the Matrix service that hosts identities, spaces, rooms, and federation data.

## Delivered

- `@scuttlebutt/community` domain package with community creation, categories, text/announcement/forum/voice channel kinds, members, invitations, roles, and small permission sets.
- Role-gated member invitations, channel pin records, thread records, and custom emoji records with validation.
- Matrix mapping helpers for private `m.space` creation, encrypted child channels, `m.space.parent`/`m.space.child` relations, power-level event thresholds, pinned events, and `im.ponies.room_emotes` payloads.
- `MatrixCommunityAdapter` methods for creating spaces/channels, inviting and joining members, setting pinned events, and applying basic event power levels.
- Web navigation grouped by the demo community’s categories, with announcement, text, forum, voice, and direct-message entries.
- Community profile copy that explicitly distinguishes “Northstar Lab” from its `http://localhost:8008` homeserver.
- Unit coverage for domain permissions and Matrix state payloads, plus browser coverage for the channel-based message workspace.

## Boundary and deferred work

The first permission system intentionally maps only product-level actions to Matrix event thresholds; it is not a complete moderation policy engine. A live integration fixture still needs to create a real space and child rooms against Synapse, verify federated membership, and exercise custom emoji media permissions. Those checks belong alongside the later federation-hardening work.

The web preview continues to use deterministic local data until browser Matrix session restoration and the authenticated community API are connected. No homeserver-wide administrator capability is implied by the “community server” UI.

## Verification

The Phase 5 implementation passes:

```text
pnpm check
pnpm build
pnpm test:e2e
```
