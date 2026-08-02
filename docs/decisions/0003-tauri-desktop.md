# ADR-0003: Tauri as the desktop shell

- Status: Accepted for Phase 8, not part of Phase 1
- Date: 2026-08-02

## Context

The web client cannot reliably provide global push-to-talk, system tray behavior, OS keychain storage, deep links, background audio, or desktop capture policy. A desktop client should reuse the web UI and protocol packages.

## Decision

Use Tauri for the desktop application after the web client and protocol boundaries are stable. Keep most behavior in shared web packages. Add narrow, capability-scoped native commands for secure storage, notifications, tray, deep links, capture, and device integration. Use OS secure storage rather than plaintext files. Do not implement automatic updates until artifact signing, update authorization, rollback, and key rotation are designed.

## Alternative considered

Electron has a larger ecosystem and is used by Element Desktop, but it carries a larger runtime footprint and a broader native surface for this project. It remains a fallback if Tauri cannot support required capture or device APIs.

## Consequences

The desktop client inherits the web client's security and release pipeline while adding OS-specific permissions and packaging. Desktop capability allowlists and release builds become security-sensitive.
