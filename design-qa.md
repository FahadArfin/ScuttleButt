# Design QA

References: the supplied Discord voice-room, voice settings, profile, and presence screenshots.

- Voice room opens from the channel name and adds the local user to the connected list.
- Connected users appear beneath the voice channel and in the dedicated call stage.
- Speaking user gets a green ring only after microphone activity crosses the configured threshold; an unmuted but quiet user remains in the neutral listening state.
- Joined view contains mute, camera, screen/application share, soundboard, settings, and leave controls.
- Muted state changes the control to red and updates its accessible label.
- Message icon beside the voice-room title replaces the participant panel with persistent voice chat.
- Stream 4K and Open buttons are absent after joining.
- Voice settings expose microphone/speaker selection and volume, a live microphone meter, isolation/studio/custom profiles, automatic voice activity, push-to-talk, and sensitivity.
- Profile settings accept PNG, JPEG, GIF, or WebP uploads up to 5 MB and provide display name, biography, status, profile color, and a live Discord-style preview.
- Voice settings and profile customization were each compared side-by-side with their supplied Discord reference at a 1445 x 1272 desktop viewport (DPR 1).
- Browser QA confirmed the quiet-microphone listening state, push-to-talk selection, accepted WebP upload, and zero console warnings or errors.
- No visible clipping, overflow, broken icons, or unreadable controls were found.

## Presence menu QA

### Comparison target

- Source visual truth: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-53bbeef4-bd9d-4e84-bbe9-9b83cf8b97d1.png`
- Implementation screenshot: `C:/Users/fahad/AppData/Local/Temp/scuttlebutt-presence-desktop.png`
- Responsive implementation screenshot: `C:/Users/fahad/AppData/Local/Temp/scuttlebutt-presence-mobile.png`
- Implementation URL: `http://localhost:5173/`
- State: profile menu open, presence submenu open, Invisible selected.
- Theme: dark.

### Evidence and normalization

- Source pixels: 627 x 497; source is a desktop screenshot containing browser/system chrome.
- Implementation desktop pixels: 1280 x 720; CSS viewport 1280 x 720; device scale factor 1.
- Implementation mobile pixels: 390 x 844; CSS viewport 390 x 844; device scale factor 1.
- The source and desktop implementation were opened together for comparison. The focused comparison region was the user profile popover and the adjacent four-option presence menu. The implementation's surrounding workspace content is intentionally different application context, so the full-view comparison was used for composition and the focused region for fidelity.

### Comparison

#### Full view

The implementation preserves the reference interaction hierarchy: the account card opens from the lower-left user area, the status control is prominent inside the card, and the four presence choices are exposed in a separate anchored panel. Desktop captures keep the menu within the workspace, while the mobile capture moves the panel above the card and keeps all controls within the 390px viewport.

#### Focused region

- Typography: Inter-based hierarchy is legible and uses stronger weights for status labels with smaller explanatory copy, matching the reference's information density.
- Spacing and layout: profile controls use consistent rows, 8px-style gaps, rounded surfaces, and a clear separation between the card and submenu.
- Colors and tokens: Online is green, Idle is amber, Do Not Disturb is red, and Invisible is muted gray; the selected Invisible row has a visible focus/selection outline.
- Image quality and asset fidelity: the implementation uses the existing Scuttlebutt avatar and icon system; the reference avatar/background are user-specific Discord content and are intentionally not copied into the product.
- Copy/content: Online, Idle, Do Not Disturb, and Invisible are all present with Discord-like descriptions; Invisible communicates that the user appears offline.

### Findings

No actionable P0, P1, or P2 findings remain.

The reference contains Discord-specific avatar art, OS tray chrome, and account context that are not part of Scuttlebutt's product surface. Those differences are expected content/context differences rather than presence-menu fidelity issues.

### Comparison history

- Initial desktop/mobile pass: verified the status panel placement, responsive bounds, selected-state treatment, and member-list projection. No actionable P0-P2 drift was found.
- Final matched-state pass: captured desktop and mobile with Invisible selected, compared both with the supplied reference, then restored the local preview to Online. No P0-P2 fixes were required after the final comparison.

### Implementation checklist

- [x] Persistent Online, Idle, Do Not Disturb, and Invisible states.
- [x] Profile menu and nested status submenu.
- [x] Public presence projection, including Invisible appearing offline to other members.
- [x] Presence indicators in friend, group, member, and voice lists.
- [x] Desktop and mobile layout verification.
- [x] Browser console error check completed with no errors.

### Follow-up polish

- Native operating-system notification suppression for Do Not Disturb can be added when Scuttlebutt gains a desktop notification subsystem.

final result: passed

## Server banner theme and media picker QA

### Comparison targets

- Server banner and profile icon reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-4d9d050f-d74f-456f-8149-d3d5a9d4b32c.png`
- Cross-workspace theme reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-5693a85c-e059-42d8-967f-f228fee65479.png`
- GIF/sticker/emoji picker reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-153b30a0-e8a9-4519-9ac2-69ba78ee0bba.png`
- Implementation screenshot: `C:/Users/fahad/AppData/Local/Temp/scuttlebutt-server-theme.png`
- Implementation screenshot with GIF fallback state: `C:/Users/fahad/AppData/Local/Temp/scuttlebutt-media-picker.png`
- Implementation URL: `http://localhost:5173/`
- Browser state: reze group, general text channel, media picker open on GIFs, 1280 x 720 CSS viewport (DPR 1).

### Evidence and comparison

- Source banner pixels: 1745 x 747; source theme pixels: 2493 x 1094; source picker pixels: 531 x 560.
- Implementation pixels: 1280 x 720 for both captures; the browser screenshot includes the complete app viewport at the same CSS dimensions used for interaction QA.
- The source and implementation were inspected together. The focused comparison regions were the left workspace banner, the selected channel/theme surfaces, the picker tab/search hierarchy, and the reaction affordance treatment. Discord-specific avatars, content, and browser chrome remain reference context rather than copied assets.
- The server profile icon now appears inside the colored group banner and is reused in the server heading and rail. The selected banner color propagates through the workspace title bar, trust row, channel selection, conversation header/body, members panel, composer, and primary actions.
- The picker follows the reference hierarchy with GIFs, Stickers, and Emoji tabs, scoped search, server emoji, and a compact anchored surface. GIF and sticker results are wired to the optional GIPHY client-side Search/Trending endpoints; with no key configured, the UI gives a clear setup state while Unicode/server emoji remain usable offline.
- GIFs and stickers can be attached to messages and encoded as media reactions; custom server emoji can be inserted into messages or used as reactions. The picker is also available from voice chat text.

### Findings

No actionable P0, P1, or P2 findings remain.

The supplied references show Discord-specific pink/red themes and content. Scuttlebutt derives the workspace theme from each server's saved banner color, so the same full-surface treatment applies when a server chooses pink, purple, or another supported color.

### Implementation checklist

- [x] Server icon shown in the group banner/header.
- [x] Saved banner color propagated across group workspace surfaces.
- [x] GIF, sticker, and emoji tabs with search and custom server emoji.
- [x] Optional GIPHY API adapter with an offline fallback state.
- [x] GIF/sticker message attachments and media reactions.
- [x] Composer and voice-chat composer support the shared media picker.
- [x] Browser interaction checks, console-error check, typecheck, lint, unit tests, production build, and Docker build completed.

final result: passed

## Server administration, forums, and events QA

### Comparison targets

- Server action menu: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-fb200be0-ca2c-4b04-8d52-e2163ec295af.png`
- Forum channel: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-31682cc5-5387-4b4c-bc31-0429c65accef.png`
- Events panel: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-78cf4cb3-ea77-409d-b5e3-389b5aef1fe2.png`
- Implementation URL: `http://localhost:5173/`
- Browser state: Quick Controls Test group with the server menu, Planning category, ideas forum, and Events panel exercised at a 1280 x 720 desktop viewport (DPR 1).

### Comparison and interaction findings

- Right-clicking a channel opens a cursor-anchored Discord-style context menu with Mute channel, Create Channel, Create category, and Invite to server actions. Right-clicking empty group navigation exposes the server-level Hide muted channels action. Menu actions are keyboard-addressable and the menu closes after an action.
- Channel creation supports Text, Voice, and Forum types, optional category placement, and private-channel role selection. Private channels with no selected role remain owner-only; members with an allowed role are admitted by the channel visibility predicate.
- Forum channels provide a search/create-post toolbar, focused subject cards, and inline replies. The created post and reply persisted through the workspace state path during browser QA.
- Events open as a focused side panel, list upcoming events, and use a three-step Location, Event Info, and Review flow. Voice-channel and external/IRL locations, recurrence, cover images, and text-channel announcements were exercised. A created event appeared in the Events list and its announcement appeared in the selected text channel.
- Visual comparison with the supplied references found no actionable P0-P2 issues after correcting the server-header and menu-item sizing rules. Icons, spacing, dark surfaces, focus states, and panel hierarchy remain consistent with Scuttlebutt's existing design system.

### Implementation checklist

- [x] Right-click channel context menu with mute visibility, channel/category creation, and server invites.
- [x] Collapsible categories with text, voice, and forum channel sections.
- [x] Private channel role controls and visibility filtering.
- [x] Forum posts, search, thread replies, and persistence through the workspace model.
- [x] Event location, recurrence, details, cover image, review, list, and announcement flow.
- [x] Typecheck, lint, unit tests, production build, and in-app browser QA completed.

final result: passed
