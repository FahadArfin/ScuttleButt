# Phase 8 report — desktop application foundation

**Status:** Foundation in progress  
**Date:** 2026-08-02

## Delivered

- Added `apps/desktop`, a Tauri 2 shell that reuses the built `apps/web` frontend.
- Added `@scuttlebutt/desktop-bridge` for a shared web/desktop boundary covering Matrix session validation, secure storage, notifications, deep links, push-to-talk, and runtime diagnostics.
- Added Rust commands under `apps/desktop/src-tauri`:
  - `store_session`, `load_session`, and `clear_session` use the platform keychain through `keyring`.
  - `send_notification` uses the Tauri notification plugin with bounded input.
  - `set_push_to_talk_enabled` registers only `CommandOrControl+Shift+Space`.
  - `desktop_diagnostics` returns capability status without secrets.
- Added a system tray with show and quit actions. Closing the main window hides it so the tray can restore it.
- Registered the `scuttlebutt://` desktop scheme. The shared bridge accepts only `login`, `open`, and `friend` hosts and rejects userinfo, ports, and fragments.
- Added a capability file and application permission set with no filesystem, shell, HTTP-client, or updater permissions.
- Added explicit `pnpm desktop:dev` and `pnpm desktop:build` commands. Bundling is disabled until icons, signing, packaging, and release policy are designed.
- Added separate Tauri development and production overlays with distinct app identifiers and debug keychain namespaces.
- Added the desktop runtime indicator to the shared web shell; web and desktop continue to use the same messaging and LiveKit packages.

## Security decisions

Credentials are serialized only for the narrow IPC call and are stored in the operating system credential store. The bridge never uses `localStorage` or a plaintext desktop file for sessions, and native code does not log session values. Deep-link URLs are untrusted input; the bridge filters their shape before handing them to application code. No updater plugin or unsigned update artifact is present.

## Verification

Passed:

- `pnpm install`
- `pnpm --filter @scuttlebutt/desktop-bridge lint`
- `pnpm --filter @scuttlebutt/desktop-bridge typecheck`
- `pnpm --filter @scuttlebutt/desktop-bridge test`
- `pnpm --filter @scuttlebutt/desktop-bridge build`
- `pnpm --filter @scuttlebutt/web lint`
- `pnpm --filter @scuttlebutt/web typecheck`
- `pnpm --filter @scuttlebutt/web build`

Not run in this environment:

- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pnpm desktop:dev`
- OS keychain, tray, notification, deep-link, device-selection, screen-capture, and global-shortcut runtime tests

Rust/Cargo is not installed here, so native compilation and OS integration remain a follow-up verification step. The desktop login form and authenticated Matrix login/restore wiring also remain before Phase 8 can be called complete; this commit establishes their secure session contract.

## Next desktop work

1. Install Rust, WebView2, and platform build tools, then run native checks on Windows, macOS, and Linux.
2. Connect the existing `ScuttlebuttMatrixClient.login` and `restore` flows to the desktop bridge without exposing credentials to web storage.
3. Exercise deep-link code exchange, notifications, tray lifecycle, device selection, screen capture, and push-to-talk on supported operating systems.
4. Define signed packaging and update authorization before enabling any update channel.
