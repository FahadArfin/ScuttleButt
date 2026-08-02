import { describe, expect, it } from 'vitest';

import { VoiceActivityDetector } from './voice-activity.js';

describe('VoiceActivityDetector', () => {
  it('does not mark an open but quiet microphone as speaking', () => {
    const detector = new VoiceActivityDetector();
    expect(detector.update(0.01, 0.05, true, 0)).toBe(false);
    expect(detector.update(0.02, 0.05, true, 20)).toBe(false);
  });

  it('requires sustained voice activity and uses a short hangover', () => {
    const detector = new VoiceActivityDetector();
    expect(detector.update(0.08, 0.05, true, 0)).toBe(false);
    expect(detector.update(0.09, 0.05, true, 20)).toBe(true);
    expect(detector.update(0.01, 0.05, true, 200)).toBe(true);
    expect(detector.update(0.01, 0.05, true, 400)).toBe(false);
  });

  it('stops immediately when mute or push-to-talk closes the input', () => {
    const detector = new VoiceActivityDetector();
    detector.update(0.08, 0.05, true, 0);
    expect(detector.update(0.08, 0.05, true, 20)).toBe(true);
    expect(detector.update(0.08, 0.05, false, 30)).toBe(false);
  });
});
