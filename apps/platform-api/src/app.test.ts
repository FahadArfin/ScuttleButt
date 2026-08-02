import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('platform API', () => {
  it('returns a typed health response', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'platform-api',
      version: '0.1.0',
    });
    expect(response.json().timestamp).toEqual(expect.any(String));

    await app.close();
  });

  it('requires configured authentication for cloud synchronization', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync/workspace/load',
      payload: { credential: 'missing' },
    });

    expect(response.statusCode).toBe(503);
    await app.close();
  });
});
