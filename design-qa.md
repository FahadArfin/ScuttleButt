# Design QA

Reference: the supplied Discord voice-room screenshots, especially the joined-call view with a right-side channel chat.

- Voice room opens from the channel name and adds the local user to the connected list.
- Connected users appear beneath the voice channel and in the dedicated call stage.
- Speaking user has a green ring and a larger profile image in the right participant panel.
- Joined view contains mute, camera, screen/application share, soundboard, settings, and leave controls.
- Muted state changes the control to red and updates its accessible label.
- Message icon beside the voice-room title replaces the participant panel with persistent voice chat.
- Stream 4K and Open buttons are absent after joining.
- Layout, spacing, dark surfaces, participant tiles, bottom control dock, and chat drawer were compared side-by-side with the supplied reference at the same app state.
- No visible clipping, overflow, broken icons, or unreadable controls were found at the tested desktop viewport.

final result: passed
