import { describe, expect, it } from 'vitest';

import { loadConfig } from './index';

describe('runtime configuration', () => {
  it('uses safe local development defaults', () => {
    expect(loadConfig({}).apiHost).toBe('127.0.0.1');
    expect(loadConfig({}).apiPort).toBe(3001);
    expect(loadConfig({}).environment).toBe('development');
  });

  it('rejects invalid ports', () => {
    expect(() => loadConfig({ API_PORT: '70000' })).toThrow(
      'API_PORT must be an integer between 1 and 65535.',
    );
  });
});
