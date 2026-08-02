# Design QA

References: the supplied Discord voice-room, voice settings, and profile screenshots.

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

final result: passed
