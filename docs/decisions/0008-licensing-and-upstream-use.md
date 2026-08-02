# ADR-0008: Licensing and upstream use

- Status: Proposed; owner/legal confirmation required before the first distributable code release
- Date: 2026-08-02

## Context

The reference ecosystem mixes Apache-2.0, MIT, BSD-style, AGPL, commercial dual licenses, and per-directory or per-component exceptions. “Open source on GitHub” is not enough permission to copy code or trademarks.

## Decision

For Phase 0 and Phase 1, Scuttlebutt will study upstream architecture and consume upstream services/SDKs through documented interfaces; it will not copy implementation code. Every dependency added in Phase 1 must have an SPDX identifier, pinned version, source URL, and license review recorded in the project notices.

Before the first distributable release, choose and publish a project license. The recommended default is AGPL-3.0-or-later for Scuttlebutt-owned network-facing server/API code so hosted modifications remain available to users, with a separate decision if reusable client libraries need a permissive license. This recommendation is not legal advice.

Preserve upstream notices and trademarks. Treat Synapse, Element Web, Element Call, Stoat, and Mattermost as high-attention references because their licensing is not a simple single permissive license across every component.

## Consequences

- A dependency/license report is a release gate.
- Reuse by protocol/API compatibility is preferred over source copying.
- UI names, logos, and trademarks need separate review even when code is reusable.
- The final project license may affect contributions, plugins, and downstream packaging.
