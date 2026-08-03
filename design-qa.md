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

## Profile customization editor QA

### Comparison targets

- Discord profile editor reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-b811c872-be6e-4308-a9b6-578cfa85f236.png`
- Display name style reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-d0bb0cd9-4ce7-40df-ac69-b40885f7e5a7.png`
- Profile effect, frame, and avatar decoration references: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-749d3a8e-af01-4ab6-befe-a534735844bc.png`, `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-fe919459-230f-4fb0-9e73-bf7eb3cc534f.png`, and `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-2ebc7ffc-b90a-4481-9e05-46b2d20f7699.png`
- Implementation URL: `http://localhost:5173/`
- Browser state: local user profile editor open at a 1280 x 720 CSS viewport (DPR 1), with nested picker and live preview exercised.

### Comparison and interaction findings

- The editor follows the supplied Discord hierarchy: a focused profile editor with account controls on the left, a live profile preview on the right, and nested picker dialogs for the more visual choices.
- Banner color provides eight Scuttlebutt-safe presets plus a custom color input. The selected color updates the profile preview immediately and remains part of the existing profile persistence path.
- Avatar decoration, profile effect, profile frame, and display-name style each open a dedicated picker with selected states, descriptions, preview updates, Cancel, and Apply actions. Display-name style also exposes a color palette.
- Browser QA selected Cosmos, Orbit, Halo, and Neon, applied them, saved the editor, reloaded the app, reopened Edit profile, and confirmed all four choices were restored. The nested picker was also verified after correcting its modal stacking order so it receives pointer input above the parent editor.
- The responsive rules collapse the editor and picker preview into a single column below the desktop layout threshold. The implementation uses Scuttlebutt's existing avatars, icons, colors, and typography rather than copying Discord-specific marketplace assets.

### Findings

No actionable P0, P1, or P2 findings remain for the implemented profile customization flow.

The reference includes Discord/Nitro marketplace inventory and account-specific artwork. Scuttlebutt currently provides local, non-purchasable presets with clear labels, which keeps the interaction useful without implying unavailable marketplace functionality.

### Implementation checklist

- [x] Banner color presets and custom color control.
- [x] Profile effect picker with live preview.
- [x] Profile frame picker with live preview.
- [x] Avatar decoration picker with live preview.
- [x] Display-name style and color picker.
- [x] Persisted per-account selections and reload verification.
- [x] Desktop browser screenshot and responsive CSS review.
- [x] Typecheck, lint, unit tests, and production build completed.

final result: passed

## Application settings QA

### Comparison targets

- Settings navigation and Account reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-77dee017-9e6b-4f40-8084-875e9a104d3e.png`
- Settings sidebar reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-52e31b27-f555-4abf-beac-8ab23eeba2a3.png`
- Voice & Video reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-7794c164-ad8d-4143-b078-0844924a828a.png`
- Accessibility reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-d5789edf-fa77-4175-baab-762d4ee29110.png`
- Language & Time reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-8478b07d-c1a7-4c30-8bf3-e802c1cd8e29.png`
- Implementation screenshots: `C:/Users/fahad/OneDrive/Documents/Scuttlebutt/artifacts/design-qa/application-settings-account.png`, `C:/Users/fahad/OneDrive/Documents/Scuttlebutt/artifacts/design-qa/application-settings-voice.png`
- Implementation URL: `http://localhost:5173/`
- Browser state: local user, application settings open from the bottom-left gear, Account and Voice & Video sections exercised at a 1280 x 720 CSS viewport (DPR 1).

### Evidence and comparison

- The bottom-left gear now opens a dedicated application-settings dialog instead of the profile popover or server settings. The dialog uses a Discord-inspired two-column layout with a persistent profile header, search field, grouped navigation, scrollable content, close control, and logout action.
- Account, Password & Security, Data & Privacy, Messaging Permissions, Notifications, Voice & Video, Appearance, Accessibility, Language & Time, Activity Privacy, Connected Apps, and Developer sections are addressable from the sidebar. The existing server settings flow remains separate.
- Functional preference controls were exercised in the browser: profile editor handoff, microphone/camera permission tests, microphone and speaker selection/volume controls, automatic voice activity versus push-to-talk, theme selection, density/text sizing, reduced motion, high contrast, notification and privacy toggles, export/clear-drafts actions, language, and time format.
- The implementation reuses the existing Scuttlebutt avatar and Phosphor icon system. No Discord-specific images or content were copied; the supplied references were used for hierarchy, spacing, contrast, and interaction shape.

### Findings

No actionable P0, P1, or P2 findings remain for the implemented application-settings flow.

The current web client exposes settings that can work locally today. Account password changes, MFA enrollment, logged-in-device management, and connected-app integrations remain provider/backend-dependent and are clearly marked as unavailable rather than presented as fake controls.

### Implementation checklist

- [x] Bottom-left gear opens application settings, not server settings.
- [x] Discord-style grouped settings navigation, search, profile header, close, and logout.
- [x] Account/profile handoff to the existing profile editor.
- [x] Voice & Video controls with browser microphone/camera permission tests and voice mode/profile settings.
- [x] Appearance, accessibility, notifications, privacy, language/time, activity, connections, and developer sections.
- [x] Per-user local persistence for application preferences and shared voice settings.
- [x] Desktop screenshots captured and compared with the supplied references.
- [x] Typecheck, lint, unit tests, production build, and browser interaction checks completed.

final result: passed

## Top server banner and enlarged profile icon QA

### Comparison target

- Source visual truth: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-23169fb2-af1c-4dd2-9cd2-e9a177da9550.png`
- Desktop implementation screenshot: `C:/Users/fahad/AppData/Local/Temp/scuttlebutt-top-banner.png`
- Mobile implementation screenshot: `C:/Users/fahad/AppData/Local/Temp/scuttlebutt-top-banner-mobile.png`
- Implementation URL: `http://localhost:5173/`
- Desktop state: reze group, general channel, server navigation visible.
- Mobile state: group navigation visible at the responsive breakpoint.

### Evidence and comparison

- Source pixels: 638 x 377; desktop implementation pixels: 1280 x 720; mobile implementation pixels: 390 x 844. The source is a focused sidebar crop, while implementation captures include the full app viewport; the focused comparison region is the workspace sidebar.
- The banner now occupies the first row of the group sidebar, above the workspace title and encrypted-server status. This directly addresses the requested top placement while preserving the server menu and status controls below it.
- The actual saved server profile image is reused in the banner at 76 x 76 on desktop and 64 x 64 on mobile. Its image layer receives a restrained 1.08 scale so the profile feels more prominent without cropping the subject out of the rounded frame.
- Typography uses the existing Inter system with a heavier server name and compact description. The banner's solid saved server color continues to drive the workspace theme and channel selection surfaces.
- The mobile capture keeps the banner inside the single-column navigation view without overlap or clipping. The group title, encrypted status, channel list, and bottom user panel remain reachable.
- Browser interaction checks completed after reload; the browser console reported no errors.

### Findings

No actionable P0, P1, or P2 findings remain.

The supplied reference shows the previous banner position below the status row. The latest user instruction explicitly requested moving it to the very top, so that order change is intentional; the icon scale, banner treatment, spacing, copy hierarchy, and responsive behavior remain grounded in the supplied reference.

### Implementation checklist

- [x] Banner moved to the top of the group workspace sidebar.
- [x] Server profile icon enlarged and gently zoomed inside the banner.
- [x] Server name and description remain readable at desktop and mobile widths.
- [x] Existing title/menu/status/channel interactions preserved.
- [x] Desktop and mobile browser screenshots captured and compared with the supplied reference.
- [x] Typecheck, lint, unit tests, production build, and console-error check completed.

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

## Profile popover cleanup and display-name copy QA

### Comparison targets

- Profile popover reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-869c7ab2-a08a-4e8a-b57a-2f3b95138584.png`
- Display-name copy reference: `C:/Users/fahad/AppData/Local/Temp/codex-clipboard-ff2071a2-ec3f-4771-8e49-7714bca2c053.png`
- Implementation URL: `http://localhost:5173/`
- Browser state: local profile popover open with the display-name copy control exercised.

### Comparison and interaction findings

- The profile popover now contains only the profile preview, display name, copy affordance, Edit profile, and presence controls. Friend code, Add a friend, and Connect Google account were removed from this focused profile surface; the friend workflow remains available from Direct Messages where it belongs.
- The copy icon sits beside the display name, uses an accessible label, and writes the display name to the clipboard. Browser QA confirmed the success notice `Display name copied.` after activation.
- The resulting compact popover matches the supplied Discord reference's hierarchy and keeps the existing Scuttlebutt banner, avatar decoration, display-name styling, and presence menu behavior intact.

### Findings

No actionable P0, P1, or P2 findings remain for the updated profile popover.

### Implementation checklist

- [x] Remove friend code from the profile popover.
- [x] Remove Add a friend from the profile popover.
- [x] Remove Connect Google account from the profile popover.
- [x] Add accessible copy display name control.
- [x] Confirm copy success feedback in the browser.
- [x] Confirm no visual overflow in the focused popover capture.

final result: passed
