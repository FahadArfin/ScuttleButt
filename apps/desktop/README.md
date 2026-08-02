# Scuttlebutt Desktop

This is the Phase 8 Tauri shell. It loads the shared `apps/web` frontend and
keeps native authority in a small Rust command surface under `src-tauri`.

## Requirements

- Node.js 22.14.0
- pnpm 11.9.0
- Rust and Cargo
- Windows WebView2 and the Windows C++ build tools on Windows

The Tauri prerequisites vary by operating system. Install them before running
the native commands below. The repository's ordinary web checks do not require
Rust.

## Run

```bash
pnpm install
pnpm desktop:dev
```

Build the native bundle with:

```bash
pnpm desktop:build
```

The shell intentionally has no updater plugin or unsigned update artifact
configuration. Release signing, update authorization, rollback, and key
rotation must be designed before updates are added.
