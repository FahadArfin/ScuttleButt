import { describe, expect, it } from 'vitest';

import {
  createCameraPublishOptions,
  createScreenShareCaptureOptions,
  getNextLowerVideoQuality,
  getQualityFallbackChain,
  getVideoCaptureAvailability,
  getVideoQualityOptions,
} from './video.js';

describe('LiveKit video boundary', () => {
  it('starts conservatively and marks unmeasured high-quality modes unavailable', () => {
    const options = getVideoQualityOptions();

    expect(options.find(({ mode }) => mode === 'data-saver')?.enabled).toBe(true);
    expect(options.find(({ mode }) => mode === 'balanced')?.enabled).toBe(true);
    expect(options.find(({ mode }) => mode === 'smooth')?.enabled).toBe(false);
    expect(options.find(({ mode }) => mode === 'sharp')?.availabilityReason).toContain('2560×1440');
    expect(options.find(({ mode }) => mode === 'ultra')?.enabled).toBe(false);
  });

  it('provides a measured fallback chain instead of promising 4K60', () => {
    expect(getQualityFallbackChain('ultra')).toEqual([
      'ultra',
      'sharp',
      'smooth',
      'balanced',
      'data-saver',
    ]);
    expect(getNextLowerVideoQuality('balanced')).toBe('data-saver');
    expect(getNextLowerVideoQuality('data-saver')).toBeNull();
  });

  it('configures camera simulcast and browser-selected display surfaces', () => {
    const cameraPublish = createCameraPublishOptions('balanced');
    const screenCapture = createScreenShareCaptureOptions({
      includeSystemAudio: true,
      source: 'browser-tab',
    });

    expect(cameraPublish.simulcast).toBe(true);
    expect(cameraPublish.videoEncoding?.maxFramerate).toBe(30);
    expect(screenCapture.video).toEqual({ displaySurface: 'browser' });
    expect(screenCapture.systemAudio).toBe('include');
    expect(screenCapture.contentHint).toBe('text');
  });

  it('reports browser capture capabilities without requesting permission', () => {
    const availability = getVideoCaptureAvailability();

    expect(availability).toEqual({
      browserTab: false,
      camera: false,
      screen: false,
      systemAudio: 'unsupported',
      window: false,
    });
  });
});
